using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class PolicyDTO
    {
        [Required]
        [Range(1, int.MaxValue)]
        public int TagID { get; set; }
        
        [Required]
        [MinLength(1, ErrorMessage = "Almeno un servizio deve essere selezionato")]
        public List<int> ServiceId { get; set; }

    }
}
