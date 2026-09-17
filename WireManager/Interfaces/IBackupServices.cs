using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface IBackupServices
    {
        Task<byte[]> CreateBackupAsync(string password);
        Task RestoreBackupAsync(byte[] backupStream, string password);
        Task ConfigureAutomaticBackupAsync(AutomaticBackup settings);
        Task<AutomaticBackup?> GetAutomaticBackupConfAsync();
    }
}
