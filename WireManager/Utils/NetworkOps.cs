using System.Net;
using System.Net.Sockets;

namespace WireManager.Core.Utils
{
    public class NetworkOps
    {

        public static bool IsInSameSubnet(string ip, string CIDR)
        {
            string[] parts = CIDR.Split('/');
            if (parts.Length != 2)
            {
                throw new ArgumentException("CIDR non valido");
            }
            string networkAddress = parts[0];
            int prefixLength = int.Parse(parts[1]);
            if (prefixLength < 0 || prefixLength > 32)
            {
                throw new ArgumentException("Prefix length non valido");
            }
            uint ipInt = IPToUInt32(ip);
            uint networkInt = IPToUInt32(networkAddress);
            uint mask = ~(uint.MaxValue >> prefixLength);
            return (ipInt & mask) == (networkInt & mask);
        }

        private static uint IPToUInt32(string ip)
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                throw new ArgumentException("IP non valido", nameof(ip));
            }

            IPAddress addr;
            if (!IPAddress.TryParse(ip, out addr))
            {
                throw new FormatException($"IP non valido: {ip}");
            }

            byte[] bytes = addr.GetAddressBytes();
            if (bytes.Length != 4)
            {
                throw new ArgumentException("Solo IPv4 supportato", nameof(ip));
            }

            // GetAddressBytes() restituisce gli ottetti in ordine di rete (big-endian)
            return ((uint)bytes[0] << 24) | ((uint)bytes[1] << 16) | ((uint)bytes[2] << 8) | bytes[3];
        }

        
        public static bool IsValidCidrIp(string cidrInput)
        {
            if (string.IsNullOrWhiteSpace(cidrInput))
                return false;

            string[] parts = cidrInput.Split('/');
            if (parts.Length != 2)
                return false;

            string ipPart = parts[0];
            string maskPart = parts[1];

        
            if (!IPAddress.TryParse(ipPart, out IPAddress? parsedAddress))
                return false;

           
            if (parsedAddress.AddressFamily != AddressFamily.InterNetwork)
                return false;

            if (!int.TryParse(maskPart, out int mask) || mask < 0 || mask > 32)
                return false;

            return true;
        }

        public static bool TryParseEndpoint(string endpoint, int defaultPort, out string cleanEndpoint)
        {
            cleanEndpoint = string.Empty;
            if (string.IsNullOrWhiteSpace(endpoint)) return false;

            // Rimuoviamo spazi bianchi accidentali
            endpoint = endpoint.Trim();

            // Aggiungiamo un prefisso fittizio per usare il parser nativo di Uri
            string urlToParse = endpoint.Contains("://") ? endpoint : $"udp://{endpoint}";

            if (Uri.TryCreate(urlToParse, UriKind.Absolute, out Uri? uri))
            {
                string host = uri.Host;

                // Se uri.Port è -1 significa che l'utente non ha messo la porta (es. "netrod.xyz")
                // In tal caso usiamo la porta di default del server
                int port = uri.Port;
                if (port == -1)
                {
                    port = defaultPort;
                }

                // Verifica che la porta sia nel range valido di rete
                if (port > 0 && port <= 65535 && !string.IsNullOrEmpty(host))
                {
                    // Ricomponiamo l'endpoint finale corretto nel formato "host:porta"
                    cleanEndpoint = $"{host}:{port}";
                    return true;
                }
            }

            return false;
        }

    }
}
