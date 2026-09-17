using Docker.DotNet.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WireManager.Core.Backup;
using WireManager.Core.BackupModels;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using WireManager.Core.Utils;

namespace WireManager.Core.Services
{
    public class BackupServices(WireManagerContext context, IPeerServices peerServices, IDataProtectionProvider dataProtectionProvider, IAuditServices auditServices, IFirewallServices firewallServices) : IBackupServices
    {

        private readonly WireManagerContext _context = context;
        private readonly IPeerServices _peerServices = peerServices;
        private readonly IAuditServices _auditServices = auditServices;
        private readonly IFirewallServices _firewallServices = firewallServices;
        private readonly IDataProtector _dataProtector = dataProtectionProvider.CreateProtector("WireManager.MFA.Secret");
        private readonly IDataProtector _backupDataProtector = dataProtectionProvider.CreateProtector("WireManager.Backup.Password");
        public async Task<byte[]> CreateBackupAsync(string password)
        {

            try
            {
                // effetto il dump di tutto il db

                var newBackup = new BackupData();

                await CreateDatabaseBackupAsync(newBackup);
                await TakePrivateKeyFromPeersAsync(newBackup);
                await TakePrivateKeyFromServersAsync(newBackup);

                var json = JsonSerializer.Serialize(newBackup);

                await _auditServices.AuditLog(
                    "Backup.Create",
                    "Backup",
                    null,
                    true,
                    null
                );

                return Encrypt(
                    Encoding.UTF8.GetBytes(json),
                    password
                );
            }
            catch (Exception ex)
            {
                await _auditServices.AuditLog(
                    "Backup.Create",
                    "Backup",
                    null,
                    false,
                    "Error during creation of backup: " + ex.Message
                );
                throw new InvalidOperationException("Error during creation of backup: " + ex.Message);
            }

            
        }

        public async Task RestoreBackupAsync(byte[] backup, string password)
        {

            try
            {
                var decrypted = Decrypt(backup, password);

                var json = Encoding.UTF8.GetString(decrypted);

                var backupDecrypted = JsonSerializer.Deserialize<BackupData>(json) 
                    ?? throw new InvalidOperationException("Invalid WireManager backup.");

                await RestoreDatabaseAsync(backupDecrypted);
                await RestoreFileSystemPeersAsync(backupDecrypted);
                await RestoreFileSystemServersAsync(backupDecrypted);

                // initialize firewall

                foreach(var server in backupDecrypted.Database.Servers)
                {
                    await _firewallServices.UpdateFirewall($"server_{server.Id}");
                }

                await _auditServices.AuditLog(
                        "Backup.Restore",
                        "Backup",
                        null,
                        true,
                        null
                );

                return;
            }catch (Exception ex)
            {
                await _auditServices.AuditLog(
                        "Backup.Restore",
                        "Backup",
                        null,
                        false,
                        "Error during restore backup: " + ex.Message
                );
                throw new InvalidOperationException("Error during restore backup: " + ex.Message);
            }

            
        }

        public async Task ConfigureAutomaticBackupAsync(AutomaticBackup settings)
        {
            try
            {
                var existingSettings = await _context.AutomaticBackups.FirstOrDefaultAsync();

                if (existingSettings == null)
                {
                    existingSettings = new AutomaticBackup
                    {
                        Enabled = settings.Enabled,
                        Password = _backupDataProtector.Protect(settings.Password),
                        retention = settings.retention,
                        Schedule = settings.Schedule
                    };

                    await _context.AutomaticBackups.AddAsync(existingSettings);
                }
                else
                {
                    existingSettings.Enabled = settings.Enabled;
                    existingSettings.retention = settings.retention;
                    existingSettings.Schedule = settings.Schedule;

                    if (!string.IsNullOrWhiteSpace(settings.Password))
                    {
                        existingSettings.Password =
                            _backupDataProtector.Protect(settings.Password);
                    }
                }

                await _context.SaveChangesAsync();

                await _auditServices.AuditLog(
                    "Backup.InitializeAutomatic",
                    "Backup",
                    null,
                    true,
                    null
                );

            }
            catch (Exception ex)
            {
                await _auditServices.AuditLog(
                    "Backup.InitializeAutomatic",
                    "Backup",
                    null,
                    false,
                    "Error during initialize automatic backup: " + ex.Message
                );

                Console.WriteLine(
                    "[Backup]: Failed to initialize automatic backup: " + ex.Message
                );
            }
        }

        public async Task<AutomaticBackup?> GetAutomaticBackupConfAsync()
        {
            return await _context.AutomaticBackups.FirstOrDefaultAsync();
        }

