using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using QRCoder;
using System.Net;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using WireManager.Core.Utils;
using Org.BouncyCastle.Utilities;

namespace WireManager.Core.Services
{
    public class PeerServices(IPolicyServices policyServices, WireManagerContext context, IFirewallServices firewall, IWireguardOps wireguard, ILogger<PeerServices> logger) : IPeerServices
    {
        private readonly ILogger<PeerServices> _logger = logger;
        private readonly IPolicyServices _policyServices = policyServices;
        private readonly WireManagerContext _context = context;
        private readonly IFirewallServices _firewall = firewall;
        private readonly IWireguardOps _wireguard = wireguard;

        public async Task<(List<ConfPeer> Peers, int totalCount)> GetAllPeerAsync(int start, int end, string? searchTerm)
        {
            try
            {
                    var query = _context.ConfPeers.AsQueryable();

                    if (!string.IsNullOrWhiteSpace(searchTerm))
                    {
                        searchTerm = searchTerm.ToLower();
                        query = query.Where(p => p.ClientName.ToLower().Contains(searchTerm) ||
                                                 p.PublicKey.ToLower().Contains(searchTerm));
                    }

                    int totalCount = await query.CountAsync();

                    if (totalCount == 0)
                    {
                        return (new List<ConfPeer>(), 0);
                    }

                    int requestedTake = end - start;
                    if (requestedTake < 1) requestedTake = 10;

                    // controllo che non vado a sforare
                    if (start >= totalCount)
                    {
                        start = Math.Max(0, totalCount - requestedTake);
                    }

                    int take = Math.Min(requestedTake, totalCount - start);

                    var peers = await query
                        .Include(p => p.PeerTags)
                        .ThenInclude(pt => pt.Tag)
                        .OrderBy(p => p.Id)
                        .Skip(start)
                        .Take(take)
                        .ToListAsync();

                    return (peers, totalCount);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Error retrieving peers", ex);
            }
        }

        public async Task<ConfPeer> GetPeerByIdAsync(int id)
        {
            try
            {

                var peer = await _context.ConfPeers
                    .Include(p => p.PeerTags)
                    .ThenInclude(t => t.Tag)
                    .FirstOrDefaultAsync(p => p.Id == id);
                        
                if (peer == null)
                {
                    throw new KeyNotFoundException($"Peer with Id {id} not found.");
                }
                return peer;
            }
            catch (Exception ex)
            {
                throw new  InvalidOperationException($"Error retrieving peer with Id {id}");
            }
        }

        private static async Task<bool> ExistPeerByName(String clientName)
        {
            using (var context = new WireManagerContext())
            {
                return await context.ConfPeers.AnyAsync(p => p.ClientName == clientName);
            }
        }

