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
            //options.ResponseMode = "form_post";
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

            options.Events.OnRedirectToIdentityProvider = context =>
            {
                var backendUrl = Environment.GetEnvironmentVariable("BACKEND_URL");

                if (!string.IsNullOrWhiteSpace(backendUrl))
                {
                    context.ProtocolMessage.RedirectUri =
                        $"{backendUrl.TrimEnd('/')}{context.Options.CallbackPath}";
                }

                Console.WriteLine(
                    $"[OIDC] Authorization ResponseMode: {context.ProtocolMessage.ResponseMode}"
                );

                Console.WriteLine(
                    $"[OIDC] Authorization ResponseType: {context.ProtocolMessage.ResponseType}"
                );

                Console.WriteLine(
                    $"[OIDC] Authorization RedirectUri: {context.ProtocolMessage.RedirectUri}"
                );

                return Task.CompletedTask;
            };

            options.Events.OnMessageReceived = async context =>
            {
                var request = context.HttpContext.Request;

                Console.WriteLine($"[OIDC] Method: {request.Method}");
                Console.WriteLine($"[OIDC] Content-Type: {request.ContentType}");

                Console.WriteLine(
                    $"[OIDC] Protocol State: {!string.IsNullOrEmpty(context.ProtocolMessage.State)}"
                );

                Console.WriteLine(
                    $"[OIDC] Protocol Code: {!string.IsNullOrEmpty(context.ProtocolMessage.Code)}"
                );

                if (request.HasFormContentType)
                {
                    var form = await request.ReadFormAsync();

                    foreach (var key in form.Keys)
                    {
                        Console.WriteLine($"[OIDC] Form key: {key}");
                    }

                    Console.WriteLine(
                        $"[OIDC] Form State: {form.ContainsKey("state")}"
                    );

                    Console.WriteLine(
                        $"[OIDC] Form State Length: {form["state"].FirstOrDefault()?.Length ?? 0}"
                    );
                }
            };
        }
    }
}