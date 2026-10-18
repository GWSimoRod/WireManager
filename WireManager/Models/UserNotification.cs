namespace WireManager.Core.Models
{
    public class UserNotification
    {
        public int Id { get; set; }
        public Users User { get; set; }
        public int UserId { get; set; }
        public int NotificationId { get; set; }
        public Notification Notification { get; set; }
        public bool IsRead { get; set; } = false;
        public DateTime? ReadAt { get; set; }
    }
}
