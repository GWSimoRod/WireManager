using System;
using System.Collections.Generic;
using System.Text;

namespace WireManager.Core.Models
{
    public class AuthenticationSSO
    {

        public int Id { get; set; }
        public bool OidcEnabled { get; set; }
        public string? OidcAuthority { get; set; }
        public string? OidcClientId { get; set; }
        public string? OidcClientSecret { get; set; }

    }
}
