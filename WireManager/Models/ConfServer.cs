namespace WireManager.Core.Models
{
    public class ConfServer
    {
        public int Id { get; set; }
        private String privateKey { get; }
        public String publicKey { get; set; }
        public String rangeIP { get; set; }
        public int listenPort { get; set; }
        public String EndPoint { get; set; }

        public virtual ICollection<ConfPeer> Peers { get; set; }

        protected ConfServer() { }

        public ConfServer(String privateKey, String publicKey, String rangeIP, int listenPort, String endpoint)
        {
            if (String.IsNullOrWhiteSpace(rangeIP) ||
                String.IsNullOrWhiteSpace(endpoint) ||
                listenPort <= 0)
            {
                throw new Exception("Server configuration cannot be empty");
            }

            this.privateKey = privateKey;
            this.publicKey = publicKey;
            this.rangeIP = rangeIP;
            this.listenPort = listenPort;
            this.EndPoint = endpoint;
        }

        public String GetConfServer()
        {
            return "[Interface]\n" +
                "PrivateKey = " + privateKey + "\n" +
                "Address = " + rangeIP + "\n" +
                "ListenPort = " + listenPort + "\n" +
                "PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -j MASQUERADE" + "\n" +
                "PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -j MASQUERADE" + "\n";
        }

        public String GetPublicKey()
        {
            return publicKey;
        }


    }
}
