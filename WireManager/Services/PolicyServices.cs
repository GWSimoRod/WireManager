using Microsoft.Extensions.Logging;
﻿using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Models;
using Microsoft.EntityFrameworkCore;
using WireManager.Core.Interfaces;

namespace WireManager.Core.Services
{

    public class PolicyServices(WireManagerContext context, IFirewallServices firewall, ILogger<PolicyServices> logger) : IPolicyServices
    {
        private readonly ILogger<PolicyServices> _logger = logger;
        private readonly WireManagerContext _context = context;
        private readonly IFirewallServices _firewall = firewall;

        public async Task<Tag> CreateTagWithServicesAsync(TagDTO tag)
        {
            if (tag == null) throw new ArgumentNullException(nameof(tag));

            // Se sono stati passati dei servizi, verifichiamo che ESISTANO TUTTI prima di fare qualsiasi operazione
            if (tag.ServicesId != null && tag.ServicesId.Count > 0)
            {
                var existingServicesCount = await _context.Services
                    .CountAsync(s => tag.ServicesId.Contains(s.Id));

                // Se il numero di servizi trovati nel DB non corrisponde a quelli richiesti, c'è un ID non valido
                if (existingServicesCount != tag.ServicesId.Count)
                {
                    throw new ArgumentException("One or more specified service IDs are invalid.");
                }
            }

            // Se la validazione passa, creiamo il tag (usando una transazione implicita di EF)
            Tag newTag = new Tag
            {
                Name = tag.Name,
                Color = tag.Color
            };

            _context.Tags.Add(newTag);
            await _context.SaveChangesAsync(); // Genera l'Id di newTag

            if (tag.ServicesId != null && tag.ServicesId.Count > 0)
            {
                foreach (var serviceId in tag.ServicesId)
                {
                    _context.TagServices.Add(new TagService
                    {
                        TagId = newTag.Id,
                        ServiceId = serviceId
                    });
                }
                await _context.SaveChangesAsync();
            }

            return newTag;
        }

        public async Task<bool> DeleteTagAsync(int tagId)
        {
            var tag = await _context.Tags.FindAsync(tagId);
            if (tag == null)
            {
                return false; // Tag non trovato
            }

            var affectedInterfaceIds = await _context.PeerTags
                .Where(pt => pt.TagId == tagId)
                .Select(pt => pt.Peer.ConfServerId) // identificativo dell'interfaccia
                .Distinct()
                .ToListAsync();

            // Rimuovo le associazioni nella tabella ponte
            var tagServices = _context.TagServices.Where(ts => ts.TagId == tagId);
            _context.TagServices.RemoveRange(tagServices);
            // Rimuovo il tag
            _context.Tags.Remove(tag);
            await _context.SaveChangesAsync();

            // aggiorno il firewall per tutte le interfacce che avevano il tag eliminato

            foreach (var interfaceId in affectedInterfaceIds)
            {
                await _firewall.UpdateFirewall($"server_{interfaceId}");
            }

            return true;
        }

        public async Task<Service> CreateServiceAsync(ServiceDTO service)
        {
            if (service == null)
            {
                throw new ArgumentNullException(nameof(service));
            }

            Service newService = new Service
            {
                Name = service.Name,
                Port = service.Port,
                TargetIp = service.TargetIp,
                Protocol = service.Protocol,
                Domain = service.domain,
                IsGlobal = service.IsGlobal
            };

            _context.Services.Add(newService);
            await _context.SaveChangesAsync();

            // Aggiorna il firewall se è stato aggiunto un servizio globale
            if (newService.IsGlobal)
            {
                // Leggo dalla tabella dei Server/Interfacce
                // (Se non ci sono ancora peer registrati, ConfPeers restituirebbe una lista vuota!)
                var allInterfaceIds = await _context.ConfServers
                    .Select(s => s.Id)
                    .ToListAsync();

                // Se non ho ConfServers ma c'è ConfPeers, metto un fallback di sicurezza
                if (!allInterfaceIds.Any())
                {
                    allInterfaceIds = await _context.ConfPeers
                        .Select(p => p.ConfServerId)
                        .Distinct()
                        .ToListAsync();
                }

                foreach (var interfaceId in allInterfaceIds)
                {
                    await _firewall.UpdateFirewall($"server_{interfaceId}");
                }
            }

            return newService;
        }

