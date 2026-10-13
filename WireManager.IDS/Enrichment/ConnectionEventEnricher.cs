using Docker.DotNet.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using WireManager.Core.Data;
using WireManager.IDS.Models;

namespace WireManager.IDS.Enrichment
{
    public class ConnectionEventEnricher(IServiceScopeFactory scopeFactory, ILogger<ConnectionEventEnricher> logger)
    {

        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly ILogger<ConnectionEventEnricher> _logger = logger;

        public async Task EnricherAsync(NetworkConnectionEvent netEvent)
        {
            using var scope = _scopeFactory.CreateScope();

            var dbContext = scope.ServiceProvider.GetRequiredService<WireManagerContext>();

            var peer = await dbContext.ConfPeers
                .FirstOrDefaultAsync(p =>
                    p.Address == netEvent.SourceIP ||
                    p.Address.StartsWith(netEvent.SourceIP + "/"));

            if (peer is null)
            {
                netEvent.IsAclAuthorized = false;
                return;
            }

            netEvent.PeerId = peer.Id;

            var hasPorts = netEvent.Protocol.ToLowerInvariant() is "tcp" or "udp";

            var isAllowed = await dbContext.PeerTags
                .Where(pt => pt.PeerId == peer.Id)
                .SelectMany(pt => pt.Tag.TagServices)
                .AnyAsync(ts =>
                    ts.Service.TargetIp == netEvent.DestinationIP &&
                    ts.Service.Protocol == netEvent.Protocol &&
                    (
                        !hasPorts ||
                        ts.Service.Port == netEvent.DestinationPort
                    )
                );

            netEvent.IsAclAuthorized = isAllowed;

            _logger.LogInformation(
                "[ENRICHER] PeerId={PeerId}, Destination={IP}, Port={Port}, Protocol={Protocol}",
                peer.Id,
                netEvent.DestinationIP,
                netEvent.DestinationPort,
                netEvent.Protocol
            );

            return;

        }

    }
}
