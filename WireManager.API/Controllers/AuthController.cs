using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [RequireSetup]
    public class AuthController : ControllerBase
    {
        private readonly IAuthServices _authServices;
        private readonly ISSOServices _ssoServices;
        private readonly IMFAServices _mfaServices;

        public AuthController(IAuthServices authServices, ISSOServices sSOServices, IMFAServices mFAServices)
        {
            _authServices = authServices;
            _ssoServices = sSOServices;
            _mfaServices = mFAServices;
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
                return BadRequest(ex.Message);
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
                Console.WriteLine("[Auth]: Errore durante l'operazione: " + ex.Message);
                return BadRequest(ex.Message);
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
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("users/{uuid}/role/{role}")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> UpdateRoleAccount(string uuid, string role)
        {
            if (!Guid.TryParse(uuid, out _)) return BadRequest("Invalid UUID format.");
            if (role != AppRoles.Admin && role != AppRoles.Operator && role != AppRoles.Disabled) return BadRequest("Invalid role.");

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
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("sso")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> GetSSOConfiguration()
        {
            try
            {
                var ssoConfig = await _ssoServices.GetSSOConfiguration();
                if (ssoConfig == null)
                {
                    return NotFound("SSO configuration not found.");
                }
                return Ok(ssoConfig);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Recupero configurazione SSO fallito: " + ex.Message);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("sso")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> UpdateSSOConfiguration([FromBody] AuthenticationSSO ssoConfig)
        {
            try
            {
                await _ssoServices.UpdateSSOConfiguration(ssoConfig);
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Aggiornamento configurazione SSO fallito: " + ex.Message);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("sso/status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSSOStatus()
        {
            try
            {
                var settings = await _ssoServices.GetSSOConfiguration();
                return Ok(new { enabled = settings?.OidcEnabled ?? false });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Verifica stato SSO fallita: " + ex.Message);
                return Ok(new { enabled = false });
            }
        }

        [HttpGet("sso/login")]
        [AllowAnonymous]
        public async Task<IActionResult> SSOLogin()
        {
            try
            {
                // controllo se l'SSO è abilitato
                var settings = await _ssoServices.GetSSOConfiguration();

                if(settings == null || !settings.OidcEnabled)
                {
                    return BadRequest("SSO is not enabled.");
                }

                return Challenge(
                    new AuthenticationProperties
                    {
                        RedirectUri = "/api/auth/sso/callback"
                    },
                    OpenIdConnectDefaults.AuthenticationScheme
                );

            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Autenticazione SSO fallita, ex: " + ex);
                return Unauthorized(ex.Message);
            }
        }

        [HttpGet("sso/callback")]
        [Authorize(AuthenticationSchemes = "OidcCookie")]
        public async Task<IActionResult> SSOCallback()
        {
            try
            {
                var result = await HttpContext.AuthenticateAsync("OidcCookie");

                if (!result.Succeeded || result.Principal == null)
                {
                    return Unauthorized("SSO authentication failed.");
                }

                var issuer = result.Properties?.Items.TryGetValue(
                    "oidc_issuer",
                    out var value
                ) == true
                    ? value
                    : null;

                if (string.IsNullOrWhiteSpace(issuer))
                {
                    return Unauthorized("Invalid SSO identity: missing issuer.");
                }

                var identity = result.Principal.Identity as ClaimsIdentity;

                if (identity == null)
                {
                    return Unauthorized("Invalid SSO identity.");
                }

                identity.AddClaim(new Claim("iss", issuer));

                var authSSOResponse = await _ssoServices.LoginSSO(
                    result.Principal
                );

                // Take url from environment variable

                var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL")?.TrimEnd('/') ?? "http://localhost:3000";

                return Redirect($"{frontendUrl}/sso-login?token=" + authSSOResponse.Token);

            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Callback SSO fallita, ex: " + ex);
                return Unauthorized(ex.Message);
            }
        }

        [HttpGet("sso/exchange")]
        [Authorize(Roles = AppRoles.SSO_Exchange)]
        public async Task<IActionResult> ExchangeJWT()
        {
            try
            {

                var userUUID = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (userUUID == null)
                    return Unauthorized();

                var authResponse = await _ssoServices.ExchangeJWTToken(userUUID);
                return Ok(authResponse);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Exchange one-time code fallito, ex: " + ex);
                return Unauthorized(ex.Message);
            }
        }

        [HttpPost("mfa/enable")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> EnableMfa()
        {
            try
            {
                var responseMfa = await _mfaServices.AddNewMfa();
                return Ok(responseMfa);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Abilitazione MFA fallita, ex: " + ex);
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("mfa/disable")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> DisableMfa()
        {
            try
            {
                await _mfaServices.DisableMfa();
                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Disabilitazione MFA fallita, ex: " + ex);
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("mfa/verify")]
        [Authorize(Roles = AppRoles.MFA)]
        public async Task<IActionResult> VerifyMfa([FromBody] MfaVerifyDTO mfaVerify)
        {
            try
            {
                var token = await _mfaServices.VerifyMfa(mfaVerify.Code);

                return Ok(token);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Verifica MFA fallita, ex: " + ex);
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("mfa/enabled")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> EnabledMfa()
        {
            try
            {
                var isEnabled = await _mfaServices.IsMfaEnabled();

                return Ok(isEnabled);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Auth]: Recupero stato MFA fallito, ex: " + ex);
                return BadRequest(ex.Message);
            }
        }

    }
}
