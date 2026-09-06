using Microsoft.Extensions.Logging;
﻿using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using System.Linq.Expressions;

namespace WireManager.Core.Services
{
    public class PeerUsageServices(IServiceScopeFactory scopeFactory, ILogger<PeerUsageServices> logger) : BackgroundService
    {
        private readonly ILogger<PeerUsageServices> _logger = logger;
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(5);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {

            using var timer = new PeriodicTimer(_checkInterval);

            while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await ProcessPeerUsageAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // L'operazione è stata annullata
                    break;

                }
                catch (Exception ex)
                {
                    // Log dell'eccezione
                    _logger.LogInformation($"Errore durante l'elaborazione dell'utilizzo dei peer: {ex.Message}");
                }
            }
        }

        private async Task ProcessPeerUsageAsync(CancellationToken cancellation)
        {

            var now = DateTime.UtcNow;

            _logger.LogInformation($"[USAGE WORKER] Saving usage history at UTC: {now:yyyy-MM-dd HH:mm:ss}");

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<WireManagerContext>();
            var server = scope.ServiceProvider.GetRequiredService<IServerServices>();
            var wireguard = scope.ServiceProvider.GetRequiredService<IWireguardOps>();

            // ottengo tutte le interfacce
            var interfaces = (await server.GetAllServerAsync())
                                .Select(x => x.Id)
                                .ToList();

            foreach (var serverId in interfaces)
            {

                cancellation.ThrowIfCancellationRequested();

                List<PeerStatsDTO> peers;
                try
                {
                    peers = await wireguard.GetPeerStatsAsync($"server_{serverId}");
                    if (peers == null || peers.Count == 0)
                    {
                        continue;
                    }
                }catch (Exception ex)
                {
                    _logger.LogInformation($"Errore durante l'ottenimento delle statistiche dei peer per il server {serverId}: {ex.Message}");
                    continue;
                }

                var publicKeys = peers.Select(p => p.PublicKey).Distinct().ToArray();

                if (publicKeys.Length == 0)
                {
                    continue;
                }

                var lastUsagesDict = new Dictionary<string, UsageHistory>();
                foreach (var pk in publicKeys)
                {
                    var latest = await context.UsageHistories
                        .AsNoTracking()
                        .Where(u => u.PublicKey == pk)
                        .OrderByDescending(u => u.Timestamp)
                        .FirstOrDefaultAsync(cancellation);
                        
                    if (latest != null)
                    {
                        lastUsagesDict[pk] = latest;
                    }
                }

                var peerPublicKeySelector = (Expression<Func<ConfPeer, string>>)(p => p.PublicKey);
                var peerPredicate = BuildContainsExpression(peerPublicKeySelector, publicKeys);

                var dbPeersDict = await context.ConfPeers
                    .Where(peerPredicate)
                    .ToDictionaryAsync(p => p.PublicKey, cancellation);

                var newEntries = new List<UsageHistory>();

                foreach (var peer in peers)
                {
                    if (!peer.LatestHandshake.HasValue)
                    {
                        continue;
                    }

                    if (!dbPeersDict.TryGetValue(peer.PublicKey, out var dbPeer))
                    {
                        continue; // Evita FK violation: se il peer non è nel DB, ignoralo
                    }

                    // Aggiorna il DB solo se WireGuard restituisce un handshake valido E più recente di quello salvato
                    if (peer.LatestHandshake.Value > (dbPeer.LastHandShake ?? DateTime.MinValue))
                    {
                        dbPeer.LastHandShake = peer.LatestHandshake.Value;
                    }

                    var usageHistory = new UsageHistory
                    {
                        PublicKey = peer.PublicKey,
                        RxBytesRaw = peer.RxBytes,
                        TxBytesRaw = peer.TxBytes,
                        Timestamp = DateTime.UtcNow
                    };

                    if (lastUsagesDict.TryGetValue(peer.PublicKey, out var lastUsage) && lastUsage != null)
                    {
                        // Gestione del reset del contatore di Wireguard (se i byte correnti sono minori dei precedenti)
                        usageHistory.DeltaRxBytes = peer.RxBytes >= lastUsage.RxBytesRaw
                            ? peer.RxBytes - lastUsage.RxBytesRaw
                            : peer.RxBytes;

                        usageHistory.DeltaTxBytes = peer.TxBytes >= lastUsage.TxBytesRaw
                            ? peer.TxBytes - lastUsage.TxBytesRaw
                            : peer.TxBytes;
                    }
                    else
                    {
                        // Se è la prima volta (nessun record precedente), 
                        // il delta equivale all'intero ammontare finora scaricato.
                        usageHistory.DeltaRxBytes = peer.RxBytes;
                        usageHistory.DeltaTxBytes = peer.TxBytes;
                    }

                    if(usageHistory.DeltaRxBytes > 0 || usageHistory.DeltaTxBytes > 0)
                    {
                        newEntries.Add(usageHistory);
                    }
                    
                }

                // Batch insert e salvataggio per singolo server
                if (newEntries.Count > 0)
                {
                    await context.UsageHistories.AddRangeAsync(newEntries, cancellation);         
                }

                await context.SaveChangesAsync(cancellation);

            }

        }

        private static System.Linq.Expressions.Expression<Func<TElement, bool>> BuildContainsExpression<TElement, TValue>(
            System.Linq.Expressions.Expression<Func<TElement, TValue>> valueSelector, IEnumerable<TValue> values)
        {
            var parameterExpression = valueSelector.Parameters.Single();
            if (!values.Any()) return e => false;
            var equals = values.Select(value => (System.Linq.Expressions.Expression)System.Linq.Expressions.Expression.Equal(
                valueSelector.Body, 
                System.Linq.Expressions.Expression.Constant(value, typeof(TValue))));
            var body = equals.Aggregate<System.Linq.Expressions.Expression>((accumulate, equal) => System.Linq.Expressions.Expression.OrElse(accumulate, equal));
            return System.Linq.Expressions.Expression.Lambda<Func<TElement, bool>>(body, parameterExpression);
        }

    }
}
