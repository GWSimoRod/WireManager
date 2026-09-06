using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class ServerRequestDTO
    {
        [Range(0, int.MaxValue)]
        public int Id { get; set; }

        [Required]
        [RegularExpression(@"^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}(\/([0-9]|[1-2][0-9]|3[0-2]))?$", ErrorMessage = "Formato CIDR/IP non valido")]
        public String rangeIP { get; set; }

        [Required]
        [Range(1, 65535)]
        public int listenPort { get; set; }

        [Required]
        [StringLength(255)]
        public String EndPoint { get; set; }


    }
}
