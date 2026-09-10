using System;
using System.Collections.Generic;
using System.Text;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface IAuditServices
    {
        Task AuditLog(string action, string entity, string? entityId, bool isSuccess, string? details);

        Task<List<Audit>> GetAuditLogs(int pageNumber, int pageSize);
    }
}
