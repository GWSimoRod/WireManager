using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
﻿using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Principal;
using System.Text;
using WireManager.Core.Data;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using BCryptNet = BCrypt.Net.BCrypt;

namespace WireManager.Core.Services
{
    public class AuthServices : IAuthServices
    {
        private readonly ILogger<AuthServices> _logger;
        private readonly WireManagerContext _context;
        private readonly IConfiguration _configuration;
        private readonly SymmetricSecurityKey _jwtKey;
        private readonly IAuditServices _auditServices;
        private readonly IOptionsMonitorCache<OpenIdConnectOptions> _oidcOptionCache;

        public AuthServices(WireManagerContext context, IConfiguration configuration, ILogger<AuthServices> logger, SymmetricSecurityKey jwtKey, IAuditServices auditServices, IOptionsMonitorCache<OpenIdConnectOptions> oidcOptionCache) {
            _logger = logger;
            _context = context;
            _configuration = configuration;
            _jwtKey = jwtKey;
            _auditServices = auditServices;
            _oidcOptionCache = oidcOptionCache;
        }

        public async Task<AuthResponseDTO> LoginAsync(string username, string password) {

            // validate the username and password

            if(username.Length == 0 || password.Length == 0)
            {
                await _auditServices.AuditLog(
                    "Auth.Login",
                    "User",
                    null,
                    false,
                    "Username and password cannot be empty"
                );
                throw new ArgumentException("Username and password cannot be empty");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);

            if (user == null || string.IsNullOrWhiteSpace(user?.Password) || !BCryptNet.Verify(password, user?.Password))
            {
                await _auditServices.AuditLog(
                    "Auth.Login",
                    "User",
                    user?.UUID,
                    false,
                    "Invalid username or password"
                );
                throw new ArgumentException("Invalid username or password");
            }

            // genero lo UUID se è non è presente nel db per migrazione.

            if (string.IsNullOrWhiteSpace(user.UUID))
            {
                user.UUID = Guid.NewGuid().ToString();
                await _context.SaveChangesAsync();
            }

            var tokenString = await GenerateJWTToken(user);

            // Log dell'evento di login riuscito
            await _auditServices.AuditLog(
                "Auth.Login",
                "User",
                user.UUID,
                true,
                null
            );

            // Restituiamo il DTO con il token popolato e senza errori
            return new AuthResponseDTO
            {
                Token = tokenString,
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };

        }

        public async Task<bool> CreateNewAccount(NewAccountDTO newAccountDTO)
        {
            ArgumentNullException.ThrowIfNull(newAccountDTO);

            if (string.IsNullOrWhiteSpace(newAccountDTO.Username) ||
                string.IsNullOrWhiteSpace(newAccountDTO.Password))
            {
                await _auditServices.AuditLog(
                    "Auth.Create",
                    "User",
                    null,
                    false,
                    "Username and password are mandatory"
                );
                throw new ArgumentException("Username and password are mandatory");
            }

            // Controllo validità ruolo
            if (!AppRoles.IsValid(newAccountDTO.Role))
            {
                await _auditServices.AuditLog(
                    "Auth.Create",
                    "User",
                    null,
                    false,
                    $"Role: '{newAccountDTO.Role}' is not valid."
                );
                throw new ArgumentException($"Role: '{newAccountDTO.Role}' is not valid.");
            }

            // Controllo se l'utente esiste già
            var userExists = await _context.Users
                .AnyAsync(u => u.Username.ToLower() == newAccountDTO.Username.ToLower());

            if (userExists)
            {
                await _auditServices.AuditLog(
                    "Auth.Create",
                    "User",
                    null,
                    false,
                    $"User: '{newAccountDTO.Username}' already exists."
                );
                throw new InvalidOperationException($"User: '{newAccountDTO.Username}' already exists.");
            }

            // Normalizza il ruolo per salvarlo sempre con il case corretto
            var normalizedRole = AppRoles.All
                .First(r => r.Equals(newAccountDTO.Role, StringComparison.OrdinalIgnoreCase));

            // Creazione dell'entità
            var newUser = new Users(
                newAccountDTO.Username.Trim(),
                BCrypt.Net.BCrypt.HashPassword(newAccountDTO.Password),
                normalizedRole
            );

            var addUser = _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            await _auditServices.AuditLog(
                "Auth.Create",
                "User",
                addUser.Entity.UUID,
                true,
                null
            );

            return true;
        }

