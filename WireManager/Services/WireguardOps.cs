using Microsoft.Extensions.Logging;
﻿using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Utils;

namespace WireManager.Core.Services
{
    public class WireguardOps(ISetupServices setupServices, WireManagerContext context, ILogger<WireguardOps> logger) : IWireguardOps
    {
        private readonly ILogger<WireguardOps> _logger = logger;
        private readonly ISetupServices _setupServices = setupServices;
        private DockerClient? _dockerClient;
        private readonly WireManagerContext _context = context;

        public string? _containerName { get; private set; } = null;
        public string? _executionMode { get; private set; } = null;

        public static bool IsRunningInDocker()
        {
            // Controlla la variabile d'ambiente impostata dalle immagini SDK/Runtime .NET
            bool isDotNetContainer = string.Equals(
                Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"),
                "true",
                StringComparison.OrdinalIgnoreCase);

            bool hasDockerEnvFile = File.Exists("/.dockerenv");

            bool isDocker = isDotNetContainer || hasDockerEnvFile;

            Console.WriteLine($"[WireGuardOps] Esecuzione in container: {isDocker}");

            return isDocker;
        }

        private async Task GetInfoSystem()
        {
            if (_containerName != null && _executionMode != null)
            {
                return; // Se le informazioni sono già state recuperate
            }

            var configs = await _setupServices.GetSetupConfigAsync();

            _containerName = configs.FirstOrDefault(c => c.Key == "ContainerName")?.Value ?? "wireguard";
            _executionMode = configs.FirstOrDefault(c => c.Key == "ExecutionMode")?.Value ?? "Docker";

            // Se siamo in modalità Docker (da config o rilevata automaticamente), inizializziamo il client
            bool isDocker = string.Equals(_executionMode, "Docker", StringComparison.OrdinalIgnoreCase) || IsRunningInDocker();

            if (isDocker && _dockerClient == null)
            {
                _dockerClient = new DockerClientConfiguration(new Uri("unix:///var/run/docker.sock")).CreateClient();
            }
        }

        /// <summary>
        /// Metodo centralizzato per eseguire comandi CLI in container (via SDK) o nativamente,
        /// supportando l'invio di dati tramite Standard Input.
        /// </summary>

