namespace WireManager.Core.Interfaces
{
    public interface IFirewallServices
    {
        public Task UpdateFirewall(string interfaceName);
    }
}
