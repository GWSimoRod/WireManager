using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WireManager.Core.Domain;

namespace WireManager.API.Hubs
{
    [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme,
        Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
    public class NotificationHub : Hub
    {
        public const string Route = "/hubs/notifications";
        public const string NotificationReceived = "NotificationReceived";

        // SignalR usa ClaimTypes.NameIdentifier (Users.UUID) per Clients.Users.
        // Nessun metodo pubblico consente al client di scegliere altri destinatari.
    }
}
