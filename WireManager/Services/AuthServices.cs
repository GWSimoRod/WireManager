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
        private readonly IAuditServices _auditServices;
        private readonly ITokenServices _tokenServices;

        public AuthServices(WireManagerContext context, ILogger<AuthServices> logger, IAuditServices auditServices, IOptionsMonitorCache<OpenIdConnectOptions> oidcOptionCache, ITokenServices tokenServices) {
            _logger = logger;
            _context = context;
            _auditServices = auditServices;
            _tokenServices = tokenServices;
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

            // controllo se il mfa è attivo

            if (user.mfaEnabled)
            {
                // genero un token con role "mfa"

                var tokenMFA = await _tokenServices.GenerateJWTToken(user, role: AppRoles.MFA);

                await _auditServices.AuditLog(
                    "Auth.LoginMFA",
                    "User",
                    user.UUID,
                    true,
                    null
                );

                return new AuthResponseDTO
                {
                    Token = tokenMFA,
                    Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                };

            }

            var tokenString = await _tokenServices.GenerateJWTToken(user);

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

            // elimino anche le identità legate a questo utente se presenti

            _context.UserIdentities.RemoveRange(_context.UserIdentities.Where(ui => ui.UserUUID == user.UUID));
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

    }
}
