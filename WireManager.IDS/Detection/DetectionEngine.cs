using System.Collections;
using WireManager.IDS.Interfaces;
using WireManager.IDS.Models;

namespace WireManager.IDS.Detection
{
    public class DetectionEngine(IEnumerable<IDetectionRule> rules) : IDetectionEngine
    {

        private readonly IEnumerable<IDetectionRule> _rules = rules;

        public IReadOnlyList<DetectionResult> Analyze(
            IReadOnlyList<NetworkConnectionEvent> events)
        {
            List<DetectionResult> results = new();

            foreach (var rule in _rules)
            {
                results.AddRange(rule.Evaluate(events));
            }

            return results;
        }

    }
}
