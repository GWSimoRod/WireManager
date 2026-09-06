namespace WireManager.Core.Models
{
    public class UsageHistory
    {
        public int Id { get; set; }
        public string PublicKey { get; set; } = String.Empty;

        // valori grezzi letti
        public long RxBytesRaw { get; set; }
        public long TxBytesRaw { get; set; }

        // consumo effettivo calcolato
        public long DeltaTxBytes { get; set; }
        public long DeltaRxBytes { get; set; }
        public DateTime Timestamp { get; set; }

        // relazione molti-a-uno con ConfPeer
        public virtual ConfPeer? Peer { get; set; }
    }
}
