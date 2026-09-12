using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;
using OtpNet;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.Core.Services
{
    public class TokenServices(SymmetricSecurityKey jwtKey, IHttpContextAccessor contextAccessor) : ITokenServices
    {
        private readonly SymmetricSecurityKey _jwtKey = jwtKey;
        private readonly IHttpContextAccessor _contextAccessor = contextAccessor;

        public async Task<string> GenerateJWTToken(Users user, int duration = 120, string? role = null)
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
                new Claim(ClaimTypes.Role, role ?? user.Role ?? "User") // Il ruolo serve al middleware [Authorize(Roles = "Admin")]
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

        public async Task<string> GenerateMfaSecret()
        {

            var secretBytes = KeyGeneration.GenerateRandomKey(20);
            var secret = Base32Encoding.ToString(secretBytes);

            return secret;

        }
    }
}
