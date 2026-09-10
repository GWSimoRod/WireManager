using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.Core.Services
{
    public class AuditServices(IHttpContextAccessor contextAccessor) : IAuditServices
    {
        private readonly IHttpContextAccessor _contextAccessor = contextAccessor;

        public async Task AuditLog(string action, string entity, string? entityId, bool isSuccess, string? details)
        {

            var user = _contextAccessor.HttpContext?.User;

            var actorId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var actorType = user?.FindFirst(ClaimTypes.Role)?.Value;

            // create a new Audit entry

            Audit auditEntry = new Audit
            {
                Action = action,
                Entity = entity,
                EntityId = entityId,
                IsSuccess = isSuccess,
                Timestamp = DateTime.UtcNow,
                ActorId = actorId ?? "System",
                ActorType = actorType ?? "System",
                Details = details
            };

            using(var context = new WireManagerContext())
            { 
                await context.Audits.AddAsync(auditEntry);
                await context.SaveChangesAsync();
            }

            return;

        }

        public async Task<List<Audit>> GetAuditLogs(int pageNumber, int pageSize)
        {
            using (var context = new WireManagerContext())
            {
                var audits = await context.Audits
                    .OrderByDescending(a => a.Timestamp)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();
                return audits;
            }
        }

    }
}
