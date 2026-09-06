namespace WireManager.Core.Models
{
    public class Service
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public int Port { get; set; }
        public string Protocol { get; set; }
        public string TargetIp { get; set; }
        public string? Domain { get; set; }
        public bool IsGlobal { get; set; } = false;
        public ICollection<TagService> TagServices { get; set; }  // Relazione molti-a-molti con Tag

    }
}