        public async Task<ConfPeer> CreatePeerAsync(PeerRequestDTO peerDto)
        {
            if (peerDto == null)
            {
                throw new ArgumentNullException(nameof(peerDto), "The peer parameter cannot be null.");
            }

            if (string.IsNullOrWhiteSpace(peerDto.AllowedIPs))
            {
                // Default: se vuoto, forziamo split-tunnel sulla subnet del server, oppure "0.0.0.0/0" per full-tunnel
                peerDto.AllowedIPs = "0.0.0.0/0";
            }
            else if (!peerDto.AllowedIPs.Contains("/"))
            {
                throw new ArgumentException("The AllowedIPs field must contain a valid subnet (e.g. /24 or /32).");
            }

            // controllo che ConfServerId sia valorizzato
            if(peerDto.ConfServerId == null)
            {
                throw new ArgumentException("The ConfServerId field must be provided.");
            }

            // controllo che non esista già un peer con lo stesso nome (anche sanitized)
            if(await ExistPeerByName(peerDto.ClientName))
            {
                throw new InvalidOperationException($"A peer with the name {peerDto.ClientName} already exists.");
            }

            // Carichiamo il server includendo esplicitamente i suoi Peers per il calcolo dell'IP
            var server = await _context.ConfServers
                .Include(s => s.Peers)
                .FirstOrDefaultAsync(s => s.Id == peerDto.ConfServerId);

            if (server == null)
            {
                throw new KeyNotFoundException($"Cannot find server with Id: {peerDto.ConfServerId}");
            }

            string range = server.rangeIP;

            // Gestione e validazione dell'indirizzo IP
            if (peerDto.Address != null)
            {

                if (!NetworkOps.IsInSameSubnet(peerDto.Address, range))
                {
                    throw new InvalidOperationException($"The IP address {peerDto.Address} is not in the same subnet as the server {range}.");
                }

                // controllo che l'ip non appartenga al server
                if (peerDto.Address.Split("/")[0].Equals(server.rangeIP.Split("/")[0]))
                {
                    throw new InvalidOperationException($"The IP address {peerDto.Address} cannot be the same as the server {server.rangeIP}.");
                }

                // controllo che l'IP non sia già assegnato a un altro peer dello stesso server
                var existingPeer = server.Peers?.FirstOrDefault(p => p.Address.Split('/')[0] == peerDto.Address.Split('/')[0]);

                if(existingPeer != null)
                {
                    throw new InvalidOperationException($"The IP address {peerDto.Address} is already assigned to the peer {existingPeer.ClientName}.");
                }

                if (!peerDto.Address.Contains("/"))
                {
                    peerDto.Address += "/32";
                }
                else
                {
                    peerDto.Address = $"{peerDto.Address.Split('/')[0]}/32";
                }
            }
            else
            {
                // Autogenerazione dell'IP calcolato numericamente
                var lastPeer = server.Peers?
                    .Where(p => !string.IsNullOrWhiteSpace(p.Address))
                    .Select(p => new { Peer = p, PureIpStr = p.Address.Split('/')[0] })
                    .Where(x => IPAddress.TryParse(x.PureIpStr, out _))
                    .AsEnumerable() // Passiamo in memoria per l'ordinamento tramite i byte dell'IP
                    .OrderBy(x =>
                    {
                        var bytes = IPAddress.Parse(x.PureIpStr).GetAddressBytes();
                        if (BitConverter.IsLittleEndian) Array.Reverse(bytes);
                        return BitConverter.ToUInt32(bytes, 0);
                    })
                    .Select(x => x.Peer)
                    .LastOrDefault();

                if (lastPeer == null)
                {
                    if (string.IsNullOrWhiteSpace(range))
                    {
                        throw new InvalidOperationException("The server subnet is not configured or is invalid.");
                    }

                    string serverIpStr = range.Split('/')[0];
                    var serverBytes = IPAddress.Parse(serverIpStr).GetAddressBytes();

                    IncrementBytes(serverBytes);

                    var firstClientIp = new IPAddress(serverBytes);
                    peerDto.Address = $"{firstClientIp}/32";
                }
                else
                {
                    string lastIpStr = lastPeer.Address.Split('/')[0];
                    var clientBytes = IPAddress.Parse(lastIpStr).GetAddressBytes();

                    IncrementBytes(clientBytes);

                    var nextClientIp = new IPAddress(clientBytes);
                    peerDto.Address = $"{nextClientIp}/32";
                }
            }

            // Generazione chiavi crittografiche
            var (privateKey, publicKey) = CryptoOps.GenerateKeyPair();

            ConfPeer newPeer = new ConfPeer(
                peerDto.ClientName,
                privateKey,
                publicKey,
                peerDto.Address,
                peerDto.DNSAddress,
                peerDto.AllowedIPs,
                peerDto.ExpireAt,
                peerDto.PersistentKeepAlive
            )
            {
                ConfServerId = server.Id
            };

            // Ultimo controllo di sicurezza sulla subnet
            if (!NetworkOps.IsInSameSubnet(newPeer.Address.Split("/")[0], server.rangeIP))
            {
                throw new InvalidOperationException($"The IP address {newPeer.Address} is not in the same subnet as the server {server.rangeIP}.");
            }

            // Salvataggio a Database
            _context.ConfPeers.Add(newPeer);
            await _context.SaveChangesAsync();

            // faccio il sanitize del nome del peer per evitare problemi con i file di configurazione
            String sanitizedClientName = DiskOps.SanitizeFileName(newPeer.ClientName);

            // Scrittura dei file di configurazione su disco (eseguita DOPO il salvataggio DB per consistenza)
            await DiskOps.WriteToFileAsync($"{sanitizedClientName}.conf", newPeer.GetConfClient(server), DiskOps._baseFolderPathPeer);
            await DiskOps.WriteToFileAsync($"server_{newPeer.ConfServerId}.conf", newPeer.GetConfServer(), DiskOps._baseFolderPathServer);

            // aggiorno l'interfacca di rete di wireguard
            await _wireguard.SyncServerAsync(newPeer.ConfServerId);

            // aggiorno il firewall per possibili servizi globali

            await _firewall.UpdateFirewall($"server_{newPeer.ConfServerId}");

            return newPeer;
            
        }

