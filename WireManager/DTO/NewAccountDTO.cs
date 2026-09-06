using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class NewAccountDTO
    {
        [Required]
        [StringLength(50, MinimumLength = 3)]
        public string Username { get; set; }

        [Required]
        [StringLength(128, MinimumLength = 8)]
        public string Password { get; set; }

        [Required]
        public string Role { get; set; }

    }
}
