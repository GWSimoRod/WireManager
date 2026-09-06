using System.ComponentModel.DataAnnotations;

namespace WireManager.Core.DTO
{
    public class LoginRequestDTO
    {
        [Required]
        [StringLength(50)]
        public string Username { get; set; }

        [Required]
        [StringLength(128)]
        public string Password { get; set; }

    }
}
