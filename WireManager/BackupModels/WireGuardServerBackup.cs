using System;
using System.Collections.Generic;
using System.Text;

namespace WireManager.Core.BackupModels
{
    public class WireGuardServerBackup
    {
        public int Id { get; set; }

        public string PrivateKey { get; set; } = string.Empty;

    }
}