        public async Task<bool> DeletePeerByIdAsync(int id)
        {
            var peer = await _context.ConfPeers.FindAsync(id);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {id} not found.");
            }

            _context.ConfPeers.Remove(peer);

            // Eliminazione file di configurazione del peer singolo
            try
            {
                await DiskOps.DeleteFile(DiskOps.SanitizeFileName(peer.ClientName) + ".conf", DiskOps._baseFolderPathPeer);
            }
            catch (Exception ex)
            {
                throw new IOException($"Error deleting configuration file of peer {peer.ClientName}: {ex.Message}", ex);
            }

            // Rimozione del blocco Peer dal file globale del Server
            string serverConfigFileName = Path.Combine(DiskOps._baseFolderPathServer, $"server_{peer.ConfServerId}.conf");

            if (!File.Exists(serverConfigFileName))
            {
                throw new FileNotFoundException($"The configuration file of the server {serverConfigFileName} does not exist.");
            }

            _logger.LogInformation($"Rimozione del peer dal file di configurazione del server: {serverConfigFileName}");

            var lines = await File.ReadAllLinesAsync(serverConfigFileName);
            var blocks = new List<List<string>>();
            var currentBlock = new List<string>();

            foreach (var line in lines)
            {
                // Rimuoviamo gli spazi e l'eventuale commento iniziale per capire se la riga è "vuota"
                string trimmedLine = line.Trim();
                bool isCommentEmpty = trimmedLine.StartsWith("#") && string.IsNullOrWhiteSpace(trimmedLine.TrimStart('#'));

                if (string.IsNullOrWhiteSpace(line) || isCommentEmpty)
                {
                    if (currentBlock.Count > 0)
                    {
                        blocks.Add(new List<string>(currentBlock));
                        currentBlock.Clear();
                    }
                    continue;
                }
                currentBlock.Add(line);
            }

            if (currentBlock.Count > 0)
            {
                blocks.Add(currentBlock);
            }

            // Cerchiamo il clientName ignorando i caratteri di commento extra all'inizio
            int removedCount = blocks.RemoveAll(b => b.Any(l =>
                // Rimuove gli spazi e i cancelletti iniziali per fare un controllo pulito sul nome
                l.Trim().TrimStart('#').Trim().Equals(peer.ClientName, StringComparison.OrdinalIgnoreCase) ||
                l.Contains(peer.ClientName)
            ));

            if (removedCount == 0)
            {
                throw new InvalidOperationException($"No configuration block found for the peer {peer.ClientName} in the server file.");
            }

            _logger.LogInformation("Blocco trovato ed eliminato con successo!");

            var newLines = new List<string>();
            for (int i = 0; i < blocks.Count; i++)
            {
                newLines.AddRange(blocks[i]);
                if (i < blocks.Count - 1)
                {
                    newLines.Add("");
                }
            }

            await File.WriteAllLinesAsync(serverConfigFileName, newLines);

            // aggiorno il db
            await _context.SaveChangesAsync();

