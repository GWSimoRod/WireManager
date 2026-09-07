'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Globe, Lightbulb, X } from 'lucide-react'
import type { CreateServicePayload } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'

// Protocols that do NOT use a port (matched to the backend iptables rules)
const PORTLESS_PROTOCOLS = new Set(['ALL', 'ICMP', 'ESP', 'GRE', 'IGMP'])

function protocolNeedsPort(proto: string): boolean {
  return !PORTLESS_PROTOCOLS.has(proto.toUpperCase())
}

// Well-known services that are typically configured as global
// Each entry: [keywords to match in the name, human-readable label]
const GLOBAL_SERVICE_HINTS: { keywords: string[]; label: string }[] = [
  { keywords: ['dns'],              label: 'DNS' },
  { keywords: ['nginx', 'reverse proxy', 'reverseproxy'], label: 'Nginx / Reverse Proxy' },
  { keywords: ['dhcp'],             label: 'DHCP' },
  { keywords: ['ntp', 'time server', 'timeserver'], label: 'NTP' },
  { keywords: ['ldap', 'active directory', 'activedirectory'], label: 'LDAP / Active Directory' },
  { keywords: ['radius'],           label: 'RADIUS' },
  { keywords: ['syslog', 'logging'], label: 'Syslog' },
  { keywords: ['smtp', 'mail server', 'mailserver', 'postfix'], label: 'SMTP / Mail' },
  { keywords: ['proxy', 'squid', 'forward proxy', 'forwardproxy'], label: 'Proxy' },
  { keywords: ['monitoring', 'prometheus', 'grafana', 'zabbix', 'nagios'], label: 'Monitoring' },
  { keywords: ['vpn gateway', 'vpngateway', 'gateway'], label: 'VPN Gateway' },
  { keywords: ['firewall', 'pfsense', 'opnsense'], label: 'Firewall' },
  { keywords: ['ca', 'certificate authority', 'pki'], label: 'Certificate Authority (PKI)' },
  { keywords: ['nfs', 'file server', 'fileserver', 'samba', 'smb', 'cifs'], label: 'File Server / NFS' },
  { keywords: ['haproxy', 'load balancer', 'loadbalancer', 'traefik'], label: 'Load Balancer' },
  { keywords: ['apt', 'yum', 'package mirror', 'repo mirror'], label: 'Package Mirror' },
  { keywords: ['backup', 'restic', 'borgbackup', 'borg'], label: 'Backup' },
  { keywords: ['antivirus', 'clamav', 'endpoint protection'], label: 'Antivirus / Endpoint Protection' },
]

function matchGlobalServiceHint(name: string): string | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const hint of GLOBAL_SERVICE_HINTS) {
    for (const kw of hint.keywords) {
      if (lower.includes(kw)) {
        return hint.label
      }
    }
  }
  return null
}

interface ServiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreateServicePayload) => Promise<void>
}

