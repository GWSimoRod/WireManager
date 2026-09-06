namespace WireManager.Core.Models
{
    public class PeerTag
    {

        public int PeerId { get; set; }
        public ConfPeer Peer { get; set; }

        public int TagId { get; set; }
        public Tag Tag { get; set; }

    }
}
