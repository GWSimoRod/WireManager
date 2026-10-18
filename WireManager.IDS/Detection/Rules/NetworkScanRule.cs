using Microsoft.Extensions.Logging;
using WireManager.IDS.Interfaces;
using WireManager.IDS.Models;

namespace WireManager.IDS.Detection.Rules
{
    public class NetworkScanRule(ILogger<NetworkScanRule> logger) : IDetectionRule
    {

        private readonly ILogger<NetworkScanRule> _logger = logger;

        public string Name => "Network Scanning";

        private const int IPScanThreshold = 15;

        public IEnumerable<DetectionResult> Evaluate(
            IReadOnlyList<NetworkConnectionEvent> connectionEvents)
        {

            var onlyNew = connectionEvents
                .Where(e =>
                    e.EventType == ConnectionEventType.New &&
                    e.PeerId.HasValue &&
                    e.DestinationIP != null)
                .ToList();

            var grouped = onlyNew.GroupBy(e => new
            {
                e.PeerId,
                e.SourceIP
            });

            foreach (var group in grouped)
            {
                int uniqueDestIps = group
                    .Select(e => e.DestinationIP)
                    .Distinct()
                    .Count();

                if (uniqueDestIps >= IPScanThreshold)
                {

                    _logger.LogWarning(
                        "Network scanning detected from {SourceIP}. Unique destination IPs: {UniqueDestIps}.",
                        group.Key.SourceIP,
                        uniqueDestIps);

                    yield return new DetectionResult
                    {
                        PeerId = group.Key.PeerId!.Value,
                        RuleName = Name,
                        Description =
                            $"Network scanning detected from {group.Key.SourceIP} " +
                            $"Unique destination IPs: {uniqueDestIps}.",
                        Severity = DetectionSeverity.High,
                        Timestamp = DateTime.UtcNow,
                        EventCount = group.Count()
                    };
                }
            }



        }

    }
}
