using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;
using WireManager.Core.Data;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.Core.Services
{
    public class SSOServices : ISSOServices
    {

        private readonly WireManagerContext _context;
        private readonly IAuditServices _auditServices;
        private readonly IOptionsMonitorCache<OpenIdConnectOptions> _oidcOptionCache;
        private readonly ITokenServices _tokenServices;

        public SSOServices(WireManagerContext context, IConfiguration configuration, IAuditServices auditServices, IOptionsMonitorCache<OpenIdConnectOptions> oidcOptionCache, ITokenServices tokenServices)
        {
            _context = context;
            _auditServices = auditServices;
            _oidcOptionCache = oidcOptionCache;
            _tokenServices = tokenServices;
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

                if (existingUsernames.Contains(baseUsername))
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
                    Token = await _tokenServices.GenerateJWTToken(newUser, 1),
                    Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                };

            }

            // user exists, log the login event

            var existingAppUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == existingUserIdentity.UserUUID);

            if (existingAppUser == null)
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
                Token = await _tokenServices.GenerateJWTToken(existingAppUser, 1),
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
                Token = await _tokenServices.GenerateJWTToken(user),
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };
        }
    }
}
