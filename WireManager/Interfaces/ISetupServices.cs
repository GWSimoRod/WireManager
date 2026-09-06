using WireManager.Core.DTO;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface ISetupServices
    {

        Task<bool> IsSystemConfiguredAsync();
        Task<bool> PerformInitialSetupAsync(InitialSetupDTO dto);

        Task<List<SystemConfig>> GetSetupConfigAsync();
    }
}
