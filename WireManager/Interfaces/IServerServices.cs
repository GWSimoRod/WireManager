using WireManager.Core.DTO;
using WireManager.Core.Models;


namespace WireManager.Core.Interfaces
{
    public interface IServerServices
    {
        Task<List<ConfServer>> GetAllServerAsync();

        Task<ConfServer> CreateServerAsync(ServerRequestDTO server);

        Task<ConfServer?> GetServerByIdAsync(int Id);

        Task DeleteServerAsync(int Id);

        Task<ConfServer> UpdateServerAsync(int Id, ServerRequestDTO server);

    }
}
