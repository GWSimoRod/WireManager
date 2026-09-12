using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;
using WireManager.Core.DTO;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface ISSOServices
    {
        public Task<AuthenticationSSO?> GetSSOConfiguration();
        public Task UpdateSSOConfiguration(AuthenticationSSO ssoConfig);
        public Task<AuthResponseDTO> LoginSSO(ClaimsPrincipal user);
        public Task<AuthResponseDTO> ExchangeJWTToken(string userUUID);
    }
}
