using System;
using System.Collections.Generic;
using System.Text;

namespace WireManager.Core.Models
{
    public class AutomaticBackup
    {
        public int Id { get; set; }
        public bool Enabled { get; set; }
        public string Password { get; set; } = string.Empty;
        public int retention { get; set; }
        public TimeOnly Schedule { get; set; }
    }
}
