using Microsoft.AspNetCore.SignalR;
using WireManager.API.Hubs;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.API.Services
{
    public class SignalServices(
        IHubContext<NotificationHub> hubContext,
        ILogger<SignalServices> logger) : ISignal
    {
        public async Task SendNotificationAsync(Notification notification, IReadOnlyList<string> userUuids)
        {
            if (userUuids.Count == 0)
                return;

            try
            {
                await hubContext.Clients.Users(userUuids)
                    .SendAsync(NotificationHub.NotificationReceived, notification);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Notifica {NotificationId} salvata, ma invio SignalR non riuscito.",
                    notification.Id);
            }
        }
    }
}
