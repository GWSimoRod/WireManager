namespace WireManager.Core.Models
{
    public class Users
    {

        public int Id { get; set; }
        public string Username { get; set; }
        public string? Password { get; set; }
        public string Role { get; set; }
        public string UUID { get; set; } = Guid.NewGuid().ToString();

        public Users(int Id, string Username, string? Password, string Role) {
            this.Id = Id;
            this.Username = Username;
            this.Password = Password;
            this.Role = Role;
        }
        public Users(string username, string? password, string role)
        {
            Username = username;
            Password = password;
            Role = role;
        }

    }
}
