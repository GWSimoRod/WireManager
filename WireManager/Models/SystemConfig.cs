using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.Models
{
    public class SystemConfig
    {

        [Key]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        [Required]
        public string Value { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    }
}
