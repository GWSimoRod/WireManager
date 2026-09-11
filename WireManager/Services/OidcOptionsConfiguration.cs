using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using WireManager.Core.Data;

namespace WireManager.Core.Services
{
    public class OidcOptionsConfiguration(
        IServiceScopeFactory scopeFactory
    ) : IConfigureNamedOptions<OpenIdConnectOptions>
    {
        private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

        public void Configure(OpenIdConnectOptions options)
        {
            Configure(OpenIdConnectDefaults.AuthenticationScheme, options);
        }

        public void Configure(
            string? name,
            OpenIdConnectOptions options)
        {
            if (name != OpenIdConnectDefaults.AuthenticationScheme)
                return;

            // Default values to prevent errors when OIDC is not configured
            options.ClientId = "disabled";
            options.Authority = "https://disabled.invalid";

            using var scope = _scopeFactory.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<WireManagerContext>();

            var settings = context.AuthenticationSSOs
                .FirstOrDefault();

            if (settings == null || !settings.OidcEnabled)
                return;

            options.Authority = settings.OidcAuthority;
            options.ClientId = settings.OidcClientId;
            options.ClientSecret = settings.OidcClientSecret;

            options.ResponseType = "code";
            options.UsePkce = true;

            options.SaveTokens = true;

            options.MapInboundClaims = false;

            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("profile");
            options.Scope.Add("email");

            options.Events ??= new OpenIdConnectEvents();

            options.Events.OnTokenValidated = context =>
            {
                var issuer = context.SecurityToken.Issuer;

                if (!string.IsNullOrWhiteSpace(issuer))
                {
                    context.Properties.Items["oidc_issuer"] = issuer;
                }

                return Task.CompletedTask;
            };
        }
    }
}