            // Aggiorno l'interfaccia di rete di wireguard
            await _wireguard.SyncServerAsync(peer.ConfServerId);

            // modifico il firewall
            await _firewall.UpdateFirewall($"server_{peer.ConfServerId}");

            return true;
            
        }

        public async Task<String> GetPeerConfAsync(int id)
        {
            var peer = _context.ConfPeers.AsNoTracking().FirstOrDefault(p => p.Id == id);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {id} not found.");
            }
            var server = _context.ConfServers.FirstOrDefault(s => s.Id == peer.ConfServerId);
            if (server == null)
            {
                throw new KeyNotFoundException($"Server with Id {peer.ConfServerId} not found.");
            }

            // leggo la private key del peer dal database e la setto nel peer prima di generare la configurazione
            string peerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{DiskOps.SanitizeFileName(peer.ClientName)}.conf");

            if (!File.Exists(peerConfigFileName))
            {
                throw new FileNotFoundException($"The configuration file of the peer {peerConfigFileName} does not exist.");
            }

            var lines = await File.ReadAllLinesAsync(peerConfigFileName);

            foreach(var line in lines)
            {
                if (line.StartsWith("PrivateKey", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = line.Split('=', 2);

                    if (parts.Length > 1)
                    {
                        peer.PrivateKey = parts[1].Trim();
                    }
                    break;
                }
            }

            return peer.GetConfClient(server);
            
        }

        public async Task<byte[]> CreateQRCODE(int id)
        {
            // get peer conf
            string configText = await GetPeerConfAsync(id);

            if (string.IsNullOrEmpty(configText))
            {
                throw new InvalidOperationException($"The configuration of peer with Id {id} is empty or invalid.");
            }

            using (QRCodeGenerator qrGenerator = new QRCodeGenerator())
            {
                using (QRCodeData qrCodeData = qrGenerator.CreateQrCode(configText, QRCodeGenerator.ECCLevel.M))
                {
                    using (PngByteQRCode qrCode = new PngByteQRCode(qrCodeData))
                    {
                        return qrCode.GetGraphic(20);
                    }
                }
            }
        }

