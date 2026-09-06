'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface QrCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCodeUrl: string | null
  peerName: string
}

export function QrCodeDialog({
  open,
  onOpenChange,
  qrCodeUrl,
  peerName,
}: QrCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Configurazione per <strong>{peerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[200px] items-center justify-center">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt={`QR code per ${peerName}`}
              className="size-full max-w-[256px] rounded-lg"
            />
          ) : (
            <p className="text-center text-sm text-zinc-500">
              Nessun QR code disponibile
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

