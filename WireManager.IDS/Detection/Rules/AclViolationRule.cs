using Microsoft.Extensions.Logging;
using WireManager.IDS.Interfaces;
using WireManager.IDS.Models;

namespace WireManager.IDS.Detection.Rules
{
    public class AclViolationRule(ILogger<AclViolationRule> logger) : IDetectionRule
    {

        private readonly ILogger<AclViolationRule> _logger = logger;

        public string Name => "Acl Violation";
        private const int AclViolationThreshold = 2;

        public IEnumerable<DetectionResult> Evaluate(
            IReadOnlyList<NetworkConnectionEvent> connectionEvents)
        {
            var violations = connectionEvents
                .Where(e =>
                    e.EventType == ConnectionEventType.New &&
                    e.PeerId.HasValue &&
                    e.IsAclAuthorized == false)
                .ToList();

            if (violations.Count >= AclViolationThreshold)
            {

                _logger.LogWarning(
                    "[ACL VIOLATION RULE] Detected {Count} ACL violations for PeerId {PeerId}.",
                    violations.Count,
                    violations[0].PeerId);


                yield return new DetectionResult
                {
                    PeerId = violations[0].PeerId!.Value,
                    RuleName = Name,
                    Description =
                        $"ACL violation detected. " +
                        $"Unauthorized connection attempts: {violations.Count}.",
                    Severity = DetectionSeverity.High,
                    Timestamp = DateTime.UtcNow,
                    EventCount = violations.Count
                };
            }
        }
    }
}