        public async Task<bool> UpdatePeerAsync(int id, PeerRequestDTO peerDto)
        {
            bool isRenamed = false;
            bool serverFileModified = false;

            if (String.IsNullOrWhiteSpace(peerDto.ClientName))
            {
                throw new ArgumentException("The ClientName field cannot be empty.");
            }

            var existingPeer = await _context.ConfPeers.FindAsync(id);
            if (existingPeer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {id} not found.");
            }

            // Gestione percorsi file
            string oldSanitizedName = DiskOps.SanitizeFileName(existingPeer.ClientName);
            string newSanitizedName = DiskOps.SanitizeFileName(peerDto.ClientName);

            string peerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{oldSanitizedName}.conf");
            string newPeerConfigFileName = Path.Combine(DiskOps._baseFolderPathPeer, $"{newSanitizedName}.conf");

            if (!File.Exists(peerConfigFileName))
            {
                throw new KeyNotFoundException("The peer configuration file does not exist.");
            }

            // Leggo tutte le righe del file di configurazione
            var linesList = (await File.ReadAllLinesAsync(peerConfigFileName)).ToList();
            var originalLines = linesList.ToArray();

            bool keepAliveFound = false;

            for (int i = 0; i < linesList.Count; i++)
            {
                string currentLine = linesList[i].Trim();

                if (currentLine.StartsWith("Address", StringComparison.OrdinalIgnoreCase) && peerDto.Address != null)
                {
                    linesList[i] = $"Address = {peerDto.Address}";
                }
                else if (currentLine.StartsWith("DNS", StringComparison.OrdinalIgnoreCase) && peerDto.DNSAddress != null)
                {
                    linesList[i] = $"DNS = {peerDto.DNSAddress}";
                }
                else if (currentLine.StartsWith("AllowedIPs", StringComparison.OrdinalIgnoreCase) && peerDto.AllowedIPs != null)
                {
                    linesList[i] = $"AllowedIPs = {peerDto.AllowedIPs}";
                }
                else if (currentLine.StartsWith("PersistentKeepalive", StringComparison.OrdinalIgnoreCase))
                {
                    keepAliveFound = true;
                    if (peerDto.PersistentKeepAlive != null)
                    {
                        linesList[i] = $"PersistentKeepalive = {peerDto.PersistentKeepAlive}";
                    }
                }
            }

            // Se PersistentKeepAlive non esisteva nel file ma è stato specificato nel DTO, lo aggiungiamo in fondo
            if (!keepAliveFound && peerDto.PersistentKeepAlive != null)
            {
                linesList.Add($"PersistentKeepalive = {peerDto.PersistentKeepAlive}");
            }

            var lines = linesList.ToArray();

            // Modifico anche il file di configurazione del server per aggiornare il blocco del peer (# nome)
            var serverConfigFileName = Path.Combine(DiskOps._baseFolderPathServer, $"server_{existingPeer.ConfServerId}.conf");
            var serverLines = await File.ReadAllLinesAsync(serverConfigFileName);
            var originalServerLines = (string[])serverLines.Clone();

            for (int i = 0; i < serverLines.Length; i++)
            {
                String currentLine = serverLines[i].Trim();

                if (currentLine.Equals($"# {existingPeer.ClientName}", StringComparison.OrdinalIgnoreCase) ||
                    currentLine.Equals($"# {oldSanitizedName}", StringComparison.OrdinalIgnoreCase))
                {
                    serverLines[i] = $"# {peerDto.ClientName}";
                    serverFileModified = true;
                    break;
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Aggiorna le proprietà del peer nel DB
                existingPeer.ClientName = peerDto.ClientName ?? existingPeer.ClientName;
                existingPeer.Address = peerDto.Address ?? existingPeer.Address;
                existingPeer.DNSAddress = peerDto.DNSAddress ?? existingPeer.DNSAddress;
                existingPeer.AllowedIPs = peerDto.AllowedIPs ?? existingPeer.AllowedIPs;
                existingPeer.ExpireAt = peerDto.ExpireAt ?? null;
                existingPeer.PersistentKeepAlive = peerDto.PersistentKeepAlive ?? 0;
                _context.ConfPeers.Update(existingPeer);
                await _context.SaveChangesAsync();

                // Rinomina il file di configurazione se il nome è cambiato
                if (!string.Equals(oldSanitizedName, newSanitizedName, StringComparison.OrdinalIgnoreCase))
                {
                    if (File.Exists(newPeerConfigFileName))
                    {
                        throw new IOException($"The configuration file with the new name {newPeerConfigFileName} already exists.");
                    }
                    File.Move(peerConfigFileName, newPeerConfigFileName);
                    isRenamed = true;
                }

                String target = isRenamed ? newPeerConfigFileName : peerConfigFileName;

                await File.WriteAllLinesAsync(target, lines);

                if (serverFileModified)
                {
                    await File.WriteAllLinesAsync(serverConfigFileName, serverLines);
                }

                await transaction.CommitAsync();

                // Aggiorna l'interfaccia di rete di wireguard
                await _wireguard.SyncServerAsync(existingPeer.ConfServerId);
            }
            catch (Exception ex)
            {
                // Effettuo il rollback in sicurezza verificando che la connessione sia aperta
                if (_context.Database.GetDbConnection().State == System.Data.ConnectionState.Open)
                {
                    await transaction.RollbackAsync();
                }

                try
                {
                    if (isRenamed)
                    {
                        if (File.Exists(newPeerConfigFileName))
                        {
                            File.Move(newPeerConfigFileName, peerConfigFileName);
                        }
                    }

                    await File.WriteAllLinesAsync(peerConfigFileName, originalLines);

                    if (serverFileModified)
                    {
                        await File.WriteAllLinesAsync(serverConfigFileName, originalServerLines);
                    }
                }
                catch (Exception fileEx)
                {
                    throw new IOException($"Error restoring the peer configuration file: {fileEx.Message}", fileEx);
                }

                // Sincronizza WireGuard per ripristinare lo stato coerente
                await _wireguard.SyncServerAsync(existingPeer.ConfServerId);

                throw new InvalidOperationException($"Error updating the peer: {ex.Message}", ex);
            }

            return true;
        }

        public async Task<bool> AddPolicyToPeer(int peerId, int tagId)
        {
            // Controllo se il peer esiste
            var peer = await GetPeerByIdAsync(peerId);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {peerId} not found.");
            }

            // Controllo che la policy (tag) esista
            var policy = await _policyServices.GetTagByIdAsync(tagId);
            if (policy == null)
            {
                throw new KeyNotFoundException($"Policy (Tag) with Id {tagId} not found.");
            }

            // Controllo se l'associazione è già presente nel database
            // Usiamo AnyAsync per una verifica rapidissima senza caricare l'intera entità
            var alreadyExists = await _context.PeerTags
                .AnyAsync(pp => pp.PeerId == peerId && pp.TagId == tagId);

            // Se è già associata, non facciamo nulla e ritorniamo true (operazione idempotente)
            if (alreadyExists)
            {
                return true;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            // Applico al peer la policy inserendo il record nella tabella ponte
            var newAssociation = new PeerTag
            {
                PeerId = peerId,
                TagId = tagId
            };

            _context.PeerTags.Add(newAssociation);
            await _context.SaveChangesAsync();

            try
            {
                // modifico il firewall
                await _firewall.UpdateFirewall($"server_{peer.ConfServerId}");

                // Salvo i cambiamenti sul database
                await transaction.CommitAsync();

                return true;

            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _context.ChangeTracker.Clear();
                throw new InvalidOperationException($"Error applying policy to peer: {ex.Message}", ex);
            }
        }

        public async Task<bool> RemovePolicyFromPeer(int peerId, int tagId)
        {
            // Controllo se il peer esiste
            var peer = await GetPeerByIdAsync(peerId);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {peerId} not found.");
            }
            // Controllo che la policy (tag) esista
            var policy = await _policyServices.GetTagByIdAsync(tagId);
            if (policy == null)
            {
                throw new KeyNotFoundException($"Policy (Tag) with Id {tagId} not found.");
            }
            // Recupero l'associazione tra peer e policy
            var association = await _context.PeerTags
                .FirstOrDefaultAsync(pp => pp.PeerId == peerId && pp.TagId == tagId);
            // Se l'associazione non esiste, ritorno false
            if (association == null)
            {
                return false;
            }
            // Rimuovo l'associazione dal database
            _context.PeerTags.Remove(association);
            // Salvo i cambiamenti sul database
            var rowsAffected = await _context.SaveChangesAsync();

            // modifico il firewall
            await _firewall.UpdateFirewall($"server_{peer.ConfServerId}");

            return rowsAffected > 0;
        }

