using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;

namespace WireManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequireSetup]
    public class PeerController(IPeerServices peerServices) : ControllerBase
    {

        private readonly IPeerServices _peerServices = peerServices;

        [HttpGet]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPeers([FromQuery] int start = 0, [FromQuery] int end = 10, [FromQuery] string? searchTerm = null)
        {
            // valido gli indici per la ricerca

            if (start < 0 || end < start) return BadRequest("Start cannot be negative and end cannot be less than start");
            if (end - start > 100) return BadRequest("Cannot request more than 100 items at a time");

            try
            {
                var (peers, totalCount) = await _peerServices.GetAllPeerAsync(start, end, searchTerm);
                Response.Headers.Append("X-Total-Count", totalCount.ToString());

                return Ok(peers);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPeerById(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var peer = await _peerServices.GetPeerByIdAsync(id);
                if (peer == null)
                {
                    return NotFound();
                }
                return Ok(peer);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);

            }
        }

        [HttpPost]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> CreatePeer(PeerRequestDTO peerRequest)
        {
            try
            {
                var peer = await _peerServices.CreatePeerAsync(peerRequest);
                Console.WriteLine("Peer creato: " + peer.ClientName);
                return Ok(peer);
            }
            catch (Exception ex)
            {

                return BadRequest(ex.Message);

            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> DeletePeer(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                bool result = await _peerServices.DeletePeerByIdAsync(id);
                if (!result)
                {
                    return NotFound();
                }

                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/conf")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPeerConf(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var conf = await _peerServices.GetPeerConfAsync(id);
                if (conf == null)
                {
                    return NotFound();
                }
                return Ok(conf);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/qrcode")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetQrCode(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                byte[] qrBytes = await _peerServices.CreateQRCODE(id);

                return File(qrBytes, "image/png");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> UpdatePeer(int id, PeerRequestDTO peerRequest)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var updatedPeer = await _peerServices.UpdatePeerAsync(id, peerRequest);
                if (!updatedPeer)
                {
                    return NotFound();
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("{id}/status/{status}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> TogglePeer(int id, bool status)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var updatedPeer = await _peerServices.TogglePeer(id, status);
                if (!updatedPeer)
                {
                    return NotFound();
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [AllowAnonymous]
        [HttpGet("authorized")]
        public async Task<IActionResult> IsPeerAuthorized()
        {
            // ottengo l'ip del client e il dominio dagli header

            string? clientIp = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
                      ?? HttpContext.Connection.RemoteIpAddress?.ToString();

            string? domain = HttpContext.Request.Headers["X-Forwarded-Host"].FirstOrDefault()
                            ?? HttpContext.Request.Host.Host;

            if (string.IsNullOrWhiteSpace(clientIp) || string.IsNullOrWhiteSpace(domain))
            {
                return BadRequest("Cannot determine client IP or target domain.");
            }

            try
            {
                var isAuthorized = await _peerServices.IsPeerAuthorizedForDomain(clientIp, domain);
                if(!isAuthorized)
                {
                    return Unauthorized();
                }
                return Ok(new { message = "Peer autorizzato per il dominio." });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id}/policies/{policyId}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> AddPolicyToPeer(int id, int policyId)
        {
            if (id <= 0 || policyId <= 0) return BadRequest("Invalid IDs.");
            try
            {
                bool result = await _peerServices.AddPolicyToPeer(id, policyId);
                if (!result)
                {
                    return NotFound();
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}/policies/{policyID}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> RemovePolicyFromPeer(int id, int policyID)
        {
            if (id <= 0 || policyID <= 0) return BadRequest("Invalid IDs.");
            try
            {
                bool result = await _peerServices.RemovePolicyFromPeer(id, policyID);
                if (!result)
                {
                    return NotFound();
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/policies")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPoliciesForPeer(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var policies = await _peerServices.GetPoliciesForPeer(id);
                if (policies == null)
                {
                    return NotFound();
                }
                return Ok(policies);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }

        [HttpGet("{id}/live-stats")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPeerStats(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var stats = await _peerServices.GetPeerStatsRealTimeAsync(id);
                if (stats == null)
                {
                    return NotFound();
                }
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}/stats")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetPeerStatsHistory(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var stats = await _peerServices.GetPeerStatsAsync(id);
                if (stats == null)
                {
                    return NotFound();
                }
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
    }
}
