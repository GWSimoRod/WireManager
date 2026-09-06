using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class PeerRequestDTO
    {
        [Required]
        [StringLength(100)]
        public String ClientName { get; set; }

        public String? Address { get; set; }

        public String DNSAddress { get; set; }

        [Required]
        public String AllowedIPs { get; set; }

        [Range(0, int.MaxValue)]
        public int? PersistentKeepAlive { get; set; }

        public DateTime? ExpireAt { get; set; }

        [Range(1, int.MaxValue)]
        public int? ConfServerId { get; set; }

    }
}
