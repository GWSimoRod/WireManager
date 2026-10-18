using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using WireManager.IDS.Detection;
using WireManager.IDS.Models;
using WireManager.IDS.Scoring;
using WireManager.IDS.Store;

namespace WireManager.IDS.Worker
{
    public class DetectionWorker(ILogger<DetectionWorker> logger, DetectionEngine detectionEngine, ConntrackStore conntrackStore, IServiceScopeFactory serviceScope, IdsScoreCalculator scoreCalculator) : BackgroundService
    {
        private readonly ILogger<DetectionWorker> _logger = logger;
        private readonly IdsScoreCalculator _scoreCalculator = scoreCalculator;
        private readonly IServiceScopeFactory _serviceScope = serviceScope;
        private readonly DetectionEngine _detectionEngine = detectionEngine;
        private readonly ConntrackStore _conntrackStore = conntrackStore;
        private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);

        protected override async Task ExecuteAsync(
            CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(_checkInterval);

            try
            {
                do
                {
                    try
                    {
                        await ProcessDetectionRulesAsync(stoppingToken);
                    }
                    catch (Exception ex) when (
                        ex is not OperationCanceledException ||
                        !stoppingToken.IsCancellationRequested)
                    {
                        _logger.LogError(
                            ex,
                            "[DETECTION WORKER] Error processing IDS rules");
                    }
                }
                while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation(
                    "[DETECTION WORKER] Worker stopped");
            }
        }

        private async Task ProcessDetectionRulesAsync(CancellationToken cancellation)
        {

            _logger.LogInformation("[DETECTION WORKER] Starting IDS detection process...");

            using var scope = _serviceScope.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<WireManagerContext>();

            var notificationServices = scope.ServiceProvider
                .GetRequiredService<INotificationServices>();


            if (cancellation.IsCancellationRequested)
            {
                _logger.LogInformation("[DETECTION WORKER] Cancellazione richiesta, terminando il worker.");
                return;
            }

            // ottengo tutti i peer e faccio l'analisi

            var peerIds = await context.ConfPeers
                .AsNoTracking()
                .Select(p => p.Id)
                .ToListAsync(cancellation);

            foreach (var peerId in peerIds)
            {
                try
                {
                    // ottengo tutti gli eventi di connessione per il peer

                    var connectionEvents = _conntrackStore.ReadAllQueue(peerId);

                    if (connectionEvents.Count == 0)
                    {
                        _logger.LogDebug(
                            "[DETECTION WORKER] No connection events for peer {PeerId}, checking score decay.",
                            peerId);
                    }
                    else
                    {
                        _logger.LogInformation(
                            "[DETECTION WORKER] Processing {EventCount} connection events for peer {PeerId}.",
                            connectionEvents.Count,
                            peerId);
                    }

                    // eseguo l'analisi delle regole IDS

                    var detectionResults = connectionEvents.Count > 0
                        ? _detectionEngine.Analyze(connectionEvents)
                        : [];

                    // Loggo i risultati della rilevazione

                    var totalScore = _scoreCalculator.CalculateScore(detectionResults);

                    if (totalScore > 0)
                    {
                        await context.ConfPeers
                            .Where(p => p.Id == peerId)
                            .ExecuteUpdateAsync(
                                setters => setters
                                    .SetProperty(
                                        p => p.IdsScore,
                                        p => p.IdsScore + totalScore > 100
                                            ? 100
                                            : p.IdsScore + totalScore)
                                    .SetProperty(
                                        p => p.LastIdsDetection,
                                        p => DateTime.UtcNow)
                                    .SetProperty(
                                        p => p.LastIdsScoreDecay,
                                        p => (DateTime?)null),
                                cancellation);

                        foreach (var result in detectionResults)
                        {
                            await notificationServices.CreateAsync(new Notification
                            {
                                Title = $"IDS: {result.RuleName}",
                                Message = $"Peer #{result.PeerId}: {result.Description}",
                                Type = NotificationType.IDS,
                                Severity = result.Severity switch
                                {
                                    DetectionSeverity.Low => NotificationSeverity.Info,
                                    DetectionSeverity.Medium => NotificationSeverity.Warning,
                                    DetectionSeverity.High => NotificationSeverity.Warning,
                                    DetectionSeverity.Critical => NotificationSeverity.Critical,
                                    _ => NotificationSeverity.Info
                                },
                                CreatedAt = result.Timestamp,
                                UserType = UserType.Admin
                            });
                        }

                    }
                    else
                    {

                        // se invece non ci sono risultati controllo se posso diminuire lo score

                        var peer = await context.ConfPeers
                            .Where(p => p.Id == peerId)
                            .Select(p => new
                            {
                                p.LastIdsDetection,
                                p.LastIdsScoreDecay,
                                p.IdsScore
                            })
                            .FirstOrDefaultAsync(cancellation);

                        if (peer != null &&
                            peer.LastIdsDetection.HasValue &&
                            peer.IdsScore > 0)
                        {
                            var lastActivity = peer.LastIdsDetection.Value;

                            if (peer.LastIdsScoreDecay.HasValue &&
                                peer.LastIdsScoreDecay.Value > lastActivity)
                            {
                                lastActivity = peer.LastIdsScoreDecay.Value;
                            }

                            if (DateTime.UtcNow - lastActivity >= TimeSpan.FromHours(12))
                            {
                                var now = DateTime.UtcNow;

                                await context.ConfPeers
                                    .Where(p => p.Id == peerId &&
                                                p.LastIdsDetection == peer.LastIdsDetection &&
                                                p.LastIdsScoreDecay == peer.LastIdsScoreDecay &&
                                                p.IdsScore > 0)
                                    .ExecuteUpdateAsync(
                                        setters => setters
                                            .SetProperty(
                                                p => p.IdsScore,
                                                p => p.IdsScore >= 20 ? p.IdsScore - 20 : 0)
                                            .SetProperty(
                                                p => p.LastIdsScoreDecay,
                                                p => (DateTime?)now),
                                        cancellation);
                            }
                        }
                    }

                    // rimuovo gli eventi di connessione più vecchi usati per questa analisi

                    _conntrackStore.RemoveEvents(peerId, connectionEvents);
                }
                catch (Exception ex) when (
                    ex is not OperationCanceledException ||
                    !cancellation.IsCancellationRequested)
                {
                    _logger.LogError(
                        ex,
                        "[DETECTION WORKER] Error processing peer {PeerId}",
                        peerId);
                }
            }

        }

    }
}
