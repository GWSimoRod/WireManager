using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WireManager.Core.Interfaces;
using WireManager.IDS.Enrichment;
using WireManager.IDS.Models;
using WireManager.IDS.Parsers;
using WireManager.IDS.Store;

namespace WireManager.IDS.Collectors
{
    public class ConntrackCollector(ILogger<ConntrackCollector> logger, IServiceScopeFactory scopeFactory, ConntrackStore conntrackStore) : BackgroundService
    {
        private readonly ILogger<ConntrackCollector> _logger = logger;
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly ConntrackStore _conntrackStore = conntrackStore;

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

            using var scope = _scopeFactory.CreateScope();

            var wireguardOps = scope.ServiceProvider
                .GetRequiredService<IWireguardOps>();


            _logger.LogInformation("[CONNTRACK] Monitor avviato");

            try
            {
                await foreach (var line in wireguardOps.ExecuteStreamingCommandAsync(
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

                        using (var eventScope = _scopeFactory.CreateScope())
                        {
                            var enricher = eventScope.ServiceProvider
                                .GetRequiredService<ConnectionEventEnricher>();

                            await enricher.EnricherAsync(connectionEvent);
                        }

                        // Per ora puoi anche solo loggarlo
                        _logger.LogInformation(
                            "[CONNTRACK] {EventType} {Protocol} {SourceIp}:{SourcePort} -> {DestinationIp}:{DestinationPort} | ACL={AclStatus} | PeerId={PeerId}",
                            connectionEvent.EventType,
                            connectionEvent.Protocol,
                            connectionEvent.SourceIP,
                            connectionEvent.SourcePort,
                            connectionEvent.DestinationIP,
                            connectionEvent.DestinationPort,
                            connectionEvent.IsAclAuthorized.HasValue
                                ? (connectionEvent.IsAclAuthorized.Value ? "Authorized" : "Denied")
                                : "Unknown",
                            connectionEvent.PeerId
                        );

                        // salvo l'evento nel ConntrackStore
                        _conntrackStore.Add(connectionEvent);

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