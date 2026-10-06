using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WireManager.Core.Interfaces;
using WireManager.IDS.Models;
using WireManager.IDS.Parsers;

namespace WireManager.IDS.Collectors
{
    public class ConntrackCollector(ILogger<ConntrackCollector> logger, IWireguardOps wireguardOps) : BackgroundService
    {
        private readonly ILogger<ConntrackCollector> _logger = logger;
        private readonly IWireguardOps _wireguardOps = wireguardOps;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {

            try
            {
                await ProcessConntrackAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // L'operazione è stata annullata
                return;

            }
            catch (Exception ex)
            {
                // Log dell'eccezione
                _logger.LogError(
                    ex,
                    "Errore durante l'elaborazione del conntrack collector");
            }

        }

        private async Task ProcessConntrackAsync(CancellationToken cancellationToken)
        {

            _logger.LogInformation("[CONNTRACK] Monitor avviato");

            try
            {
                await foreach (var line in _wireguardOps.ExecuteStreamingCommandAsync(
                        "conntrack",
                        "-E",
                        cancellationToken
                    )
                )
                {

                    if (line == null)
                        break;

                    if (string.IsNullOrWhiteSpace(line))
                        continue;

                    try
                    {
                        var connectionEvent = ConntrackParsers.ParseConntrackLine(line);

                        if (connectionEvent == null)
                            continue;

                        // Per ora puoi anche solo loggarlo
                        _logger.LogInformation(
                            "[CONNTRACK] {EventType} {Protocol} {SourceIp}:{SourcePort} -> {DestinationIp}:{DestinationPort}",
                            connectionEvent.EventType,
                            connectionEvent.Protocol,
                            connectionEvent.SourceIP,
                            connectionEvent.SourcePort,
                            connectionEvent.DestinationIP,
                            connectionEvent.DestinationPort
                        );

                        // più avanti:
                        // await ProcessNetworkEventAsync(connectionEvent, cancellationToken);


                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(
                            ex,
                            "Errore durante il parsing della linea del conntrack: {Line}",
                            line
                        );
                        continue;
                    }

                }
            }
            catch (OperationCanceledException)
            {
                // shutdown normale
            }
            finally
            {
                _logger.LogInformation("[CONNTRACK] Monitor terminato");
            }
        }

    }
}