        public async Task<bool> DeleteServiceAsync(int serviceId)
        {
            var service = await _context.Services.FindAsync(serviceId);
            if (service == null)
            {
                return false;
            }

            bool wasGlobal = service.IsGlobal;
            List<int> affectedInterfaceIds;

            if (wasGlobal)
            {
                affectedInterfaceIds = await _context.ConfServers
                    .Select(s => s.Id)
                    .ToListAsync();

                if (!affectedInterfaceIds.Any())
                {
                    affectedInterfaceIds = await _context.ConfPeers
                        .Select(p => p.ConfServerId)
                        .Distinct()
                        .ToListAsync();
                }
            }
            else
            {
                affectedInterfaceIds = await _context.PeerTags
                    .Where(pt => _context.TagServices.Any(ts => ts.TagId == pt.TagId && ts.ServiceId == serviceId))
                    .Select(pt => pt.Peer.ConfServerId)
                    .Distinct()
                    .ToListAsync();
            }

            // Rimozione associazioni e servizio
            var tagServices = _context.TagServices.Where(ts => ts.ServiceId == serviceId);
            _context.TagServices.RemoveRange(tagServices);
            _context.Services.Remove(service);

            await _context.SaveChangesAsync();

            // Rigenerazione regole iptables
            foreach (var interfaceId in affectedInterfaceIds)
            {
                await _firewall.UpdateFirewall($"server_{interfaceId}");
            }

            return true;
        }

        public async Task<bool> RemoveServiceFromTagAsync(int tagId, int serviceId)
        {
            var tagService = await _context.TagServices
                .FirstOrDefaultAsync(ts => ts.TagId == tagId && ts.ServiceId == serviceId);

            if (tagService == null)
            {
                throw new ArgumentException($"No association found between tag with ID {tagId} and service with ID {serviceId}.");
            }

            // Recupero l'elenco delle interfacce che hanno il tag associato al servizio da rimuovere

            var affectedInterfaceIds = await _context.PeerTags
                .Where(pt => pt.TagId == tagId)
                .Select(pt => pt.Peer.ConfServerId)
                .Distinct()
                .ToListAsync();

            // Rimuovo l'associazione
            _context.TagServices.Remove(tagService);
            // Salvo le modifiche
            await _context.SaveChangesAsync();

            // aggiorno il firewall per tutte le interfacce che avevano il tag associato al servizio rimosso

            foreach (var interfaceId in affectedInterfaceIds)
            {
                await _firewall.UpdateFirewall($"server_{interfaceId}");
            }

            return true;

        }

        public async Task<bool> UpdateTagAsync(int tagId, TagDTO tag)
        {

            if (tag == null) throw new ArgumentNullException("The tag cannot be empty.");

            var existingTag = await _context.Tags.FindAsync(tagId);
            if (existingTag == null)
            {
                throw new ArgumentException($"Tag with ID {tagId} not found.");
            }
            existingTag.Name = tag.Name;
            existingTag.Color = tag.Color;

            bool hasChanges = false;

            if (tag.ServicesId != null)
            {
                hasChanges = true;
                var uniqueServiceIds = tag.ServicesId.Distinct().ToList();

                if(uniqueServiceIds.Count > 0)
                {
                    var existingServicesCount = await _context.Services
                        .CountAsync(s => uniqueServiceIds.Contains(s.Id));
                    if (existingServicesCount != uniqueServiceIds.Count)
                    {
                        throw new ArgumentException("One or more specified service IDs are invalid.");
                    }
                }

                // Rimuovo le associazioni esistenti
                var existingAssociations = _context.TagServices.Where(ts => ts.TagId == tagId);
                _context.TagServices.RemoveRange(existingAssociations);

                // Aggiungo le nuove associazioni
                foreach (var serviceId in uniqueServiceIds)
                {
                    _context.TagServices.Add(new TagService
                    {
                        TagId = tagId,
                        ServiceId = serviceId
                    });
                }
            }

            _context.Tags.Update(existingTag);
            await _context.SaveChangesAsync();

            if (hasChanges)
            {
                var affectedInterfaceIds = await _context.PeerTags
                    .Where(pt => pt.TagId == tagId)
                    .Select(pt => pt.Peer.ConfServerId)
                    .Distinct()
                    .ToListAsync();

                foreach (var interfaceId in affectedInterfaceIds)
                {
                    await _firewall.UpdateFirewall($"server_{interfaceId}");
                }
            }

            return true;
        }

