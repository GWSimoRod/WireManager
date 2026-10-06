using WireManager.IDS.Models;

namespace WireManager.IDS.Parsers
{
    public static class ConntrackParsers
    {

        public static NetworkConnectionEvent? ParseConntrackLine(string line)
        {
            var parts = line.Split(
                ' ',
                StringSplitOptions.RemoveEmptyEntries
            );

            if (parts.Length < 2)
                return null;

            var eventType = parts[0] switch
            {
                "[NEW]" => ConnectionEventType.New,
                "[UPDATE]" => ConnectionEventType.Update,
                "[DESTROY]" => ConnectionEventType.Destroy,
                _ => throw new ArgumentException(
                    $"Tipo di evento sconosciuto: {parts[0]}"
                )
            };

            var protocol = parts[1];

            var sourceIp = parts
                .FirstOrDefault(p => p.StartsWith("src="))
                ?.Substring(4);

            var destinationIp = parts
                .FirstOrDefault(p => p.StartsWith("dst="))
                ?.Substring(4);

            var sourcePortString = parts
                .FirstOrDefault(p => p.StartsWith("sport="))
                ?.Substring(6);

            var destinationPortString = parts
                .FirstOrDefault(p => p.StartsWith("dport="))
                ?.Substring(6);

            if (sourceIp == null || destinationIp == null)
                return null;

            int? sourcePort =
                int.TryParse(sourcePortString, out var sport)
                    ? sport
                    : null;

            int? destinationPort =
                int.TryParse(destinationPortString, out var dport)
                    ? dport
                    : null;

            return new NetworkConnectionEvent
            {
                EventType = eventType,
                Protocol = protocol,
                SourceIP = sourceIp,
                SourcePort = sourcePort,
                DestinationIP = destinationIp,
                DestinationPort = destinationPort
            };
        }

    }
}
