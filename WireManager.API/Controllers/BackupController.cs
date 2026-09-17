using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;

namespace WireManager.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [RequireSetup]
    public class BackupController(IBackupServices backupServices) : ControllerBase
    {
        private readonly IBackupServices _backupServices = backupServices;

        [HttpPost]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> CreateNewBackup([FromBody] CreateBackupRequestDTO request)
        {

            try
            {
                var backup = await _backupServices.CreateBackupAsync(request.Password);

                if(backup == null)
                {
                    return BadRequest("Impossible to create a new backup.");
                }

                return File(
                    backup,
                    "application/octet-stream",
                    "wiremanager-backup.json"
                );

            }catch(Exception ex)
            {
                Console.WriteLine("[Backup]: Creazione del backup fallito: " + ex.Message);
                return BadRequest(ex.Message);
            }

        }

        [HttpPost("restore")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> RestoreBackup(IFormFile file, [FromForm] string password)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest("Backup file is required.");

                if (string.IsNullOrWhiteSpace(password))
                    return BadRequest("Backup password is required.");

                using var memoryStream = new MemoryStream();

                await file.CopyToAsync(memoryStream);

                await _backupServices.RestoreBackupAsync(
                    memoryStream.ToArray(),
                    password);

                return Ok("Backup restored successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "[Backup]: Restore failed: " + ex.Message);

                return BadRequest(ex.Message);
            }
        }

        [HttpPost("automatic")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> ConfigureAutomaticBackup([FromBody] AutomaticBackup backup)
        {
            try
            {
                await _backupServices.ConfigureAutomaticBackupAsync(backup);

                return Ok();
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "[Backup]: Configure automatic backup failed: " + ex.Message);

                return BadRequest(ex.Message);
            }
        }

        [HttpGet("automatic")]
        public async Task<IActionResult> GetAutomaticBackupConf()
        {
            try
            {
                var conf = await _backupServices.GetAutomaticBackupConfAsync();

                return Ok(conf != null ? new
                {
                    conf.Enabled,
                    conf.retention,
                    conf.Schedule
                } : null);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    "[Backup]: Configure automatic backup failed: " + ex.Message);

                return BadRequest(ex.Message);
            }
        }

    }
}
