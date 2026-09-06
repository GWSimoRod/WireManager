'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { ConfServer, ServerRequestDTO } from '@/lib/types'
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
import { Button } from '@/components/ui/button'

interface ServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server?: ConfServer | null
  onSave: (data: ServerRequestDTO) => Promise<void>
}

export function ServerDialog({
  open,
  onOpenChange,
  server = null,
  onSave,
}: ServerDialogProps) {
  const isEditing = server !== null
  const [isLoading, setIsLoading] = useState(false)
  const [rangeIP, setRangeIP] = useState('')
  const [listenPort, setListenPort] = useState('')
  const [endPoint, setEndPoint] = useState('')

  // Pre-fill form when editing
  useEffect(() => {
    if (open && server) {
      setRangeIP(server.rangeIP)
      setListenPort(String(server.listenPort))
      setEndPoint(server.endPoint)
    } else if (open && !server) {
      setRangeIP('')
      setListenPort('')
      setEndPoint('')
    }
  }, [open, server])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSave({
        rangeIP,
        listenPort: Number(listenPort),
        endPoint,
      })
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
          <DialogTitle>
            {isEditing ? 'Modifica Server' : 'Nuovo Server'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica i parametri del server WireGuard.'
              : 'Inserisci i dati per creare un nuovo server WireGuard.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rangeIP">Range IP</Label>
            <Input
              id="rangeIP"
              placeholder="10.0.0.0/24"
              value={rangeIP}
              onChange={(e) => setRangeIP(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listenPort">Listen Port</Label>
            <Input
              id="listenPort"
              type="number"
              placeholder="51820"
              value={listenPort}
              onChange={(e) => setListenPort(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endPoint">Endpoint</Label>
            <Input
              id="endPoint"
              placeholder="vpn.example.com"
              value={endPoint}
              onChange={(e) => setEndPoint(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
