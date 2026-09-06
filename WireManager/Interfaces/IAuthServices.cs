using WireManager.Core.DTO;

namespace WireManager.Core.Interfaces
{
    public interface IAuthServices
    {

        public Task<AuthResponseDTO> LoginAsync(string username, string password);
        public Task<bool> CreateNewAccount(NewAccountDTO newAccountDTO);
        public Task<(List<UserSafeDTO> Users, int totalCount)> GetAllUsersAsync(int start, int end, string? searchTerm, string userUUID);
        public Task<bool> DeleteAccount(string uUID, string userUUID);
        public Task<bool> UpdateRole(string uUID, string role, string userUUID);

    }
}
