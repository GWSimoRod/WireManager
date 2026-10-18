namespace WireManager.Core.Models
{
    public enum NotificationType
    {
        IDS,
        PeerExpiration,
        ServerStatus,
        Backup,
        System
    }

    public enum NotificationSeverity
    {
        Info,
        Warning,
        Critical
    }

    public enum UserType
    {
        Admin,
        Operator,
        Both
    }

    public class Notification
    {
        public int Id { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;

        public NotificationType Type { get; set; }
        public NotificationSeverity Severity { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public UserType UserType { get; set; }
        public int? ServerId { get; set; }
        public string? GetUserType => UserType switch
        {
            UserType.Admin => "Admin",
            UserType.Operator => "Operator",
            UserType.Both => "Both",
            _ => null
        };

    }

    
}
