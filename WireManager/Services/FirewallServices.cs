using Microsoft.EntityFrameworkCore;
using WireManager.Core.Data;
using WireManager.Core.DTO;
using WireManager.Core.Interfaces;
using WireManager.Core.Models;
using WireManager.Core.Utils;

namespace WireManager.Core.Services;

public class FirewallServices(
    WireManagerContext context,
    IWireguardOps wireguardOps) : IFirewallServices
{
    private readonly WireManagerContext _context = context;
    private readonly IWireguardOps _wireguardOps = wireguardOps;

    private async Task InitializeFirewall(string interfaceName)
    {
        string chainName = $"WIREMANAGER-FW-{interfaceName}";

        await ExecuteIptablesAsync($"iptables -N {chainName}", ignoreErrors: true);

        bool ruleExists = await ExecuteIptablesAsync(
            $"iptables -C FORWARD -i {interfaceName} -j {chainName}",
            ignoreErrors: true);

        if (!ruleExists)
        {
            // Usa -I FORWARD 1 per forzare il salto come PRIMA REGOLA IN ASSOLUTO
            await ExecuteIptablesAsync(
                $"iptables -I FORWARD 1 -i {interfaceName} -j {chainName}");
        }
    }

    private string BuildIptablesRule(string chain, string? srcIp, string destIp, string protocol, int port)
    {
        string proto = protocol.Trim().ToLowerInvariant();
        string srcPart = string.IsNullOrWhiteSpace(srcIp) ? "" : $"-s {srcIp} ";

        return proto switch
        {
            "all" or "any" =>
                $"iptables -A {chain} {srcPart}-d {destIp} -j ACCEPT",

            "icmp" or "esp" or "gre" or "igmp" =>
                $"iptables -A {chain} {srcPart}-d {destIp} -p {proto} -j ACCEPT",

            _ => // Per default (TCP, UDP, SCTP, ecc.)
                $"iptables -A {chain} {srcPart}-d {destIp} -p {proto} --dport {port} -j ACCEPT"
        };
    }

    public async Task UpdateFirewall(string interfaceName)
    {
        string chainName = $"WIREMANAGER-FW-{interfaceName}";

        // Inizializza la chain e l'aggancio a FORWARD (1 o 2 esecuzioni, accettabile)
        await InitializeFirewall(interfaceName);

        var parts = interfaceName.Split('_');
        if (parts.Length < 2 || !int.TryParse(parts[1], out int serverId))
        {
            throw new ArgumentException($"Invalid interface name: {interfaceName}");
        }

        var globalServices = await _context.Set<Service>()
        .AsNoTracking()
        .Where(s => s.IsGlobal)
        .Select(s => new
        {
            DestIp = s.TargetIp,
            Port = s.Port,
            Protocol = s.Protocol
        })
        .Distinct()
        .ToListAsync();

        var activeRules = await _context.Set<PeerTag>()
            .AsNoTracking()
            .Where(pt => pt.Peer.IsActive && pt.Peer.ConfServerId == serverId)
            .SelectMany(pt => pt.Tag.TagServices
                .Where(ts => !ts.Service.IsGlobal)
                .Select(ts => new RuleFirewallDTO
                {
                    SrcIp = pt.Peer.Address,
                    DestIp = ts.Service.TargetIp,
                    Port = ts.Service.Port,
                    Protocol = ts.Service.Protocol
                }))
                .Distinct()
            .ToListAsync();

        var scriptLines = new List<string>
            {
                "#!/bin/sh",
                // Pulisce la chain
                $"iptables -F {chainName}",
                // REGOLA FONDAMENTALE: Accetta il traffico di ritorno delle connessioni avviate
                $"iptables -A {chainName} -m state --state RELATED,ESTABLISHED -j ACCEPT"
            };

        // Servizi Globali (srcIp è null o vuoto)
        foreach (var service in globalServices)
        {
            scriptLines.Add(BuildIptablesRule(chainName, null, service.DestIp, service.Protocol, service.Port));
        }

        // Servizi Assegnati ai Peer
        foreach (var rule in activeRules)
        {
            scriptLines.Add(BuildIptablesRule(chainName, rule.SrcIp, rule.DestIp, rule.Protocol, rule.Port));
        }

        // Regola di drop finale
        scriptLines.Add($"iptables -A {chainName} -j DROP");

        string scriptName = $"fw_update_{serverId}.sh";
        string localScriptPath = Path.Combine(DiskOps._baseFolderPathServer, scriptName);

        // Assumiamo che il mount sia sempre /config/wg_confs/ in Docker
        string containerScriptPath = $"/config/wg_confs/{scriptName}";

        await File.WriteAllLinesAsync(localScriptPath, scriptLines);

        try
        {
            // Usa sh per eseguire il file generato
            var result = await _wireguardOps.ExecuteCommandAsync("sh", containerScriptPath);

            if (result.ExitCode != 0)
            {
                throw new InvalidOperationException($"Iptables batch error: {result.Error}");
            }
        }
        finally
        {
            if (File.Exists(localScriptPath))
            {
                File.Delete(localScriptPath);
            }
        }
    }

    private async Task<bool> ExecuteIptablesAsync(
        string command,
        bool ignoreErrors = false)
    {
        var parts = command.Split(
            ' ',
            StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length == 0)
        {
            throw new ArgumentException(
                "Empty iptables command.",
                nameof(command));
        }

        string executable = parts[0];

        string arguments = string.Join(
            ' ',
            parts.Skip(1));

        var result = await _wireguardOps.ExecuteCommandAsync(
            executable,
            arguments);

        if (result.ExitCode == 0)
        {
            return true;
        }

        if (ignoreErrors)
        {
            return false;
        }

        throw new InvalidOperationException(
            $"Error executing command in WireGuard container: " +
            $"{command}\n" +
            $"ExitCode: {result.ExitCode}\n" +
            $"Error: {result.Error}");
    }
}
