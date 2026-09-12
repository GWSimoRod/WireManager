using System;
using System.Collections.Generic;
using System.Text;
using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface ITokenServices
    {
        public Task<string> GenerateJWTToken(Users user, int duration = 120, string? role = null);
        public Task<string> GenerateMfaSecret();
    }
}
