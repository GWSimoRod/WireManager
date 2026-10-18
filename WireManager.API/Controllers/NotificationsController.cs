using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WireManager.API.Attributes;
using WireManager.Core.Data;
using WireManager.Core.Domain;
using WireManager.Core.Interfaces;

namespace WireManager.API.Controllers
{
    [ApiController]
    [Route("api/notifications")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
    [RequireSetup]
    public class NotificationsController(
        INotificationServices notifications,
        WireManagerContext context) : ControllerBase
    {
        private Task<int?> GetUserIdAsync() => context.Users.AsNoTracking()
            .Where(u => u.UUID == User.FindFirstValue(ClaimTypes.NameIdentifier))
            .Select(u => (int?)u.Id)
            .SingleOrDefaultAsync(HttpContext.RequestAborted);

        [HttpGet]
        public async Task<IActionResult> GetAsync()
        {
            var userId = await GetUserIdAsync();
            if (userId is null) return Unauthorized();

            var items = await notifications.GetUserNotificationsAsync(userId.Value);
            // Esporre solo il contenuto della notifica, mai l'entita Users.
            return Ok(items.Select(item => new
            {
                id = item.NotificationId,
                item.Notification.Title,
                item.Notification.Message,
                item.Notification.Type,
                item.Notification.Severity,
                createdAt = DateTime.SpecifyKind(item.Notification.CreatedAt, DateTimeKind.Utc),
                item.Notification.ServerId,
                item.IsRead,
                readAt = item.ReadAt.HasValue
                    ? DateTime.SpecifyKind(item.ReadAt.Value, DateTimeKind.Utc)
                    : (DateTime?)null
            }));
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCountAsync()
        {
            var userId = await GetUserIdAsync();
            if (userId is null) return Unauthorized();
            return Ok(new { count = await notifications.GetUnreadCountAsync(userId.Value) });
        }

        [HttpPatch("{notificationId:int:min(1)}/read")]
        public async Task<IActionResult> MarkAsReadAsync(int notificationId)
        {
            var userId = await GetUserIdAsync();
            if (userId is null) return Unauthorized();
            await notifications.MarkAsReadAsync(userId.Value, notificationId);
            return NoContent();
        }

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllAsReadAsync()
        {
            var userId = await GetUserIdAsync();
            if (userId is null) return Unauthorized();
            await notifications.MarkAllAsReadAsync(userId.Value);
            return NoContent();
        }
    }
}