        public async Task<List<PeerTagResponseDTO>> GetPoliciesForPeer(int peerId)
        {
            // Controllo se il peer esiste
            var peer = await GetPeerByIdAsync(peerId);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {peerId} not found.");
            }
            // Recupero le policy associate al peer tramite la tabella ponte
            var policies = await _context.PeerTags
                .Where(pt => pt.PeerId == peerId)
                .Select(pt => new PeerTagResponseDTO
                {
                    Id = pt.Tag.Id,
                    Name = pt.Tag.Name,
                    Color = pt.Tag.Color
                })
                .ToListAsync();

            return policies;
        }

        public async Task<bool> TogglePeer(int id, bool status)
        {

            try
            {
                // ottengo l'id del server del peer
                var peer = await GetPeerByIdAsync(id);
                if(peer == null)
                {
                    return false;
                }

                int serverID = peer.ConfServerId;

                // leggo il file di conf del server
                string path = Path.Combine(DiskOps._baseFolderPathServer, $"server_{serverID}.conf");
                var lines = await File.ReadAllLinesAsync(path);

                for (int i = 0; i < lines.Length; i++)
                {
                    string line = lines[i];

                    if (line.StartsWith($"# {peer.ClientName}", StringComparison.OrdinalIgnoreCase) && !status)
                    {
                        // controllo che non sia già commentata

                        if (!lines[i - 1].TrimStart().StartsWith("#")){
                            lines[i - 1] = "# " + lines[i-1];
                        }

                        for (int j = i + 1; j < i + 3; j++)
                        {
                            if (!lines[j].TrimStart().StartsWith("#"))
                            {
                                lines[j] = "# " + lines[j] ;
                            }
                        }

                        peer.IsActive = false;

                        _context.Entry(peer).State = EntityState.Modified;

                        break;
                    }
                    else if (line.StartsWith($"# {peer.ClientName}", StringComparison.OrdinalIgnoreCase) && status)
                    {
                        if (i > 0 && lines[i - 1].TrimStart().StartsWith("#"))
                        {
                        
                            lines[i - 1] = lines[i - 1].TrimStart().Substring(1).TrimStart();
                        }

                        if (lines[i].TrimStart().StartsWith("# #"))
                        {  
                            lines[i] = lines[i].TrimStart().Substring(1).TrimStart();
                        }

                        int fineBlocco = Math.Min(i + 3, lines.Length);
                        for (int j = i + 1; j < fineBlocco; j++)
                        {
                            if (lines[j].TrimStart().StartsWith("#"))
                            {
                                lines[j] = lines[j].TrimStart().Substring(1).TrimStart();
                            }
                        }

                        peer.IsActive = true;

                        _context.Entry(peer).State = EntityState.Modified;

                        break;
                    }
                }

                await File.WriteAllLinesAsync(path, lines);

                // aggiorno il db

                await _context.SaveChangesAsync();

                // sync la conf

                await _wireguard.SyncServerAsync(serverID);

                return true;
            }catch(Exception ex)
            {
                _logger.LogInformation(ex.ToString());
                throw new Exception(ex.ToString());
            }

        }

        public async Task<bool> IsPeerAuthorizedForDomain(string ip, string domain)
        {
            // controllo che il peer sia associato a un servizio che ha il dominio richiesto

            return await _context.ConfPeers
                .AsNoTracking()
                .Where(p => p.Address == ip || p.Address.StartsWith(ip + "/"))
                .AnyAsync(p => p.PeerTags.Any(pt =>
                    pt.Tag.TagServices.Any(ts =>
                        ts.Service.Domain == domain
                    )
                ));
        }


        public async Task<PeerStatsDTO> GetPeerStatsRealTimeAsync(int id)
        {
            var peer = await GetPeerByIdAsync(id);
            if (peer == null)
            {
                throw new KeyNotFoundException($"Peer with Id {id} not found.");
            }
            var server = await _context.ConfServers.FindAsync(peer.ConfServerId);
            if (server == null)
            {
                throw new KeyNotFoundException($"Server with Id {peer.ConfServerId} not found.");
            }

            var stats = await _wireguard.GetPeerStatsAsync($"server_{server.Id}");
            // Trova le statistiche del peer specifico
            var peerStats = stats.FirstOrDefault(s => s.PublicKey == peer.PublicKey);
            if (peerStats == null)
            {
                throw new KeyNotFoundException($"Statistics for peer with public key {peer.PublicKey} not found.");
            }
            return peerStats;
        }

        public async Task<List<UsageHistory>?> GetPeerStatsAsync(int id, DateTime? from)
        {
            return await _context.UsageHistories
                .AsNoTracking()
                .Where(u => u.Peer != null &&
                            u.Peer.Id == id &&
                            u.Timestamp >= from)
                .OrderBy(u => u.Timestamp)
                .Take(100)
                .ToListAsync();
        }
        private void IncrementBytes(byte[] bytes)
        {
            for (int i = bytes.Length - 1; i >= 0; i--)
            {
                if (bytes[i] < 255)
                {
                    bytes[i]++;
                    break;
                }
                bytes[i] = 0;
            }
        }
    }
}