        public async Task<(List<UserSafeDTO> Users, int totalCount)> GetAllUsersAsync(int start, int end, string? searchTerm, string userUUID)
        {
            try
            {

                _logger.LogInformation(userUUID);

                var query = _context.Users.AsQueryable();

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    searchTerm = searchTerm.ToLower();
                    query = query.Where(u => u.Username.ToLower().Contains(searchTerm));
                }

                int totalCount = await query.CountAsync();

                if (totalCount == 0)
                {
                    return (new List<UserSafeDTO>(), 0);
                }

                int requestedTake = end - start;
                if (requestedTake < 1) requestedTake = 10;

                if (start >= totalCount)
                {
                    start = Math.Max(0, totalCount - requestedTake);
                }

                int take = Math.Min(requestedTake, totalCount - start);

                var users = await query
                    .Where(u => u.UUID != userUUID)
                    .OrderBy(u => u.Username)
                    .Skip(start)
                    .Take(take)
                    .Select(u => new UserSafeDTO
                    (
                        u.Username,
                        u.Role,
                        u.UUID
                    ))
                    .ToListAsync();

                return (users, totalCount);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("There was a problem retrieving users");
            }
        }

        public async Task<bool> DeleteAccount(string uUID, string userUUID)
        {
            if(uUID == userUUID)
            {
                await _auditServices.AuditLog(
                    "Auth.Delete",
                    "User",
                    uUID,
                    false,
                    "You cannot delete yourself"
                );
                throw new InvalidOperationException("You cannot delete yourself");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UUID == uUID);

            if (user == null)
            {
                await _auditServices.AuditLog(
                    "Auth.Delete",
                    "User",
                    uUID,
                    false,
                    "There was not a user with this UUID: " + uUID
                );
                throw new ArgumentNullException(nameof(uUID), "There was not a user with this UUID: " + uUID);
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            await _auditServices.AuditLog(
                "Auth.Delete",
                "User",
                uUID,
                true,
                null
            );

            return true;

        }

        public async Task<bool> UpdateRole(string uUID, string role, string userUUID)
        {

            if (!AppRoles.IsValid(role))
            {
                await _auditServices.AuditLog(
                    "Auth.Update",
                    "User",
                    uUID,
                    false,
                    "This role is not valid: " + role
                );
                throw new ArgumentException(nameof(role), "This role is not valid");
            }

            if(uUID == userUUID)
            {
                await _auditServices.AuditLog(
                    "Auth.Update",
                    "User",
                    uUID,
                    false,
                    "You can't change your role"
                );
                throw new InvalidOperationException("You can't change your role");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UUID == uUID);
            if(user  == null)
            {
                await _auditServices.AuditLog(
                    "Auth.Update",
                    "User",
                    uUID,
                    false,
                    "There was not a user with this UUID: " + uUID
                );
                throw new ArgumentNullException(nameof(uUID), "There was not a user with this UUID:" + uUID);
            }

            var normalizedRole = AppRoles.All
                .First(r => r.Equals(role, StringComparison.OrdinalIgnoreCase));

            user.Role = normalizedRole;
            await _context.SaveChangesAsync();

            await _auditServices.AuditLog(
                "Auth.Update",
                "User",
                uUID,
                true,
                null
            );



            return true;

        }

        public async Task<AuthenticationSSO?> GetSSOConfiguration()
        {
            return await _context.AuthenticationSSOs
                .FirstOrDefaultAsync();
        }

        public async Task UpdateSSOConfiguration(AuthenticationSSO ssoConfig)
        {
            var existingConfig = await _context.AuthenticationSSOs.FirstOrDefaultAsync();
            if (existingConfig != null)
            {
                existingConfig.OidcEnabled = ssoConfig.OidcEnabled;
                existingConfig.OidcAuthority = ssoConfig.OidcAuthority;
                existingConfig.OidcClientId = ssoConfig.OidcClientId;
                existingConfig.OidcClientSecret = ssoConfig.OidcClientSecret;
            }
            else
            {
                await _context.AuthenticationSSOs.AddAsync(ssoConfig);
            }
            await _context.SaveChangesAsync();

            // Clear the OIDC options cache to ensure the new configuration is applied
            _oidcOptionCache.TryRemove(OpenIdConnectDefaults.AuthenticationScheme);

            await _auditServices.AuditLog(
                "Auth.UpdateSSO",
                "SSO",
                null,
                true,
                null
            );

        }

        public async Task<AuthResponseDTO> LoginSSO(ClaimsPrincipal user)
        {
            var issuer = user.FindFirst("iss")?.Value;
            var subject = user.FindFirst("sub")?.Value;

            if (string.IsNullOrWhiteSpace(issuer) ||
                string.IsNullOrWhiteSpace(subject))
            {
                await _auditServices.AuditLog(
                    "Auth.LoginSSO",
                    "User",
                    null,
                    false,
                    "Invalid SSO identity: missing issuer or subject"
                );
                throw new Exception("Invalid SSO identity.");
            }

            var existingUserIdentity = await _context.UserIdentities
                .FirstOrDefaultAsync(ui => ui.Issuer == issuer && ui.Subject == subject);

            // user does not exist, create a new one

            if (existingUserIdentity == null)
            {
                var email = user.FindFirst("email")?.Value;
                var name = user.FindFirst("name")?.Value;

                if (string.IsNullOrWhiteSpace(email) &&
                    string.IsNullOrWhiteSpace(name))
                {
                    await _auditServices.AuditLog(
                        "Auth.RegisterSSO",
                        "User",
                        null,
                        false,
                        "SSO user has no email or name"
                    );
                    throw new Exception("SSO user has no email or name.");
                }

                // controllo che l'username non esista già, altrimenti aggiungo un numero progressivo allo username per renderlo unico

                var baseUsername = email ?? name;

                var existingUsernames = await _context.Users
                    .Where(u => u.Username.StartsWith(baseUsername))
                    .Select(u => u.Username)
                    .ToListAsync();

                if(existingUsernames.Contains(baseUsername))
                {
                    int suffix = 1;
                    string newUsername;
                    do
                    {
                        newUsername = $"{baseUsername}{suffix}";
                        suffix++;
                    } while (existingUsernames.Contains(newUsername));
                    baseUsername = newUsername;
                }

                var newUser = new Users(
                    baseUsername,
                    null,
                    AppRoles.Disabled

                );

                var identity = new UserIdentity
                {
                    UserUUID = newUser.UUID,
                    Provider = "OIDC",
                    Issuer = issuer,
                    Subject = subject
                };

                _context.Users.Add(newUser);
                _context.UserIdentities.Add(identity);

                await _context.SaveChangesAsync();

                await _auditServices.AuditLog(
                    "Auth.RegisterSSO",
                    "User",
                    newUser.UUID,
                    true,
                    null
                );

                newUser.Role = AppRoles.SSO_Exchange;

                return new AuthResponseDTO
                {
                    Token = await GenerateJWTToken(newUser, 1),
                    Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                };

            }

            // user exists, log the login event
            
            var existingAppUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == existingUserIdentity.UserUUID);

            if(existingAppUser == null)
            {
                await _auditServices.AuditLog(
                    "Auth.LoginSSO",
                    "User",
                    existingUserIdentity.UserUUID,
                    false,
                    "User identity exists but no corresponding user found"
                );
                throw new Exception("User identity exists but no corresponding user found.");
            }

            await _auditServices.AuditLog(
                "Auth.LoginSSO",
                "User",
                existingAppUser.UUID,
                true,
                null
            );

            existingAppUser.Role = AppRoles.SSO_Exchange;

            return new AuthResponseDTO
            {
                Token = await GenerateJWTToken(existingAppUser, 1),
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };

        }