        private async Task CreateDatabaseBackupAsync(BackupData backup)
        {
            var database = backup.Database;

            database.Servers = await _context.ConfServers
                .AsNoTracking()
                .ToListAsync();

            database.Peers = await _context.ConfPeers
                .AsNoTracking()
                .ToListAsync();

            database.Tags = await _context.Tags
                .AsNoTracking()
                .ToListAsync();

            database.Services = await _context.Services
                .AsNoTracking()
                .ToListAsync();

            database.PeerTags = await _context.PeerTags
                .AsNoTracking()
                .ToListAsync();

            database.TagServices = await _context.TagServices
                .AsNoTracking()
                .ToListAsync();

            var users = await _context.Users
                .AsNoTracking()
                .ToListAsync();

            foreach(var user in users)
            {

                if(string.IsNullOrEmpty(user.mfaSecret))
                {
                    continue;
                }

                try
                {
                    user.mfaSecret = _dataProtector.Unprotect(user.mfaSecret);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException(
                        $"Unable to decrypt MFA secret for user {user.UUID}.", ex);
                }
            }

            database.Users = users;

            database.UserIdentities = await _context.UserIdentities
                .AsNoTracking()
                .ToListAsync();

            database.SystemConfig = await _context.SystemConfigs
                .AsNoTracking()
                .ToListAsync();

            database.Audits = await _context.Audits
                .AsNoTracking()
                .ToListAsync();
        }

        private async Task TakePrivateKeyFromPeersAsync(BackupData backup)
        {

            foreach(var peer in backup.Database.Peers)
            {

                var conf = await _peerServices.GetPeerConfObjectAsync(peer.Id);

                backup.Peers.Add(new WireGuardPeerBackup
                {
                    Id = peer.Id,
                    PrivateKey = conf.PrivateKey
                });

            }

        }

        private async Task TakePrivateKeyFromServersAsync(BackupData backup)
        {

            foreach(var server in backup.Database.Servers)
            {
                int id = server.Id;

                var lines = await File.ReadAllLinesAsync(Path.Combine(DiskOps._baseFolderPathServer, $"server_{id}.conf"));

                var privateKeyLine = lines.FirstOrDefault(line =>
                    line.StartsWith("PrivateKey", StringComparison.OrdinalIgnoreCase)) 
                    ?? throw new Exception($"Server {id} doesn't have a private key");

                var privateKey = privateKeyLine
                    .Split('=', 2)[1]
                    .Trim();

                backup.Servers.Add(new WireGuardServerBackup
                {
                    Id = id,
                    PrivateKey = privateKey
                });

            }

        }

        private async Task RestoreDatabaseAsync(BackupData backup)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var database = backup.Database;

                // Elimino i dati attuali rispettando le relazioni
                _context.Audits.RemoveRange(_context.Audits);
                _context.PeerTags.RemoveRange(_context.PeerTags);
                _context.TagServices.RemoveRange(_context.TagServices);
                _context.UserIdentities.RemoveRange(_context.UserIdentities);

                _context.ConfPeers.RemoveRange(_context.ConfPeers);
                _context.ConfServers.RemoveRange(_context.ConfServers);

                _context.Tags.RemoveRange(_context.Tags);
                _context.Services.RemoveRange(_context.Services);

                _context.Users.RemoveRange(_context.Users);
                _context.SystemConfigs.RemoveRange(_context.SystemConfigs);

                await _context.SaveChangesAsync();

                // Riproteggo i secret MFA con le Data Protection keys
                // della macchina attuale
                foreach (var user in database.Users)
                {
                    if (!string.IsNullOrEmpty(user.mfaSecret))
                    {
                        user.mfaSecret = _dataProtector.Protect(
                            user.mfaSecret);
                    }
                }

                // Ripristino il database
                await _context.Users.AddRangeAsync(database.Users);

                await _context.UserIdentities.AddRangeAsync(
                    database.UserIdentities);

                await _context.ConfServers.AddRangeAsync(
                    database.Servers);

                await _context.ConfPeers.AddRangeAsync(
                    database.Peers);

                await _context.Tags.AddRangeAsync(
                    database.Tags);

                await _context.Services.AddRangeAsync(
                    database.Services);

                await _context.PeerTags.AddRangeAsync(
                    database.PeerTags);

                await _context.TagServices.AddRangeAsync(
                    database.TagServices);

                await _context.SystemConfigs.AddRangeAsync(
                    database.SystemConfig);

                // Ripristino gli audit precedenti
                foreach (var audit in database.Audits)
                {
                    audit.Details = string.IsNullOrEmpty(audit.Details)
                        ? "Restored from backup."
                        : $"{audit.Details} | Restored from backup.";
                }