        public async Task<(int ExitCode, string Output, string Error)>
            ExecuteCommandAsync(
                string command,
                string args,
                string? standardInput = null,
                bool skipOutputRead = false,
                bool shellCommand = false)
        {

            if (_dockerClient == null)
            {
                await GetInfoSystem();

                // Se dopo il tentativo è ancora null, lanciamo l'errore vero
                if (_dockerClient == null)
                {
                    throw new InvalidOperationException("Unable to initialize DockerClient in GetInfoSystem.");
                }
            }
            var cmdArray = new List<string> { command };

            if (shellCommand)
            {
                // Per sh -c l'intero comando deve essere UN SOLO argomento
                cmdArray.Add("-c");
                cmdArray.Add(args);
            }
            else if (!string.IsNullOrWhiteSpace(args))
            {
                cmdArray.AddRange(
                    args.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            }

            _logger.LogInformation(
                $"[WireguardOps] Exec: {string.Join(" | ", cmdArray)}");

            var execCreateResponse =
                await _dockerClient.Exec.ExecCreateContainerAsync(
                    _containerName,
                    new ContainerExecCreateParameters
                    {
                        Cmd = cmdArray,
                        AttachStdin = standardInput != null,
                        AttachStdout = true,
                        AttachStderr = true
                    });

            _logger.LogInformation(
                $"[WireguardOps] Exec creato: {execCreateResponse.ID}");

            using var stream =
                await _dockerClient.Exec.StartAndAttachContainerExecAsync(
                    execCreateResponse.ID,
                    false);

            _logger.LogInformation("[WireguardOps] Exec avviato.");

            Task<(string stdout, string stderr)> outputTask =
                    stream.ReadOutputToEndAsync(CancellationToken.None);

            if (standardInput != null)
            {
                var bytes = Encoding.UTF8.GetBytes(standardInput);

                _logger.LogInformation(
                    $"[WireguardOps] Invio {bytes.Length} byte su stdin...");

                await stream.WriteAsync(
                    bytes,
                    0,
                    bytes.Length,
                    CancellationToken.None);

                _logger.LogInformation("[WireguardOps] stdin chiuso.");

                stream.CloseWrite();
            }

            var result = await outputTask;

            var inspect =
                await _dockerClient.Exec.InspectContainerExecAsync(
                    execCreateResponse.ID);

            _logger.LogInformation(
                $"[WireguardOps] ExitCode: {inspect.ExitCode}");

            return (
                (int)inspect.ExitCode,
                result.stdout ?? string.Empty,
                result.stderr ?? string.Empty
            );
        }

        private async Task RestartWireguardContainerAsync()
        {
            _logger.LogInformation($"[DEBUG] Riavvio container: {_containerName}");

            await _dockerClient.Containers.RestartContainerAsync(
                _containerName,
                new ContainerRestartParameters
                {
                    WaitBeforeKillSeconds = 1
                });

            _logger.LogInformation("[DEBUG] Container WireGuard riavviato.");
        }

        public async Task<bool> SyncServerAsync(int Id)
        {
            await GetInfoSystem();

            try
            {
                var serverConfigFilePath = Path.Combine(DiskOps._baseFolderPathServer, $"server_{Id}.conf");
                var lines = await File.ReadAllLinesAsync(serverConfigFilePath);

                var cleanLines = lines.Where(line =>
                    !line.Trim().StartsWith("Address", StringComparison.OrdinalIgnoreCase) &&
                    !line.Trim().StartsWith("PostUp", StringComparison.OrdinalIgnoreCase) &&
                    !line.Trim().StartsWith("PostDown", StringComparison.OrdinalIgnoreCase)
                );

                String cleanConfig = string.Join(Environment.NewLine, cleanLines);

                _logger.LogInformation("[Sync] Avvio del comando wg syncconf...");

                _logger.LogInformation($"[DEBUG] Config length: {cleanConfig.Length}");
                _logger.LogInformation($"[DEBUG] Config:");
                _logger.LogInformation(cleanConfig);

                // Passiamo la cleanConfig come terzo parametro per iniettarla nello Standard Input (/dev/stdin)
                var result = await ExecuteCommandAsync(
                    "sh",
                    $"wg-quick strip /config/wg_confs/server_{Id}.conf | wg syncconf server_{Id} /dev/stdin",
                    null,
                    false,
                    true);

                if (result.ExitCode == 0)
                {
                    _logger.LogInformation("============= SYNC RIUSCITO =============");
                    if (!string.IsNullOrWhiteSpace(result.Output))
                    {
                        _logger.LogInformation($"Output di WireGuard: {result.Output}");
                    }
                    _logger.LogInformation($"La configurazione di server_{Id} è stata aggiornata!");
                    _logger.LogInformation("=========================================");
                    return true;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    _logger.LogInformation("============= ERRORE SYNC =============");
                    _logger.LogInformation($"Codice di errore: {result.ExitCode}");
                    _logger.LogInformation($"Dettaglio Errore: {result.Error}");
                    _logger.LogInformation("=======================================");
                    Console.ResetColor();

                    throw new InvalidOperationException($"Error wg syncconf: {result.Error}");
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Error syncing server with Id {Id}: {ex.Message}", ex);
            }
        }

        public async Task<bool> StartWireGuardInterfaceAsync(int serverId)
        {
            await GetInfoSystem();

            string interfaceName = $"server_{serverId}";
            string configPath = Path.Combine(DiskOps._baseFolderPathServer, $"{interfaceName}.conf");

            bool isDocker = string.Equals(_executionMode, "Docker", StringComparison.OrdinalIgnoreCase) || IsRunningInDocker();

            string wgArgPath = isDocker
                ? $"/config/wg_confs/{interfaceName}.conf"
                : configPath;

            _logger.LogInformation($"[WireGuard] Tentativo di attivazione interfaccia: {interfaceName}");

            try
            {
                // Verifica se l'interfaccia esiste
                var checkResult = await ExecuteCommandAsync("ip", $"link show {interfaceName}");

                if (checkResult.ExitCode == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    _logger.LogInformation($"[Warning] L'interfaccia {interfaceName} è già attiva nel kernel. Eseguo un riavvio pulito (down -> up)...");
                    Console.ResetColor();

                    await ExecuteCommandAsync("wg-quick", $"down {wgArgPath}");
                }

                // Eseguiamo wg-quick up
                var upResult = await ExecuteCommandAsync("wg-quick", $"up {wgArgPath}");

                // controllo che se è il primo server attivo, allora riavvia il container per 
                // risolvere possibile mancanza di default route

                var serverCount = await _context.ConfServers.CountAsync();

                if (serverCount - 1 == 0)
                {
                    await RestartWireguardContainerAsync();
                }
                else
                {
                    _logger.LogInformation("Non uguale a 0: " + serverCount);
                }

                if (upResult.ExitCode == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    _logger.LogInformation($"============= INTERFACCIA {interfaceName.ToUpper()} ATTIVA =============");
                    _logger.LogInformation($"Il container è passato in modalità Server per questa interfaccia.");
                    _logger.LogInformation("=======================================================");
                    Console.ResetColor();
                    return true;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    _logger.LogInformation($"============= ERRORE WG-QUICK UP =============");
                    _logger.LogInformation($"Codice di errore: {upResult.ExitCode}");
                    _logger.LogInformation($"Dettaglio Errore: {upResult.Error}");
                    _logger.LogInformation("==============================================");
                    Console.ResetColor();

                    throw new InvalidOperationException($"Unable to bring up the interface {interfaceName}: {upResult.Error}");
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Hardware error while executing wg-quick up for server {serverId}: {ex.Message}", ex);
            }
        }

        public async Task<bool> StopWireGuardInterfaceAsync(int serverId)
        {
            await GetInfoSystem();

            string interfaceName = $"server_{serverId}";
            string configPath = Path.Combine(DiskOps._baseFolderPathServer, $"{interfaceName}.conf");

            bool isDocker = string.Equals(_executionMode, "Docker", StringComparison.OrdinalIgnoreCase) || IsRunningInDocker();

            string wgArgPath = isDocker
                ? $"/config/wg_confs/{interfaceName}.conf"
                : configPath;

            _logger.LogInformation($"[WireGuard] Tentativo di spegnimento interfaccia: {interfaceName}");

            try
            {
                // Verifica se l'interfaccia è attiva
                var checkResult = await ExecuteCommandAsync("ip", $"link show {interfaceName}");

                if (checkResult.ExitCode != 0)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    _logger.LogInformation($"[Warning] L'interfaccia {interfaceName} non risulta attiva nel kernel. Salto il wg-quick down.");
                    Console.ResetColor();
                    return true;
                }

                var downResult = await ExecuteCommandAsync("wg-quick", $"down {wgArgPath}");

                if (downResult.ExitCode == 0)
                {
                    Console.ForegroundColor = ConsoleColor.DarkYellow;
                    _logger.LogInformation($"============= INTERFACCIA {interfaceName.ToUpper()} SPENTA =============");
                    _logger.LogInformation($"L'interfaccia è stata rimossa dal kernel Linux.");
                    _logger.LogInformation("=========================================================");
                    Console.ResetColor();
                    return true;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    _logger.LogInformation($"============= ERRORE WG-QUICK DOWN =============");
                    _logger.LogInformation($"Codice di errore: {downResult.ExitCode}");
                    _logger.LogInformation($"Dettaglio Errore: {downResult.Error}");
                    _logger.LogInformation("================================================");
                    Console.ResetColor();

                    throw new InvalidOperationException($"Unable to bring down the interface {interfaceName}: {downResult.Error}");
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Hardware error while executing wg-quick down for server {serverId}: {ex.Message}", ex);
            }
        }

        public async Task<List<PeerStatsDTO>>? GetPeerStatsAsync(string Interface)
        {
            await GetInfoSystem();

            try
            {
                var result = await ExecuteCommandAsync("wg", $"show {Interface} dump");

                if (result.ExitCode != 0)
                {
                    throw new InvalidOperationException($"Error executing wg show: {result.Error}");
                }

                var lines = result.Output.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                var statsList = new List<PeerStatsDTO>();

                foreach (var line in lines)
                {
                    var parts = line.Split('\t');

                    if (parts.Length >= 8)
                    {
                        long.TryParse(parts[4], out long handshakeUnix);
                        long.TryParse(parts[5], out long rxBytes);
                        long.TryParse(parts[6], out long txBytes);

                        var stats = new PeerStatsDTO
                        {
                            PublicKey = parts[0],
                            LatestHandshake = handshakeUnix == 0
                                ? (DateTime?)null
                                : DateTimeOffset.FromUnixTimeSeconds(handshakeUnix).UtcDateTime,
                            RxBytes = rxBytes,
                            TxBytes = txBytes
                        };

                        statsList.Add(stats);
                    }
                }

                return statsList;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Error retrieving peer statistics for interface {Interface}: {ex.Message}", ex);
            }
        }
    }
}