using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;

namespace WireManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [RequireSetup]
    public class AuthController : ControllerBase
    {
        private readonly IAuthServices _authServices;

        public AuthController(IAuthServices authServices)
        {
            _authServices = authServices;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDTO loginRequest)
        {
            try
            {
                var authResponse = await _authServices.LoginAsync(loginRequest.Username, loginRequest.Password);
                Console.WriteLine("[Auth]: Autenticazione effettuata per l'utente: " + loginRequest.Username);
                return Ok(authResponse);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Autenticazione fallita per l'utente: " + loginRequest.Username + ", ex: " + ex);
                return Unauthorized(ex.Message);
            }
        }

        [HttpPost("register")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> CreateAccount([FromBody] NewAccountDTO newAccount)
        {
            try
            {
                var create = await _authServices.CreateNewAccount(newAccount);
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Creazione di un nuovo account fallito: " + ex.Message);
                return Unauthorized(ex.Message);
            }
        }

        [HttpGet("users")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> GetAllAccount([FromQuery] int start = 0, [FromQuery] int end = 10, [FromQuery] string? searchTerm = null)
        {

            if (start < 0 || end < start) return BadRequest("Start cannot be negative and end cannot be less than start");
            if (end - start > 100) return BadRequest("Cannot request more than 100 items at a time");

            // prendo lo username dell'utente che sta facendo la richiesta
            string userUUID = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            try
            {
                var (users, totalCount) = await _authServices.GetAllUsersAsync(start, end, searchTerm, userUUID);
                Response.Headers.Append("X-Total-Count", totalCount.ToString());

                return Ok(users);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Creazione di un nuovo account fallito: " + ex.Message);
                return Unauthorized(ex.Message);
            }
        }

        [HttpDelete("users/{uuid}")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> DeleteAccount(string uuid)
        {
            if (!Guid.TryParse(uuid, out _)) return BadRequest("Invalid UUID format.");

            try
            {
                var userUuid = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userUuid)) return Unauthorized();

                var users = await _authServices.DeleteAccount(uuid, userUuid);
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Eliminazione dell'account fallito: " + ex.Message);
                return Unauthorized(ex.Message);
            }
        }

        [HttpPatch("users/{uuid}/role/{role}")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> UpdateRoleAccount(string uuid, string role)
        {
            if (!Guid.TryParse(uuid, out _)) return BadRequest("Invalid UUID format.");
            if (role != AppRoles.Admin && role != AppRoles.Operator) return BadRequest("Invalid role.");

            try
            {
                var userUuid = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userUuid)) return Unauthorized();

                var users = await _authServices.UpdateRole(uuid, role, userUuid);
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Cambio role dell'account fallito: " + ex.Message);
                return Unauthorized(ex.Message);
            }
        }
    }
}
