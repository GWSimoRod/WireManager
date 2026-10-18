using System;
using System.Collections.Generic;
using System.Text;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface INotificationServices
    {

        public Task CreateAsync(Notification notification);

        public Task<List<UserNotification>> GetUserNotificationsAsync(int userId);

        public Task<int> GetUnreadCountAsync(int userId);

        public Task MarkAsReadAsync(int userId, int notificationId);

        public Task MarkAllAsReadAsync(int userId);


    }
}
