namespace WireManager.Core.DTO
{
    public class PeerStatsDTO
    {
        public string PublicKey { get; set; } = string.Empty;
        public DateTime? LatestHandshake { get; set; }
        public long RxBytes { get; set; }
        public long TxBytes { get; set; }

    }
}
