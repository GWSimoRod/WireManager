namespace WireManager.Core.Models
{
    public class Tag
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Color { get; set; }
        public ICollection<PeerTag> PeerTags { get; set; }
        public ICollection<TagService> TagServices { get; set; }
    }
}