        public async Task<AuthResponseDTO> ExchangeJWTToken(string userUUID)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UUID == userUUID);

            if (user == null)
                throw new Exception("User not found.");

            return new AuthResponseDTO
            {
                Token = await GenerateJWTToken(user),
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };
        }

        private async Task<string> GenerateJWTToken(Users user, int duration = 120)
        {
            // genero un token di autenticazione

            var tokenHandler = new JwtSecurityTokenHandler();


            // Definiamo i dettagli (Claims) che viaggeranno criptati nel token
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                new Claim(ClaimTypes.NameIdentifier, user.UUID),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role ?? "User") // Il ruolo serve al middleware [Authorize(Roles = "Admin")]
            }),

                // Impostiamo la durata della sessione 
                Expires = DateTime.UtcNow.AddMinutes(duration),

                Issuer = "WireManager",
                Audience = "WireManagerClients",

                // Firmiamo il token con la nostra chiave simmetrica usando l'algoritmo HMAC-SHA256
                SigningCredentials = new SigningCredentials(
                    _jwtKey,
                    SecurityAlgorithms.HmacSha256Signature
                )
            };

            // Creiamo l'oggetto token ed esportiamolo come stringa pronta per il client
            var token = tokenHandler.CreateToken(tokenDescriptor);
            string tokenString = tokenHandler.WriteToken(token);

            return tokenString;
        }
    }
}