        public async Task<List<Service>> GetAllServicesAsync()
        {
            return await _context.Services.ToListAsync();
        }

        public async Task<List<Tag>> GetAllTagsAsync()
        {
            // includo i servizi associati
            return await _context.Tags
                .Include(s => s.TagServices)
                .ThenInclude(ts => ts.Service)
                .ToListAsync();
        }

        public async Task<Tag?> GetTagByIdAsync(int tagId)
        {
            return await _context.Tags
                .Include(t => t.TagServices)
                .ThenInclude(ts => ts.Service)
                .FirstOrDefaultAsync(t => t.Id == tagId);
        }

        public async Task<Service?> GetServiceByIdAsync(int serviceId)
        {
            return await _context.Services
                .FirstOrDefaultAsync(s => s.Id == serviceId);

        }

        public async Task<bool> CreatePolicyAsync(PolicyDTO policy)
        {
            if (policy == null) throw new ArgumentNullException(nameof(policy));

            // Controllo che il tag esista
            var tagExists = await _context.Tags.AnyAsync(t => t.Id == policy.TagID);
            if (!tagExists)
            {
                throw new ArgumentException($"Tag with ID {policy.TagID} not found.");
            }

            // Controllo che la lista dei servizi non sia vuota o nulla
            if (policy.ServiceId == null || policy.ServiceId.Count == 0)
            {
                throw new ArgumentException("At least one service ID must be specified.");
            }

            // Rimuovo eventuali duplicati inviati accidentalmente nel DTO (es. [1, 1, 2])
            var uniqueServiceIds = policy.ServiceId.Distinct().ToList();

            // Controllo che tutti i servizi richiesti esistano nel database
            var existingServicesCount = await _context.Services
                .CountAsync(s => uniqueServiceIds.Contains(s.Id));

            if (existingServicesCount != uniqueServiceIds.Count)
            {
                throw new ArgumentException("One or more specified service IDs are invalid or do not exist.");
            }

            // Recupero le associazioni già esistenti nel DB per evitare duplicati (violazioni di Primary Key)
            var alreadyAssociatedServiceIds = await _context.TagServices
                .Where(ts => ts.TagId == policy.TagID && uniqueServiceIds.Contains(ts.ServiceId))
                .Select(ts => ts.ServiceId)
                .ToListAsync();

            // Filtro gli ID lasciando solo quelli che NON sono ancora associati
            var servicesToAssociate = uniqueServiceIds
                .Where(id => !alreadyAssociatedServiceIds.Contains(id))
                .ToList();

            // Se sono tutti già associati, possiamo decidere se ritornare true direttamente o lanciare un avviso.
            // In questo caso ritorniamo true perché lo stato desiderato (associazione attiva) è già presente.
            if (servicesToAssociate.Count == 0)
            {
                return true;
            }

            // Preparo i nuovi record della tabella ponte
            var newTagServices = servicesToAssociate.Select(serviceId => new TagService
            {
                TagId = policy.TagID,
                ServiceId = serviceId
            });

            // Aggiungo al contesto e salvo
            await _context.TagServices.AddRangeAsync(newTagServices);
            var rowsAffected = await _context.SaveChangesAsync();

            return rowsAffected > 0;
        }
    }
}
