using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using OtpNet;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;

namespace WireManager.Core.Services
{
    public class MFAServices(WireManagerContext context, IHttpContextAccessor httpContext, ITokenServices tokenServices, IDataProtectionProvider dataProtectionProvider) : IMFAServices
    {
        private readonly WireManagerContext _context = context;
        private readonly IHttpContextAccessor _contextAccessor = httpContext;
        private readonly ITokenServices _tokenServices = tokenServices;
        private readonly IDataProtector _dataProtector = dataProtectionProvider.CreateProtector("WireManager.MFA.Secret");
        public async Task<MfaSetupDTO> AddNewMfa()
        {

            var userId = _contextAccessor.HttpContext?
                .User
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            var isIdentity = await IsMfaEnabled();

            if (isIdentity.isIdentity)
            {
                throw new Exception("Identities cannot enable mfa");
            }

            var actUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == userId);

            if(actUser == null)
            {
                throw new Exception("User not found");
            }

            var secret = await _tokenServices.GenerateMfaSecret();

            actUser.mfaSecret = _dataProtector.Protect(secret);
            actUser.mfaEnabled = true;

            await _context.SaveChangesAsync();

            var otpauthUri =
                $"otpauth://totp/WireManager:{actUser.Username}" +
                $"?secret={secret}" +
                $"&issuer=WireManager";

            return new MfaSetupDTO
            {
                Secret = secret,
                OtpauthUri = otpauthUri
            };

        }

        public async Task<AuthResponseDTO> VerifyMfa(string code)
        {

            var isIdentity = await IsMfaEnabled();

            if (isIdentity.isIdentity)
            {
                throw new Exception("Identities cannot enable mfa");
            }

            var userId = _contextAccessor.HttpContext?
                .User
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            var actUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == userId);

            if (actUser == null)
            {
                throw new Exception("User not found");
            }

            if (!actUser.mfaEnabled || string.IsNullOrEmpty(actUser.mfaSecret))
            {
                throw new Exception("MFA is not enabled for this user");
            }

            var secret = _dataProtector.Unprotect(actUser.mfaSecret);

            var secretBytes = Base32Encoding.ToBytes(secret);

            var totp = new Totp(secretBytes);

            var validity =  totp.VerifyTotp(
                code,
                out _,
                new VerificationWindow(previous: 1, future: 1)
            );

            if (!validity)
            {
                throw new Exception("The code is not valid");
            }

            var newToken = await _tokenServices.GenerateJWTToken(actUser);

            return new AuthResponseDTO
            {
                Token = newToken,
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };

        }

        public async Task DisableMfa()
        {

            var isIdentity = await IsMfaEnabled();

            if (isIdentity.isIdentity)
            {
                throw new Exception("Identities cannot enable mfa");
            }

            var userId = _contextAccessor.HttpContext?
                .User
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            var actUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == userId);

            if (actUser == null)
            {
                throw new Exception("User not found");
            }

            actUser.mfaEnabled = false;
            actUser.mfaSecret = null;
            await _context.SaveChangesAsync();

            return;
        }
        public async Task<MfaEnabledDTO> IsMfaEnabled()
        {

            var userId = _contextAccessor.HttpContext?
                .User
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;

            var actUser = await _context.Users.FirstOrDefaultAsync(u => u.UUID == userId);

            if (actUser == null)
            {
                throw new Exception("User not found");
            }

            var checkIdentity = await _context.UserIdentities.FirstOrDefaultAsync(i => i.UserUUID == actUser.UUID);

            return new MfaEnabledDTO
            {
                isEnabled = actUser.mfaEnabled,
                isIdentity = checkIdentity != null
            };
        }

    }
}
