using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WireManager.API.Attributes;
using WireManager.Core.Interfaces;

namespace WireManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [RequireSetup]
    public class AuditController(IAuditServices auditServices) : ControllerBase
    {
        private readonly IAuditServices _auditServices = auditServices;

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAuditLogs([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var audits = await _auditServices.GetAuditLogs(pageNumber, pageSize);
                return Ok(audits);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Audit]: Recupero dei log di audit fallito: " + ex.Message);
                return StatusCode(500, "Errore interno del server");
            }
        }

    }
}
