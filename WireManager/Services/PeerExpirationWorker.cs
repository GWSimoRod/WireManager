using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;

namespace WireManager.Core.Services
{
    public class PeerExpirationWorker(IServiceScopeFactory scopeFactory, ILogger<PeerExpirationWorker> logger) : BackgroundService
    {
        private readonly ILogger<PeerExpirationWorker> _logger = logger;
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {

            using var timer = new PeriodicTimer(_checkInterval);

            do
            {
                try
                {
                    await ProcessPeerExpirationAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // L'operazione è stata annullata
                    break;

                }
                catch (Exception ex)
                {
                    // Log dell'eccezione
                    _logger.LogInformation($"Errore durante l'elaborazione dell'expiration dei peer: {ex.Message}");
                }
            } while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken));
        }

        private async Task ProcessPeerExpirationAsync(CancellationToken cancellation)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<WireManagerContext>();
            var peerService = scope.ServiceProvider.GetRequiredService<IPeerServices>();

            var now = DateTime.UtcNow;

            _logger.LogInformation($"[EXPIRE WORKER] Check at UTC: {now:yyyy-MM-dd HH:mm:ss}");

            // Recupera tutti i peer che hanno una data di scadenza per fare il log di diagnostica
            var peersWithExpiry = await context.ConfPeers
                .AsNoTracking()
                .Where(p => p.ExpireAt != null)
                .Select(p => new { p.Id, p.ExpireAt })
                .ToListAsync(cancellation);

            if (peersWithExpiry.Count == 0)
            {
                _logger.LogInformation("[EXPIRE WORKER] Nessun peer con data di scadenza configurata.");
                return;
            }

            foreach (var p in peersWithExpiry)
            {
                bool isExpired = p.ExpireAt < now;
                _logger.LogInformation($"[EXPIRE WORKER] Peer ID: {p.Id} | ExpireAt (DB): {p.ExpireAt:yyyy-MM-dd HH:mm:ss} | IsExpired (< now): {isExpired}");
            }

            // Filtra gli ID effettivamente scaduti
            var expiredPeerIds = peersWithExpiry
                .Where(p => p.ExpireAt < now)
                .Select(p => p.Id)
                .ToList();

            if (expiredPeerIds.Count == 0)
            {
                _logger.LogInformation("[EXPIRE WORKER] Nessun peer scaduto da eliminare in questo ciclo.");
                return;
            }

            _logger.LogInformation($"[EXPIRE WORKER] Trovati {expiredPeerIds.Count} peer scaduti. Avvio eliminazione...");

            foreach (var peerId in expiredPeerIds)
            {
                _logger.LogInformation($"[EXPIRE WORKER] Eliminazione peer ID {peerId} in corso...");
                await peerService.DeletePeerByIdAsync(peerId);
                _logger.LogInformation($"[EXPIRE WORKER] Peer ID {peerId} eliminato con successo.");
            }
        }

    }
}
