using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class RuleFirewallDTO
    {
        // L'IP del client WireGuard (sorgente)
        [Required]
        [RegularExpression(@"^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$|^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$", ErrorMessage = "Formato IP non valido")]
        public string SrcIp { get; set; } = string.Empty;

        // L'IP del servizio a cui vuole accedere (destinazione)
        [Required]
        [RegularExpression(@"^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$|^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$", ErrorMessage = "Formato IP non valido")]
        public string DestIp { get; set; } = string.Empty;

        // La porta del servizio
        [Range(1, 65535)]
        public int Port { get; set; }

        // Il protocollo (di default "tcp", oppure "udp")
        [Required]
        [RegularExpression("^(tcp|udp)$", ErrorMessage = "Protocollo deve essere tcp o udp")]
        public string Protocol { get; set; } = "tcp";
    }
}
