using Docker.DotNet.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WireManager.Core.Data;
using WireManager.IDS.Models;

namespace WireManager.IDS.Enrichment
{
    public class ConnectionEventEnricher(IServiceScopeFactory scopeFactory)
    {

        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

        public async Task EnricherAsync(NetworkConnectionEvent netEvent)
        {
            using var scope = _scopeFactory.CreateScope();

            var dbContext = scope.ServiceProvider.GetRequiredService<WireManagerContext>();

            var peer = await dbContext.ConfPeers
            .FirstOrDefaultAsync(
                p => p.Address == netEvent.SourceIP);

            if (peer is null)
            {
                netEvent.IsAclAuthorized = false;
                return;
            }

            netEvent.PeerId = peer.Id;

            var isAllowed = await dbContext.PeerTags
                .Where(pt => pt.PeerId == peer.Id)
                .SelectMany(pt => pt.Tag.TagServices)
                .AnyAsync(ts =>
                    ts.Service.TargetIp == netEvent.DestinationIP &&
                    ts.Service.Port == netEvent.DestinationPort &&
                    ts.Service.Protocol == netEvent.Protocol);

            netEvent.IsAclAuthorized = isAllowed;

            return;

        }

    }
}
