using Microsoft.Extensions.Logging;
using WireManager.IDS.Interfaces;
using WireManager.IDS.Models;

namespace WireManager.IDS.Detection.Rules
{
    public class SensitiveAccessRule(ILogger<SensitiveAccessRule> logger) : IDetectionRule
    {

        private readonly ILogger<SensitiveAccessRule> _logger = logger;

        public string Name => "Sensitive Access";

        private static readonly HashSet<int> SensitivePorts =
        [
            22, 3389, 3306, 5432, 6379, 445, 2375
        ];

        private const int SensitiveAccessThreshold = 1;

        public IEnumerable<DetectionResult> Evaluate(
        IReadOnlyList<NetworkConnectionEvent> connectionEvents)
        {
            var suspiciousEvents = connectionEvents
                .Where(e =>
                    e.EventType == ConnectionEventType.New &&
                    e.PeerId.HasValue &&
                    e.DestinationPort.HasValue &&
                    SensitivePorts.Contains(e.DestinationPort.Value) &&
                    e.IsAclAuthorized == false)
                .ToList();

            if (suspiciousEvents.Count >= SensitiveAccessThreshold)
            {

                _logger.LogWarning(
                    "Sensitive service access detected. Attempts: {Count}.",
                    suspiciousEvents.Count);

                yield return new DetectionResult
                {
                    PeerId = suspiciousEvents[0].PeerId!.Value,
                    RuleName = Name,
                    Description =
                        $"Sensitive service access detected. " +
                        $"Attempts: {suspiciousEvents.Count}.",
                    Severity = DetectionSeverity.Critical,
                    Timestamp = DateTime.UtcNow,
                    EventCount = suspiciousEvents.Count
                };
            }
        }
    }
}
