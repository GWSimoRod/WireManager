using WireManager.Core.Models;
using WireManager.Core.DTO;

namespace WireManager.Core.Interfaces
{
    public interface IPeerServices
    {
        Task<(List<ConfPeer> Peers, int totalCount)> GetAllPeerAsync(int start, int end, string? searchTerm);
        Task<ConfPeer> GetPeerByIdAsync(int id);
        Task<ConfPeer> CreatePeerAsync(PeerRequestDTO peer);
        Task<bool> DeletePeerByIdAsync(int id);
        Task<String> GetPeerConfAsync(int id);
        Task<byte[]> CreateQRCODE(int id);
        Task<bool> UpdatePeerAsync(int id, PeerRequestDTO peerDto);
        Task<bool> AddPolicyToPeer(int peerId, int policyId);
        Task<bool> RemovePolicyFromPeer(int peerId, int tagId);
        Task<List<PeerTagResponseDTO>> GetPoliciesForPeer(int peerId);
        Task<bool> TogglePeer(int id, bool status);
        Task<bool> IsPeerAuthorizedForDomain(string ip, string domain);
        Task<PeerStatsDTO> GetPeerStatsRealTimeAsync(int id);
        Task<List<UsageHistory>?> GetPeerStatsAsync(int id, DateTime? from);
    }
}