                await _context.Audits.AddRangeAsync(database.Audits);

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
            }
            catch(Exception ex )
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private async Task RestoreFileSystemPeersAsync(BackupData backupData)
        {

            foreach (var peer in backupData.Database.Peers)
            {
                var server = backupData.Database.Servers
                    .FirstOrDefault(s => s.Id == peer.ConfServerId);

                if (server == null)
                {
                    throw new InvalidOperationException(
                        $"Server {peer.ConfServerId} associated with peer {peer.Id} not found.");
                }

                var privateKey = backupData.Peers?
                    .FirstOrDefault(p => p.Id == peer.Id)?.PrivateKey;

                if (string.IsNullOrEmpty(privateKey))
                {
                    throw new InvalidOperationException(
                        $"Private key for peer {peer.Id} ({peer.ClientName}) not found in backup. Backup file could be corrupted. Filesystem may contain partially restored configuration. ");
                }

                peer.PrivateKey = privateKey;

                String sanitizedClientName = DiskOps.SanitizeFileName(peer.ClientName);

                await DiskOps.WriteToFileAsync($"{sanitizedClientName}.conf", peer.GetConfClient(server), DiskOps._baseFolderPathPeer);

            }

        }

        private async Task RestoreFileSystemServersAsync(BackupData backupData)
        {
            foreach(var server in backupData.Database.Servers)
            {

                var privateKey = backupData.Servers?
                    .FirstOrDefault(s => s.Id == server.Id)?.PrivateKey;

                if (string.IsNullOrEmpty(privateKey))
                {
                    throw new InvalidOperationException(
                        $"Private key for server {server.Id} not found in backup. Backup file could be corrupted. Filesystem may contain partially restored configuration. ");
                }

                server.privateKey = privateKey;

                var configuration = new StringBuilder();

                // [Interface]
                configuration.Append(server.GetConfServer());

                // [Peer]
                foreach (var peer in backupData.Database.Peers
                             .Where(p => p.ConfServerId == server.Id))
                {
                    configuration.Append(peer.GetConfServer());
                }

                var fileName = $"server_{server.Id}.conf";

                await DiskOps.WriteToFileAsync(
                    fileName,
                    configuration.ToString(),
                    DiskOps._baseFolderPathServer);

            }
        }

        // funzioni helper per encrypt e decrypt

        private byte[] Encrypt(byte[] data, string password)
        {
            const int saltSize = 16;
            const int nonceSize = 12;
            const int tagSize = 16;
            const int keySize = 32;
            const int iterations = 600_000;

            // Genera un salt casuale per questo backup
            byte[] salt = RandomNumberGenerator.GetBytes(saltSize);

            // Genera un nonce casuale per AES-GCM
            byte[] nonce = RandomNumberGenerator.GetBytes(nonceSize);

            // Deriva la chiave dalla password
            byte[] key = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                keySize);

            byte[] ciphertext = new byte[data.Length];
            byte[] tag = new byte[tagSize];

            // Cifra il contenuto
            using var aes = new AesGcm(key, tagSize);

            aes.Encrypt(
                nonce,
                data,
                ciphertext,
                tag);

            // Formato:
            // [salt][nonce][tag][ciphertext]
            using var output = new MemoryStream();

            output.Write(salt);
            output.Write(nonce);
            output.Write(tag);
            output.Write(ciphertext);

            return output.ToArray();
        }
        private byte[] Decrypt(byte[] encryptedData, string password)
        {
            const int saltSize = 16;
            const int nonceSize = 12;
            const int tagSize = 16;
            const int keySize = 32;
            const int iterations = 600_000;

            int minimumSize = saltSize + nonceSize + tagSize;

            if (encryptedData.Length < minimumSize)
                throw new InvalidOperationException("Invalid WireManager backup.");

            // Leggo salt
            byte[] salt = encryptedData[..saltSize];

            // Leggo nonce
            byte[] nonce = encryptedData
                .AsSpan(saltSize, nonceSize)
                .ToArray();

            // Leggo tag
            byte[] tag = encryptedData
                .AsSpan(saltSize + nonceSize, tagSize)
                .ToArray();

            // Il resto è il ciphertext
            int ciphertextOffset = saltSize + nonceSize + tagSize;

            byte[] ciphertext = encryptedData[ciphertextOffset..];

            // Ricavo la stessa chiave usata durante la cifratura
            byte[] key = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                keySize);

            byte[] plaintext = new byte[ciphertext.Length];

            using var aes = new AesGcm(key, tagSize);

            aes.Decrypt(
                nonce,
                ciphertext,
                tag,
                plaintext);

            return plaintext;
        }

    }
}
