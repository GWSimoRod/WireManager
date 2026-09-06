using WireManager.Core.DTO;

namespace WireManager.Core.Interfaces
{
    public interface IWireguardOps
    {
        public Task<bool> SyncServerAsync(int Id);
        public Task<bool> StartWireGuardInterfaceAsync(int serverId);
        public Task<bool> StopWireGuardInterfaceAsync(int serverId);
        public Task<List<PeerStatsDTO>> GetPeerStatsAsync(string Interface);
        public Task<(int ExitCode, string Output, string Error)> ExecuteCommandAsync(string command, string args, string? standardInput = null, bool skipOutputRead = false, bool shellCommand = false);
    }
}
