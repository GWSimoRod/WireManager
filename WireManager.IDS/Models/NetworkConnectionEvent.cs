namespace WireManager.IDS.Models
{
    public enum ConnectionEventType
    {
        New,
        Update,
        Destroy
    }
    public enum ConnectionAuthorization
    {
        Unknown,
        Allowed,
        Denied
    }

    public class NetworkConnectionEvent
    {

        public int Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string SourceIP { get; set; } = string.Empty;
        public int? SourcePort { get; set; }
        public string DestinationIP { get; set; } = string.Empty;
        public int? DestinationPort { get; set; }
        public string Protocol { get; set; } = string.Empty;
        public ConnectionEventType EventType { get; set; }
        public ConnectionAuthorization FirewallAuthorization { get; set; } // indica se la connessione è stata autorizzata o meno dal firewall
        public bool IsAclAuthorized { get; set; } // indica se è stato autorizzato dalle regole ACL
        public int? PeerId { get; set; }

    }
}
