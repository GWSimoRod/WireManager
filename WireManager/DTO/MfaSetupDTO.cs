using System;
using System.Collections.Generic;
using System.Text;

namespace WireManager.Core.DTO
{
    public class MfaSetupDTO
    {
        public string Secret { get; set; }
        public string OtpauthUri { get; set; }
    }
}
