using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using WireManager.Core.Data;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using WireManager.Core.Services;
using WireManager.Core.Utils;

Console.WriteLine("Avvio dell'applicazione WireManager API (v 0.9.9)...");

var builder = WebApplication.CreateBuilder(args);

// Configurazione dei controller e serializzazione JSON
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

// Configurazione del DbContext
builder.Services.AddDbContext<WireManagerContext>();

// Abilitazione specifiche OpenAPI (Swagger)
builder.Services.AddOpenApi();

builder.Services.AddHttpContextAccessor();

// Registrazione dei servizi Core nel container di Dependency Injection
builder.Services.AddScoped<IPeerServices, PeerServices>();
builder.Services.AddScoped<IServerServices, ServerServices>();
builder.Services.AddScoped<IAuthServices, AuthServices>();
builder.Services.AddScoped<IPolicyServices, PolicyServices>();
builder.Services.AddScoped<IFirewallServices, FirewallServices>();
builder.Services.AddScoped<ISetupServices, SetupServices>();
builder.Services.AddScoped<IWireguardOps, WireguardOps>();
builder.Services.AddScoped<IAuditServices, AuditServices>();

// Gestione della cartella base e della chiave segreta per il JWT
var baseFolder = DiskOps._baseFolderPathServer;
if (!string.IsNullOrWhiteSpace(baseFolder) && !Directory.Exists(baseFolder))
{
    Directory.CreateDirectory(baseFolder);
}

var jwtSecretPath = Path.Combine(baseFolder, "jwt.secret");
string jwtKey;

if (File.Exists(jwtSecretPath))
{
    jwtKey = await File.ReadAllTextAsync(jwtSecretPath);
}
else
{
    // Generazione di una chiave crittograficamente sicura (256 bit) se non esiste
    var keyBytes = RandomNumberGenerator.GetBytes(32);
    jwtKey = Convert.ToBase64String(keyBytes);
    await File.WriteAllTextAsync(jwtSecretPath, jwtKey);
}

const string jwtIssuer = "WireManager";
const string jwtAudience = "WireManagerClients";
var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

// Registrazione della chiave come singleton per eventuale riutilizzo
builder.Services.AddSingleton(symmetricSecurityKey);

// Persistenza delle Data Protection keys per stabilità tra i restart del container
var dataProtectionKeysPath = Path.Combine(baseFolder, "dp-keys");
if (!Directory.Exists(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
}

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("WireManager");

// Configurazione dell'autenticazione tramite Bearer Token
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = symmetricSecurityKey,
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[JWT ERROR] Fallito: {context.Exception.Message}");
            Console.ResetColor();
            return Task.CompletedTask;
        },
        OnChallenge = context =>
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[JWT CHALLENGE] {context.Error} - {context.ErrorDescription}");
            Console.ResetColor();
            return Task.CompletedTask;
        }
    };
})
.AddCookie("OidcCookie")
.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
{
    options.SignInScheme = "OidcCookie";
    options.CallbackPath = "/signin-oidc";
});

// Configurazione delle opzioni OpenID Connect tramite il servizio personalizzato
builder.Services.AddSingleton<IConfigureOptions<OpenIdConnectOptions>, OidcOptionsConfiguration>();

// Registrazione dei processi in background
builder.Services.AddHostedService<PeerExpirationWorker>();
builder.Services.AddHostedService<PeerUsageServices>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;

    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Operazioni di inizializzazione post-build (Database, Path, Firewall)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var context = services.GetRequiredService<WireManagerContext>();

    // Esecuzione delle migrazioni del database
    try
    {
        await context.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Errore durante l'aggiornamento automatico del database.");
    }

    // Inizializzazione dei percorsi operativi sul file system
    try
    {
        var configPath = context.SystemConfigs.FirstOrDefault(c => c.Key == "WireGuardConfigPath")?.Value;
        DiskOps.InitializePaths(configPath);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Errore durante il setup dei percorsi in DiskOps.");
    }

    // Configurazione iniziale del firewall per i server attivi
    try
    {
        var firewallService = services.GetRequiredService<IFirewallServices>();
        var activeServers = await context.Set<ConfServer>().AsNoTracking().ToListAsync();

        Console.WriteLine($"Trovati {activeServers.Count} server attivi. Avvio inizializzazione firewall...");

        foreach (var server in activeServers)
        {
            try
            {
                string interfaceName = $"server_{server.Id}";
                await firewallService.UpdateFirewall(interfaceName);
                Console.WriteLine($"Firewall configurato con successo per l'interfaccia: {interfaceName}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Errore durante la configurazione del firewall per il server ID: {ServerId}", server.Id);
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Errore critico durante l'inizializzazione globale del firewall.");
    }
}

// Configurazione della pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // app.UseSwaggerUI(); 
}

app.UseForwardedHeaders();

// app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();