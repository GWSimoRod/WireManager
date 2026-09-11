namespace WireManager.Core.Models
{
    public class UserIdentity
    {
        public int Id { get; set; }
        public string UserUUID { get; set; }
        public string Provider { get; set; }
        public string Issuer { get; set; }
        public string Subject { get; set; }
    }
}
