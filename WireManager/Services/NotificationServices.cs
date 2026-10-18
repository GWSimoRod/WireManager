using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace WireManager.Core.Services
{
    public class NotificationServices(WireManagerContext context, ISignal signal) : INotificationServices
    {

        private readonly WireManagerContext _context = context;
        private readonly ISignal _signal = signal;

        public async Task CreateAsync(Notification notification)
        {
            var usersToNotify = await _context.Users
                .Where(u =>
                    u.Role == notification.GetUserType ||
                    (notification.UserType == UserType.Both &&
                     (u.Role == "Admin" || u.Role == "Operator")))
                .Select(u => new { u.Id, u.UUID })
                .ToListAsync();

            _context.Notifications.Add(notification);

            var userNotifications = usersToNotify.Select(user => new UserNotification
            {
                UserId = user.Id,
                Notification = notification
            });

            _context.UserNotifications.AddRange(userNotifications);

            await _context.SaveChangesAsync();

            await _signal.SendNotificationAsync(notification,
                usersToNotify.Select(user => user.UUID).ToList());
        }

        public async Task<List<UserNotification>> GetUserNotificationsAsync(int userId)
        {
            return await _context.UserNotifications
                .AsNoTracking()
                .Where(un => un.UserId == userId)
                .Include(un => un.Notification)
                .OrderByDescending(un => un.Notification.CreatedAt)
                .ThenByDescending(un => un.Id)
                .ToListAsync();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.UserNotifications
                .CountAsync(un => un.UserId == userId && !un.IsRead);
        }

        public async Task MarkAsReadAsync(int userId, int notificationId)
        {
            var readAt = DateTime.UtcNow;

            await _context.UserNotifications
                .Where(un => un.UserId == userId &&
                    un.NotificationId == notificationId && !un.IsRead)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(un => un.IsRead, true)
                    .SetProperty(un => un.ReadAt, readAt));
        }

        public async Task MarkAllAsReadAsync(int userId)
        {
            var readAt = DateTime.UtcNow;

            await _context.UserNotifications
                .Where(un => un.UserId == userId && !un.IsRead)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(un => un.IsRead, true)
                    .SetProperty(un => un.ReadAt, readAt));
        }

    }
}
