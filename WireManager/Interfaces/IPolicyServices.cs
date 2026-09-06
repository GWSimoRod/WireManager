using WireManager.Core.DTO;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface IPolicyServices
    {
        Task<Tag> CreateTagWithServicesAsync(TagDTO tag);
        Task<bool> DeleteTagAsync(int tagId);
        Task<Service> CreateServiceAsync(ServiceDTO service);
        Task<bool> DeleteServiceAsync(int serviceId);
        Task<bool> RemoveServiceFromTagAsync(int tagId, int serviceId);
        Task<bool> UpdateTagAsync(int tagId, TagDTO tag);
        Task<List<Service>> GetAllServicesAsync();
        Task<List<Tag>> GetAllTagsAsync();
        Task<Tag?> GetTagByIdAsync(int tagId);
        Task<Service?> GetServiceByIdAsync(int serviceId);
        Task<bool> CreatePolicyAsync(PolicyDTO policy);
    }
}
