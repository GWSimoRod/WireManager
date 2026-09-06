'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Info, CalendarClock, X } from 'lucide-react'
import type { ConfPeer, ConfServer, PeerRequestDTO, Tag } from '@/lib/types'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

// Preset expiration durations
const EXPIRATION_PRESETS: { label: string; days: number }[] = [
  { label: '1 giorno', days: 1 },
  { label: '3 giorni', days: 3 },
  { label: '5 giorni', days: 5 },
  { label: '7 giorni', days: 7 },
  { label: '14 giorni', days: 14 },
  { label: '30 giorni', days: 30 },
]

// Convert a Date to an ISO-like string compatible with datetime-local input (YYYY-MM-DDTHH:mm)
function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface PeerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  peer?: ConfPeer | null
  servers: ConfServer[]
  tags: Tag[]
  peerTagIds: number[]
  onSave: (data: PeerRequestDTO, selectedTagIds: number[]) => Promise<void>
}

export function PeerModal({
  open,
  onOpenChange,
  peer = null,
  servers,
  tags,
  peerTagIds,
  onSave,
}: PeerModalProps) {
  const isEditing = peer !== null
  const [isLoading, setIsLoading] = useState(false)
  const [clientName, setClientName] = useState('')
  const [address, setAddress] = useState('')
  const [dnsAddress, setDnsAddress] = useState('')
  const [allowedIPs, setAllowedIPs] = useState('')
  const [confServerId, setConfServerId] = useState<string>('')
  const [persistentKeepAlive, setPersistentKeepAlive] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<number[]>([])

  // Expiration state: 'none' | 'preset' | 'custom'
  const [expireMode, setExpireMode] = useState<'none' | 'preset' | 'custom'>('none')
  const [expirePresetDays, setExpirePresetDays] = useState<number | null>(null)
  const [expireCustom, setExpireCustom] = useState('') // datetime-local value

  // Minimum date for the custom picker (now)
  const minDateTime = useMemo(() => toDateTimeLocal(new Date()), [])

  // Pre-fill form when editing
  useEffect(() => {
    if (open && peer) {
      setClientName(peer.clientName)
      setAddress(peer.address)
      setDnsAddress(peer.dnsAddress)
      setAllowedIPs(peer.allowedIPs)
      setConfServerId(String(peer.confServerId))
      setPersistentKeepAlive(peer.persistentKeepAlive ? String(peer.persistentKeepAlive) : '')
      setSelectedTags(peerTagIds)

      // Restore expiration state
      if (peer.expireAt) {
        setExpireMode('custom')
        setExpirePresetDays(null)
        const dateStr = peer.expireAt.endsWith('Z') ? peer.expireAt : peer.expireAt + 'Z'
        setExpireCustom(toDateTimeLocal(new Date(dateStr)))
      } else {
        setExpireMode('none')
        setExpirePresetDays(null)
        setExpireCustom('')
      }
    } else if (open && !peer) {
      setClientName('')
      setAddress('')
      setDnsAddress('')
      setAllowedIPs('')
      setConfServerId('')
      setPersistentKeepAlive('')
      setSelectedTags([])
      setExpireMode('none')
      setExpirePresetDays(null)
      setExpireCustom('')
    }
  }, [open, peer, peerTagIds])

  const toggleTag = (id: number) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  // Compute the final expireAt ISO string or null
  function computeExpireAt(): string | null {
    if (expireMode === 'none') return null
    if (expireMode === 'preset' && expirePresetDays !== null) {
      const d = new Date()
      d.setDate(d.getDate() + expirePresetDays)
      d.setHours(0, 0, 0, 0) // expire at midnight
      return d.toISOString()
    }
    if (expireMode === 'custom' && expireCustom) {
      return new Date(expireCustom).toISOString()
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confServerId === '') return
    setIsLoading(true)
    try {
      await onSave(
        {
          clientName,
          address: address.trim() || null,
          dnsAddress,
          allowedIPs,
          confServerId: Number(confServerId),
          expireAt: computeExpireAt(),
          persistentKeepAlive: persistentKeepAlive ? Number(persistentKeepAlive) : null,
        },
        selectedTags
      )
      onOpenChange(false)
    } catch {
      // Error handling is done by the caller
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelectPreset(days: number) {
    setExpireMode('preset')
    setExpirePresetDays(days)
    setExpireCustom('')
  }

  function handleSwitchToCustom() {
    setExpireMode('custom')
    setExpirePresetDays(null)
    // Default to tomorrow
    if (!expireCustom) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setExpireCustom(toDateTimeLocal(tomorrow))
    }
  }

  function handleClearExpiration() {
    setExpireMode('none')
    setExpirePresetDays(null)
    setExpireCustom('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-xl overflow-y-auto p-4 sm:p-6 border-0 sm:border">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifica Peer' : 'Nuovo Peer'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica i parametri del peer.'
              : 'Inserisci i dati per creare un nuovo peer.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Nome Client</Label>
            <Input
              id="clientName"
              placeholder="client-01"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="address">Indirizzo</Label>
              <Tooltip>
                <TooltipTrigger type="button" tabIndex={-1}>
                  <Info className="size-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">Se lasciato vuoto, il server assegnerà automaticamente un indirizzo IP disponibile.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="address"
              placeholder="10.0.0.2/32 (Opzionale)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dnsAddress">DNS</Label>
            <Input
              id="dnsAddress"
              placeholder="1.1.1.1"
              value={dnsAddress}
              onChange={(e) => setDnsAddress(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedIPs">Allowed IPs</Label>
            <Input
              id="allowedIPs"
              placeholder="0.0.0.0/0"
              value={allowedIPs}
              onChange={(e) => setAllowedIPs(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="persistentKeepAlive">Persistent KeepAlive</Label>
              <Tooltip>
                <TooltipTrigger type="button" tabIndex={-1}>
                  <Info className="size-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">Tempo in secondi. Opzionale. Invia pacchetti vuoti a intervalli regolari per mantenere la connessione.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="persistentKeepAlive"
              type="number"
              placeholder="es. 25"
              value={persistentKeepAlive}
              onChange={(e) => setPersistentKeepAlive(e.target.value)}
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label>Server</Label>
            <Select
              value={confServerId}
              onValueChange={(v) => setConfServerId(v ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona server">
                  {confServerId
                    ? servers.find((s) => String(s.id) === confServerId)?.endPoint
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.endPoint} (ID: {s.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Expiration section ── */}
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10">
                  <CalendarClock className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-200">
                    Scadenza
                  </Label>
                  <p className="text-[11px] text-zinc-500 leading-tight">
                    Il peer verrà eliminato automaticamente
                  </p>
                </div>
              </div>
              {expireMode !== 'none' && (
                <button
                  type="button"
                  onClick={handleClearExpiration}
                  className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  title="Rimuovi scadenza"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5">
              {EXPIRATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => handleSelectPreset(preset.days)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    expireMode === 'preset' && expirePresetDays === preset.days
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                      : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSwitchToCustom}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  expireMode === 'custom'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                    : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                Personalizzata
              </button>
            </div>

            {/* Custom datetime picker — animated */}
            <div
              className="grid transition-all duration-300 ease-in-out"
              style={{
                gridTemplateRows: expireMode === 'custom' ? '1fr' : '0fr',
                opacity: expireMode === 'custom' ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <Input
                  id="svc-expire-custom"
                  type="datetime-local"
                  value={expireCustom}
                  min={minDateTime}
                  onChange={(e) => setExpireCustom(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Summary of selected expiration */}
            {expireMode === 'preset' && expirePresetDays !== null && (
              <p className="text-[11px] text-orange-400/70">
                Scade il{' '}
                <span className="font-medium text-orange-300/90">
                  {new Date(Date.now() + expirePresetDays * 86400000).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>{' '}
                a mezzanotte
              </p>
            )}
            {expireMode === 'custom' && expireCustom && (
              <p className="text-[11px] text-orange-400/70">
                Scade il{' '}
                <span className="font-medium text-orange-300/90">
                  {new Date(expireCustom).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            )}
            {expireMode === 'none' && (
              <p className="text-[11px] text-zinc-600 italic">
                Nessuna scadenza impostata
              </p>
            )}
          </div>

          {/* Tag / Policy assignment */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tag (Policy)</Label>
              <p className="text-xs text-zinc-500">
                Seleziona i tag da associare a questo peer.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 space-y-1">
                {tags.map((tag) => {
                  const checked = selectedTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'bg-blue-600/15 text-blue-400'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      }`}
                    >
                      <div
                        className={`size-4 rounded border flex items-center justify-center transition-colors ${
                          checked
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-zinc-600 bg-transparent'
                        }`}
                      >
                        {checked && (
                          <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {((tag.tagServices && tag.tagServices.length > 0) || (tag.services && tag.services.length > 0)) && (
                        <span className="text-xs text-zinc-500">
                          {tag.tagServices ? tag.tagServices.length : tag.services!.length} servizi
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading || confServerId === ''}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
