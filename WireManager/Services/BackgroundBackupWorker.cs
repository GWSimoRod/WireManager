using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Utils;

namespace WireManager.Core.Services
{
    public class BackgroundBackupWorker(IServiceScopeFactory scopeFactory, ILogger<PeerExpirationWorker> logger, IDataProtectionProvider dataProtectionProvider) : BackgroundService
    {
        private readonly ILogger<PeerExpirationWorker> _logger = logger;
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
        private readonly IDataProtector _backupDataProtector = dataProtectionProvider.CreateProtector("WireManager.Backup.Password");

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(_checkInterval);

            do
            {
                try
                {
                    await AutomaticBackupWorker(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // L'operazione è stata annullata
                    break;

                }
                catch (Exception ex)
                {
                    // Log dell'eccezione
                    _logger.LogInformation($"Errore durante l'elaborazione dell'expiration dei peer: {ex.Message}");
                }
            } while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken));
        }

        private async Task AutomaticBackupWorker(CancellationToken cancellation)
        {

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<WireManagerContext>();
            var backupServices = scope.ServiceProvider.GetRequiredService<IBackupServices>();
            var audit = scope.ServiceProvider.GetRequiredService<IAuditServices>();

            try
            {

                var conf = await context.AutomaticBackups.FirstOrDefaultAsync();

                if (conf == null)
                {
                    _logger.LogInformation("[BACKUP WORKER] Nessun backup automatico impostato");
                    return;
                }

                var now = DateTime.Now;

                if (now.Hour != conf.Schedule.Hour ||
                    now.Minute != conf.Schedule.Minute)
                {
                    _logger.LogInformation(
                        "[BACKUP WORKER] Time non raggiunto. Ora: {CurrentTime}, schedulato: {Schedule}",
                        now.ToString("HH:mm"),
                        conf.Schedule.ToString("HH:mm")
                    );

                    return;
                }

                _logger.LogInformation(
                    "[BACKUP WORKER] Creazione nuovo backup alle {CurrentTime}.",
                    now.ToString("HH:mm")
                );

                // creo il backup
                var newBackup = await backupServices.CreateBackupAsync(_backupDataProtector.Unprotect(conf.Password));

                // salvo il backup

                var fileName = $"wiremanager-backup-{DateTime.Now:yyyy-MM-dd-HHmmss}.json";

                var data = JsonSerializer.Serialize(newBackup);

                await DiskOps.WriteToFileAsync(fileName, data, DiskOps._baseFolderPathBackup);

                // applico la retention

                ApplyRetention(DiskOps._baseFolderPathBackup, conf.retention);

                await audit.AuditLog(
                    "Backup.CreateAutomatic",
                    "Backup",
                    null,
                    true,
                    null
                );

                return;
            }catch(Exception ex)
            {
                _logger.LogError("[BACKUP]: Impossibile creare il backup automatico: " + ex.Message);
                await audit.AuditLog(
                    "Backup.CreateAutomatic",
                    "Backup",
                    null,
                    false,
                    "[Backup]: Impossibile to create automatic backup: " + ex.Message
                );
            }

        }

        private void ApplyRetention(string backupDirectory, int retention)
        {
            var files = new DirectoryInfo(backupDirectory)
                .GetFiles("*.json")
                .OrderBy(f => f.CreationTimeUtc)
                .ToList();

            var filesToDelete = files.Count - retention;

            if (filesToDelete <= 0)
                return;

            foreach (var file in files.Take(filesToDelete))
            {
                file.Delete();

                _logger.LogInformation(
                    "[Backup]: Deleted old backup {FileName}",
                    file.Name);
            }
        }
    }
}
