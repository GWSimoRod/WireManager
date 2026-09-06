using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class ServiceDTO
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; }

        [Required]
        [Range(0, 65535, ErrorMessage = "La porta deve essere compresa tra 0 e 65535")]
        public int Port { get; set; }

        [Required]
        [RegularExpression(@"^(?i)(tcp|udp|sctp|icmp|esp|gre|igmp|all|any)$", ErrorMessage = "Protocollo non valido. Protocolli supportati: tcp, udp, sctp, icmp, esp, gre, igmp, all, any")]
        public string Protocol { get; set; }

        [Required]
        [RegularExpression(@"^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$|^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$", ErrorMessage = "Formato IP non valido")]
        public string TargetIp { get; set; }

        public bool IsGlobal { get; set; } = false;

        public List<int>? TagsId { get; set; }  // Lista di ID dei tag associati al servizio
        
        // per gestire Proxy

        public string? domain { get; set; }

    }
}
