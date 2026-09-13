using System;
using System.Collections.Generic;
using System.Text;
using WireManager.Core.BackupModels;

namespace WireManager.Core.Backup
{
    public class BackupData
    {
        public BackupManifest Manifest { get; set; } = new();
        public DatabaseBackup Database { get; set; } = new();
        public List<WireGuardServerBackup> Servers { get; set; } = [];
        public List<WireGuardPeerBackup> Peers { get; set; } = [];
    }
}
