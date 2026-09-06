using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.Core.Services
{
    public class SetupServices(WireManagerContext context, ILogger<SetupServices> logger) : ISetupServices
    {
        private readonly ILogger<SetupServices> _logger = logger;

        private readonly WireManagerContext _context = context;

        public async Task<bool> IsSystemConfiguredAsync()
        {
            var setting = await _context.SystemConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "IsSetupCompleted");

            return setting != null && bool.TryParse(setting.Value, out var isCompleted) && isCompleted;
        }

        public async Task<bool> PerformInitialSetupAsync(InitialSetupDTO dto)
        {

            if (await IsSystemConfiguredAsync())
            {
                return true;
            }


            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var settings = new List<SystemConfig>
                {
                    new() { Key = "IsSetupCompleted", Value = "true", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "ExecutionMode", Value = dto.ExecutionMode ? "Docker" : "Native", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "FirewallEngine", Value = dto.FirewallEngine, UpdatedAt = DateTime.UtcNow },
                };

                if (dto.ExecutionMode) // Modalità Docker
                {
                    settings.Add(new SystemConfig
                    {
                        Key = "ContainerName",
                        Value = string.IsNullOrWhiteSpace(dto.ContainerWireguardName) ? "wireguard" : dto.ContainerWireguardName,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else // Modalità Nativa
                {
                    settings.Add(new SystemConfig
                    {
                        Key = "WireGuardConfigPath",
                        Value = string.IsNullOrWhiteSpace(dto.WireGuardConfigPath) ? "config" : dto.WireGuardConfigPath,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                await _context.SystemConfigs.AddRangeAsync(settings);

                // aggiungo l'utente admin

                await _context.Users.AddAsync(new Users
                (
                    dto.AdminUsername,
                    BCrypt.Net.BCrypt.HashPassword(dto.AdminPassword),
                    "Admin"
                ));

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogInformation($"Errore durante la configurazione iniziale: {ex.Message}");
                return false;
            }

        }

        public async Task<List<SystemConfig>> GetSetupConfigAsync()
        {

            // Recupera le impostazioni di configurazione dal database

            var confs = await _context.SystemConfigs
                .AsNoTracking()
                .ToListAsync();

            return confs;

        }
    }
}
