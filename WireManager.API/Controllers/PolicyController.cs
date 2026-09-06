using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WireManager.API.Attributes;
using WireManager.Core.Domain;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;


namespace WireManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [RequireSetup]
    public class PolicyController(IPolicyServices policyServices) : ControllerBase
    {

        private readonly IPolicyServices _policyServices = policyServices;

        [HttpPost("tags")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> CreateTag([FromBody] TagDTO tag)
        {
            try
            {
                Tag result = await _policyServices.CreateTagWithServicesAsync(tag);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("tags/{id}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> DeleteTag(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                bool result = await _policyServices.DeleteTagAsync(id);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("tags/{tagId}/services/{serviceId}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> RemoveServiceFromTag(int tagId, int serviceId)
        {
            if (tagId <= 0 || serviceId <= 0) return BadRequest("Invalid IDs.");
            try
            {
                bool result = await _policyServices.RemoveServiceFromTagAsync(tagId, serviceId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("tags/{tagId}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> UpdateServiceFromTag(int tagId, [FromBody] TagDTO tag)
        {
            if (tagId <= 0) return BadRequest("Invalid ID.");
            try
            {
                bool result = await _policyServices.UpdateTagAsync(tagId, tag);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("tags")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetAllTags()
        {
            try
            {
                var tags = await _policyServices.GetAllTagsAsync();
                return Ok(tags);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("tags/{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetTagById(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var tag = await _policyServices.GetTagByIdAsync(id);
                if (tag == null)
                {
                    return NotFound($"Tag with ID {id} not found.");
                }
                return Ok(tag);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }


        [HttpPost("services")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> CreateService([FromBody] ServiceDTO service)
        {
            try
            {
                Service result = await _policyServices.CreateServiceAsync(service);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("services/{id}")]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> DeleteService(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                bool result = await _policyServices.DeleteServiceAsync(id);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("services")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetAllServices()
        {
            try
            {
                var services = await _policyServices.GetAllServicesAsync();
                return Ok(services);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }

        [HttpGet("services/{id}")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Operator}")]
        public async Task<IActionResult> GetServiceById(int id)
        {
            if (id <= 0) return BadRequest("Invalid ID.");
            try
            {
                var service = await _policyServices.GetServiceByIdAsync(id);
                if (service == null)
                {
                    return NotFound($"Service with ID {id} not found.");
                }
                return Ok(service);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost]
        [Authorize(Roles = $"{AppRoles.Admin}")]
        public async Task<IActionResult> CreatePolicy([FromBody] PolicyDTO policy)
        {
            try
            {
                bool result = await _policyServices.CreatePolicyAsync(policy);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
