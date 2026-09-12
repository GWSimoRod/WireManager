using System;
using System.Collections.Generic;
using System.Text;
using WireManager.Core.DTO;

namespace WireManager.Core.Interfaces
{
    public interface IMFAServices
    {
        public Task<MfaSetupDTO> AddNewMfa();
        public Task<AuthResponseDTO> VerifyMfa(string code);
        public Task DisableMfa();
        public Task<MfaEnabledDTO> IsMfaEnabled();
    }
}
