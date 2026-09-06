using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class TagDTO
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; }

        [Required]
        [RegularExpression("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$", ErrorMessage = "Il colore deve essere in formato HEX, es: #FF0000")]
        public string Color { get; set; }

        public List<int>? ServicesId { get; set; }
    }
}
