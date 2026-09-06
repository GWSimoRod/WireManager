using Microsoft.AspNetCore.Mvc;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;

namespace WireManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SetupController(ISetupServices SetupServices) : ControllerBase
    {

        private readonly ISetupServices _setupServices = SetupServices;

        [HttpPost]
        public async Task<IActionResult> PerformInitialSetup([FromBody] InitialSetupDTO dto)
        {
            try
            {
                if(await _setupServices.IsSystemConfiguredAsync())
                {
                    return Ok(new { message = "Initial setup alredy completed" });
                }

                bool isSetupCompleted = await _setupServices.PerformInitialSetupAsync(dto);
                if (isSetupCompleted)
                {
                    return Ok(new { message = "Initial setup completed successfully." });
                }
                else
                {
                    return BadRequest(new { message = "Initial setup failed." });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error during initial setup: {ex.Message}" });
            }
        }

        [HttpGet("status")]
        public async Task<IActionResult> IsSetupCompleted()
        {
            try
            {
                bool isSetupCompleted = await _setupServices.IsSystemConfiguredAsync();
                return Ok(new { isSetupCompleted });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error checking setup status: {ex.Message}" });
            }
        }

    }
}
