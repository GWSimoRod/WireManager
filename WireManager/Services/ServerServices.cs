using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using WireManager.Core.Models;
using WireManager.Core.Interfaces;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Utils;


namespace WireManager.Core.Services
{
    public class ServerServices(IWireguardOps wireguard, ILogger<ServerServices> logger, WireManagerContext context, IAuditServices auditServices) : IServerServices
    {
        private readonly ILogger<ServerServices> _logger = logger;
        private readonly IWireguardOps _wireguard = wireguard;
        private readonly WireManagerContext _context = context;
        private readonly IAuditServices _auditServices = auditServices;

        public async Task<List<ConfServer>> GetAllServerAsync()
        {
            try
            {

                return await _context.ConfServers
                                    .Include(s => s.Peers)
                                    .ToListAsync();

            }
            catch (Exception ex)
            {
                _logger.LogWarning("Error retrieving servers" + ex.Message);
                throw new InvalidOperationException($"Error retrieving servers");
            }
        }

        public async Task<ConfServer?> GetServerByIdAsync(int Id)
        {
            try
            {
                return await _context.ConfServers
                                    .Include(s => s.Peers)
                                    .FirstOrDefaultAsync(s => s.Id == Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Error retrieving server with Id {Id}: " + ex.Message);
                throw new InvalidOperationException($"Error retrieving server with Id {Id}");
            }
        }

        public async Task<ConfServer> CreateServerAsync(ServerRequestDTO server)
        {

            if (server == null)
            {
                await _auditServices.AuditLog(
                    "Server.Create",
                    "Server",
                    null,
                    false,
                    "Attempted to create a server with null data"
                );
                return null;
            }

            // valido il rangeip

            if (!NetworkOps.IsValidCidrIp(server.rangeIP))
            {
                await _auditServices.AuditLog(
                    "Server.Create",
                    "Server",
                    null,
                    false,
                    $"Attempted to create a server with invalid CIDR IP range: {server.rangeIP}"
                );
                throw new ArgumentException($"Invalid CIDR IP range: {server.rangeIP}");
            }

            // genero la chiave privata e pubblica del server
            var (privateKey, publicKey) = CryptoOps.GenerateKeyPair();

            ConfServer cServer = new ConfServer(
                privateKey,
                publicKey,
                server.rangeIP,
                server.listenPort,
                server.EndPoint
            );


            _context.ConfServers.Add(cServer);

            // salvo il server nel database
            await _context.SaveChangesAsync();

            // creo il file di configurazione del server
            await DiskOps.WriteToFileAsync($"server_{cServer.Id}.conf", cServer.GetConfServer(), DiskOps._baseFolderPathServer);


            // avvio l'interfaccia del server

            // cambiare nome conf nel docker compose prima di testare questo e delete

            try
            {
                await _wireguard.StartWireGuardInterfaceAsync(cServer.Id);
            } catch (Exception ex)
            {
                await _auditServices.AuditLog(
                    "Server.Create",
                    "Server",
                    cServer.Id.ToString(),
                    false,
                    $"Error starting WireGuard interface for server with Id {cServer.Id}: {ex.Message}"
                );
                throw new InvalidOperationException($"Error starting WireGuard interface for server with Id {cServer.Id}: {ex.Message}", ex);
            }

            await _auditServices.AuditLog(
                "Server.Create",
                "Server",
                cServer.Id.ToString(),
                true,
                null
            );

            return cServer;

        }

        public async Task DeleteServerAsync(int Id)
        {
            try
            {
                await _wireguard.StopWireGuardInterfaceAsync(Id);
            }
            catch (Exception ex)
            {
                await _auditServices.AuditLog(
                    "Server.Delete",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Error stopping WireGuard interface for server with Id {Id}: {ex.Message}"
                );
                throw new InvalidOperationException($"Error stopping WireGuard interface for server with Id {Id}: {ex.Message}", ex);
            }


            try
            {
                var server = await _context.ConfServers.FindAsync(Id);
                if (server == null)
                {
                    await _auditServices.AuditLog(
                        "Server.Delete",
                        "Server",
                        Id.ToString(),
                        false,
                        $"Attempted to delete a server with Id {Id} that does not exist"
                    );
                    throw new KeyNotFoundException($"Server with Id {Id} not found");
                }
                _context.ConfServers.Remove(server);
                await _context.SaveChangesAsync();
                
            }
            catch (Exception ex) when (ex is not KeyNotFoundException)
            {
                await _auditServices.AuditLog(
                    "Server.Delete",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Error deleting server with Id {Id} from database: {ex.Message}"
                );
                // Cattura tutto tranne KeyNotFoundException, impacchettandolo in una InvalidOperationException
                throw new InvalidOperationException($"Error deleting server with Id {Id} from database: {ex.Message}", ex);
            }

            // Elimino il file di configurazione del server

            try
            {
                string filePath = Path.Combine(DiskOps._baseFolderPathServer, $"server_{Id}.conf");

                File.Delete(filePath);
            }
            catch (Exception ex)
            {
                await _auditServices.AuditLog(
                    "Server.Delete",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Error deleting server configuration file for server with Id {Id}: {ex.Message}"
                );
                _logger.LogInformation($"[Warning] Server {Id} rimosso dal DB ma non dal disco");
                throw new InvalidOperationException($"Error deleting server configuration file for server with Id {Id}: {ex.Message}", ex);
            }

            await _auditServices.AuditLog(
                "Server.Delete",
                "Server",
                Id.ToString(),
                true,
                null
            );

        }

        public async Task<ConfServer> UpdateServerAsync(int Id, ServerRequestDTO server)
        {
            // Validazione dei dati passati in input
            if (server == null) throw new ArgumentNullException(nameof(server), "Server data cannot be null");
            if (!NetworkOps.IsValidCidrIp(server.rangeIP)) throw new InvalidOperationException("Invalid CIDR IP range");
            if (server.listenPort <= 0 || server.listenPort > 65535) throw new InvalidOperationException("Invalid listen port");

            if (!NetworkOps.TryParseEndpoint(server.EndPoint, server.listenPort, out string cleanEndpoint))
            {
                await _auditServices.AuditLog(
                    "Server.Update",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Attempted to update server with Id {Id} with invalid endpoint format: {server.EndPoint}"
                );
                throw new InvalidOperationException("Invalid endpoint format");
            }

            var srvDB = await _context.ConfServers
                .Include(s => s.Peers)
                .FirstOrDefaultAsync(s => s.Id == Id);

            if (srvDB == null)
            {
                await _auditServices.AuditLog(
                    "Server.Update",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Attempted to update a server with Id {Id} that does not exist"
                );
                throw new InvalidOperationException($"Server with Id {Id} not found");
            }

            // FASE DI LETTURA E PREPARAZIONE (Fuori dalla scrittura fisica)
            var serverConfigFileName = Path.Combine(DiskOps._baseFolderPathServer, $"server_{srvDB.Id}.conf");
            var originalServerConfig = await File.ReadAllLinesAsync(serverConfigFileName);
            var linesToModify = (string[])originalServerConfig.Clone(); // Cast esplicito per la compilazione

            var originalPeerConfigs = new Dictionary<string, string[]>();
            var modifiedPeerConfigs = new Dictionary<string, string[]>();

            // Prepariamo in memoria tutte le modifiche dei peer prima di toccare il disco
            foreach (ConfPeer p in srvDB.Peers)
            {
                var peerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{p.ClientName}.conf");
                var peerLines = await File.ReadAllLinesAsync(peerConfigFileName);

                originalPeerConfigs[p.ClientName] = peerLines; // Non serve clonarlo qui, non lo modificheremo

                var modifiedPeerLines = (string[])peerLines.Clone(); // Copia isolata da modificare
                for (int i = 0; i < modifiedPeerLines.Length; i++)
                {
                    if (modifiedPeerLines[i].Trim().StartsWith("Endpoint"))
                    {
                        modifiedPeerLines[i] = $"Endpoint = {cleanEndpoint}";
                        break;
                    }
                }
                modifiedPeerConfigs[p.ClientName] = modifiedPeerLines;
            }

            // Modifica delle linee del server in memoria
            for (int i = 0; i < linesToModify.Length; i++)
            {
                if (linesToModify[i].Trim().StartsWith("ListenPort"))
                {
                    linesToModify[i] = $"ListenPort = {server.listenPort}";
                }
                else if (linesToModify[i].Trim().StartsWith("Address"))
                {
                    linesToModify[i] = $"Address = {server.rangeIP}";
                }
            }

            // FASE DI SCRITTURA ATOMICA (Transazione DB + File System)
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Aggiorna l'entità sul Database
                srvDB.listenPort = server.listenPort;
                srvDB.rangeIP = server.rangeIP;
                srvDB.EndPoint = cleanEndpoint;

                await _context.SaveChangesAsync();

                // Scrittura fisica dei file di configurazione (Server)
                await File.WriteAllLinesAsync(serverConfigFileName, linesToModify);

                // Scrittura fisica dei file di configurazione (Peer)
                foreach (var kvp in modifiedPeerConfigs)
                {
                    var peerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{kvp.Key}.conf");
                    await File.WriteAllLinesAsync(peerConfigFileName, kvp.Value);
                }

                // Se tutto è andato a buon fine, confermiamo la transazione sul DB
                await transaction.CommitAsync();

            }
            catch (Exception ex)
            {
                // Rollback immediato del Database
                await transaction.RollbackAsync();

                // Rollback del File System usando i backup sicuri in memoria
                try
                {
                    await File.WriteAllLinesAsync(serverConfigFileName, originalServerConfig);

                    foreach (var kvp in originalPeerConfigs)
                    {
                        var peerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{kvp.Key}.conf");
                        await File.WriteAllLinesAsync(peerConfigFileName, kvp.Value);
                    }
                }
                catch (Exception fileEx)
                {
                    await _auditServices.AuditLog(
                        "Server.Update",
                        "Server",
                        Id.ToString(),
                        false,
                        $"Critical Error: DB rolled back but file system rollback failed for server with Id {Id}: {fileEx.Message}"
                    );
                    throw new InvalidOperationException($"Critical Error: DB rolled back but file system rollback failed: {fileEx.Message}", fileEx);
                }

                await _auditServices.AuditLog(
                    "Server.Update",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Error updating server with Id {Id}: {ex.Message}"
                );

                throw new InvalidOperationException($"Error updating server with Id {Id}: {ex.Message}", ex);
            }

            // sincronizziamo il server 
            try
            {
                await _wireguard.SyncServerAsync(Id);
            }
            catch (Exception syncEx)
            {
                await _auditServices.AuditLog(
                    "Server.Update",
                    "Server",
                    Id.ToString(),
                    false,
                    $"Error syncing server with Id {Id}: {syncEx.Message}"
                );

                throw new InvalidOperationException($"Error syncing server with Id {Id}: {syncEx.Message}", syncEx);
            }

            await _auditServices.AuditLog(
                "Server.Update",
                "Server",
                Id.ToString(),
                true,
                null
            );

            return srvDB;
        }

    }
}
