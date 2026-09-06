using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class InitialSetupDTO
    {

        // Admin account
        [Required]
        [StringLength(50, MinimumLength = 3)]
        public string AdminUsername { get; set; }

        [Required]
        [StringLength(128, MinimumLength = 8)]
        public string AdminPassword { get; set; }

        // config software
        public bool ExecutionMode { get; set; }

        [StringLength(100)]
        public string? ContainerWireguardName { get; set; }

        [StringLength(255)]
        public string? WireGuardConfigPath { get; set; }

        [Required]
        public string FirewallEngine { get; set; } = "iptables";


    }
}
