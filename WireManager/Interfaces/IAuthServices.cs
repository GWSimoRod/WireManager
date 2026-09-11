using System.Security.Claims;
using System.Security.Principal;
using WireManager.Core.DTO;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface IAuthServices
    {

        public Task<AuthResponseDTO> LoginAsync(string username, string password);
        public Task<bool> CreateNewAccount(NewAccountDTO newAccountDTO);
        public Task<(List<UserSafeDTO> Users, int totalCount)> GetAllUsersAsync(int start, int end, string? searchTerm, string userUUID);
        public Task<bool> DeleteAccount(string uUID, string userUUID);
        public Task<bool> UpdateRole(string uUID, string role, string userUUID);
        public Task<AuthenticationSSO?> GetSSOConfiguration();
        public Task UpdateSSOConfiguration(AuthenticationSSO ssoConfig);
        public Task<AuthResponseDTO> LoginSSO(ClaimsPrincipal user);
        public Task<AuthResponseDTO> ExchangeJWTToken(string userUUID);
    }
}