export function ServiceModal({
  open,
  onOpenChange,
  onSave,
}: ServiceModalProps) {
  const t = useTranslations('Services')
  const tCommon = useTranslations('Common')
  const tDialogs = useTranslations('Dialogs')
  
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState('TCP')
  const [targetIp, setTargetIp] = useState('')
  const [domain, setDomain] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // Detect whether the typed name matches a well-known global service
  const globalHintLabel = useMemo(() => matchGlobalServiceHint(name), [name])

  // Show the suggestion only when relevant and not yet dismissed/applied
  const showGlobalSuggestion = !!globalHintLabel && !isGlobal && !suggestionDismissed

  useEffect(() => {
    if (open) {
      setName('')
      setPort('')
      setProtocol('TCP')
      setTargetIp('')
      setDomain('')
      setIsGlobal(false)
      setSuggestionDismissed(false)
    }
  }, [open])

  // Reset dismissal when the matched hint changes (user typed a different service)
  useEffect(() => {
    setSuggestionDismissed(false)
  }, [globalHintLabel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const needsPort = protocolNeedsPort(protocol)
      const payload: CreateServicePayload = {
        name,
        port: needsPort ? Number(port) : 0,
        protocol: protocol.toLowerCase(),
        targetIp,
        isGlobal,
      }
      if (domain.trim()) {
        payload.domain = domain.trim()
      }
      await onSave(payload)
      onOpenChange(false)
    } catch {
      // Error handling is done by the caller
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-xl overflow-y-auto p-4 sm:p-6 border-0 sm:border">
        <DialogHeader>
          <DialogTitle>{t('modalTitle')}</DialogTitle>
          <DialogDescription>
            {t('modalDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="svc-name">{tCommon('name')}</Label>
            <Input
              id="svc-name"
              placeholder={t('placeholderName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* ── Global service suggestion banner ── */}
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{
              gridTemplateRows: showGlobalSuggestion ? '1fr' : '0fr',
              opacity: showGlobalSuggestion ? 1 : 0,
            }}
          >
            <div className="overflow-hidden">
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 mt-0.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-300/90">
                    {t('suggestion')}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    <span className="text-zinc-300 font-medium">{globalHintLabel}</span>{' '}
                    {t('suggestionText1')}
                    <br />
                    {t('suggestionText2')}{' '}
                    <span className="text-amber-400/80 font-medium">{t('globalFlag')}</span>.
                  </p>
                  <button
                    type="button"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    onClick={() => {
                      setIsGlobal(true)
                      setSuggestionDismissed(false)
                    }}
                  >
                    <Globe className="h-3 w-3" />
                    {t('enableGlobal')}
                  </button>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() => setSuggestionDismissed(true)}
                  aria-label={t('closeSuggestion')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('protocol')}</Label>
            <Select value={protocol} onValueChange={(v) => { setProtocol(v ?? 'TCP'); if (!protocolNeedsPort(v ?? 'TCP')) setPort(''); }}>
              <SelectTrigger className="w-full">
                <SelectValue>{protocol}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TCP">TCP</SelectItem>
                <SelectItem value="UDP">UDP</SelectItem>
                <SelectItem value="SCTP">SCTP</SelectItem>
                <Separator className="my-1" />
                <SelectItem value="ICMP">ICMP</SelectItem>
                <SelectItem value="ESP">ESP</SelectItem>
                <SelectItem value="GRE">GRE</SelectItem>
                <SelectItem value="IGMP">IGMP</SelectItem>
                <Separator className="my-1" />
                <SelectItem value="ALL">{t('allProtocols')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Port field — only shown for protocols that use a port */}
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{
              gridTemplateRows: protocolNeedsPort(protocol) ? '1fr' : '0fr',
              opacity: protocolNeedsPort(protocol) ? 1 : 0,
            }}
          >
            <div className="overflow-hidden">
              <div className="space-y-2">
                <Label htmlFor="svc-port">{t('portLabel')}</Label>
                <Input
                  id="svc-port"
                  type="number"
                  placeholder={t('placeholderPort')}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  required={protocolNeedsPort(protocol)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="svc-ip">{t('targetIp')}</Label>
            <Input
              id="svc-ip"
              placeholder={t('placeholderIp')}
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="svc-domain">{t('domain')} <span className="text-zinc-500 font-normal">{t('optional')}</span></Label>
            <Input
              id="svc-domain"
              placeholder={t('placeholderDomain')}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
                <Globe className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <Label htmlFor="svc-global" className="text-sm font-medium text-zinc-200 cursor-pointer">
                  {t('globalFlag')}
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t('globalFlagDesc')}
                </p>
              </div>
            </div>
            <Switch
              id="svc-global"
              checked={isGlobal}
              onCheckedChange={(checked) => setIsGlobal(checked)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tDialogs('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || (protocolNeedsPort(protocol) && !port) || !targetIp.trim()}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
