using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;
using WireManager.IDS.Interfaces;
using WireManager.IDS.Models;

namespace WireManager.IDS.Detection.Rules
{
    public class PortScanRule(ILogger<PortScanRule> logger) : IDetectionRule
    {

        private readonly ILogger<PortScanRule> _logger = logger;

        public string Name => "Port Scanning";

        private const int PortScanThreshold = 15;


        public IEnumerable<DetectionResult> Evaluate(
            IReadOnlyList<NetworkConnectionEvent> connectionEvents)
        {

            var onlyNew = connectionEvents
                .Where(e =>
                    e.EventType == ConnectionEventType.New &&
                    e.PeerId.HasValue &&
                    e.DestinationPort.HasValue)
                .ToList();

            var grouped = onlyNew.GroupBy(e => new
            {
                e.PeerId,
                e.SourceIP,
                e.DestinationIP,
                e.Protocol
            });

            foreach (var group in grouped)
            {
                int uniquePorts = group
                    .Select(e => e.DestinationPort)
                    .Distinct()
                    .Count();

                if (uniquePorts >= PortScanThreshold)
                {

                    _logger.LogWarning(
                        "Port scanning detected from {SourceIP} to {DestinationIP} ({Protocol}). Unique ports: {UniquePorts}.",
                        group.Key.SourceIP,
                        group.Key.DestinationIP,
                        group.Key.Protocol,
                        uniquePorts);

                    yield return new DetectionResult
                    {
                        PeerId = group.Key.PeerId!.Value,
                        RuleName = Name,
                        Description =
                            $"Port scanning detected from {group.Key.SourceIP} " +
                            $"to {group.Key.DestinationIP} " +
                            $"({group.Key.Protocol}). " +
                            $"Unique ports: {uniquePorts}.",
                        Severity = DetectionSeverity.High,
                        Timestamp = DateTime.UtcNow,
                        EventCount = group.Count()
                    };
                }
            }
        }
    }

}
