using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using WireManager.Core.Exceptions;

namespace WireManager.Core.Models
{
    public class ConfPeer
    {

        public int Id { get; set; }
        public String ClientName { get; set; }
        [JsonIgnore]
        [NotMapped]
        public String PrivateKey { get; set; }
        public String PublicKey { get; set; }
        public String Address { get; set; }
        public String DNSAddress { get; set; }
        public String AllowedIPs { get; set; }
        public int? PersistentKeepAlive {  get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime? LastHandShake {  get; set; }
        public DateTime? ExpireAt { get; set; }

        public int ConfServerId { get; set; }
        [JsonIgnore]
        public virtual ConfServer Server { get; set; }

        public virtual ICollection<UsageHistory> UsageHistories { get; set; } = new List<UsageHistory>();
        public ICollection<PeerTag> PeerTags { get; set; }  // Relazione molti-a-molti con Tag
        protected ConfPeer() { }

        public ConfPeer(String clientName, String privateKey, String publicKey, String address, String DNSAddress, String allowedIPs, DateTime? expireAt, int? PersistenKeepAlive)
        {

            if (String.IsNullOrWhiteSpace(clientName) ||
                String.IsNullOrWhiteSpace(address) ||
                String.IsNullOrWhiteSpace(DNSAddress) ||
                String.IsNullOrWhiteSpace(allowedIPs) ||
                PersistentKeepAlive < 0)
            {
                throw new PeerEmptyException();
            }

            this.ClientName = clientName;
            this.PrivateKey = privateKey;
            this.Address = address;
            this.DNSAddress = DNSAddress;
            this.PublicKey = publicKey;
            this.AllowedIPs = allowedIPs;
            this.ExpireAt = expireAt;
            this.PersistentKeepAlive = PersistenKeepAlive;
        }

        public String GetClientName()
        {
            return ClientName;
        }

        // metodo per ottenere la configurazione del peer in formato stringa

        public String GetConfServer()
        {

            return "\n[Peer]\n" +
                "# " + ClientName + "\n" +
                "PublicKey = " + PublicKey + "\n" +
                "AllowedIPs = " + this.Address + "\n";

        }

        public String GetConfClient(ConfServer server)
        {
            string keepAliveLine = (PersistentKeepAlive > 0 && PersistentKeepAlive != null)
                ? $"PersistentKeepalive = {PersistentKeepAlive}\n"
                : $"PersistentKeepalive = 0\n";

            return "[Interface]\n" +
                "PrivateKey = " + PrivateKey + "\n" +
                "Address = " + Address + "\n" +
                "DNS = " + DNSAddress + "\n\n" + // <--- Doppio \n per staccare nettamente [Interface] e [Peer]

                "[Peer]\n" +
                "PublicKey = " + server.GetPublicKey() + "\n" +
                "Endpoint = " + server.EndPoint+ ":" + server.listenPort + "\n" +
                "AllowedIPs = " + AllowedIPs + "\n" +
                keepAliveLine;
        }

    }
}
