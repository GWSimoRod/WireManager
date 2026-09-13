namespace WireManager.Core.BackupModels
{
    public class BackupManifest
    {
        public int FormatVersion { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public string BackupId { get; set; } = Guid.NewGuid().ToString();
    }
}
