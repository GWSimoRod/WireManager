using WireManager.Core.Models;

namespace WireManager.Core.BackupModels
{

    public class DatabaseBackup
    {
        public List<ConfServer> Servers { get; set; } = [];

        public List<ConfPeer> Peers { get; set; } = [];

        public List<Tag> Tags { get; set; } = [];

        public List<Service> Services { get; set; } = [];

        public List<PeerTag> PeerTags { get; set; } = [];

        public List<TagService> TagServices { get; set; } = [];

        public List<Users> Users { get; set; } = [];

        public List<UserIdentity> UserIdentities { get; set; } = [];

        public List<SystemConfig> SystemConfig { get; set; } = [];

        public List<Audit> Audits { get; set; } = [];
    }
}
