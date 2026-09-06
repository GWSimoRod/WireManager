namespace WireManager.Core.DTO
{
    public class UserSafeDTO
    {
        public string Username { get; set; }
        public string Role { get; set; }
        public string UUID { get; set; }

        public UserSafeDTO(string username, string role, string uUID)
        {
            Username = username;
            Role = role;
            UUID = uUID;
        }
    }
}
