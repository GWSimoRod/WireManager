using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequireSetup]
    public class ServerController(IServerServices ServerServices, IWireguardOps wireguard) : ControllerBase
    {

        private readonly IServerServices _serverServices = ServerServices;
        private readonly IWireguardOps _wireguard = wireguard;

        [HttpGet]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetServers()
        {
            try
            {
                var servers = await _serverServices.GetAllServerAsync();
                return Ok(servers);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }

        [HttpGet("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetServerById(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var server = await _serverServices.GetServerByIdAsync(id);
                if (server == null)
                {
                    return NotFound();
                }
                return Ok(server);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }

        [HttpPost]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> CreateServer(ServerRequestDTO serverRequest)
        {
            try
            {
                ConfServer server = await _serverServices.CreateServerAsync(serverRequest);
                Console.WriteLine("Server creato: " + server.Id);
                return Ok(server);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }

        [HttpDelete("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> DeleteServer(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                await _serverServices.DeleteServerAsync(id);
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> UpdateServer(int id, ServerRequestDTO serverRequest)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                ConfServer server = await _serverServices.UpdateServerAsync(id, serverRequest);
                return Ok(server);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id}/sync")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> SyncServer(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                bool status = await _wireguard.SyncServerAsync(id);
                if (status)
                {
                    return Ok();
                }

                return BadRequest("Error during server synchronization.");

            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
    }
}
