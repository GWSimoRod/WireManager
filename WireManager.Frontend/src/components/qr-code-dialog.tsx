'use client'

import { useTranslations } from "next-intl";

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
  const tPeers = useTranslations("Peers");
  const tCommon = useTranslations("Common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tPeers("qrCodeTitle")}</DialogTitle>
          <DialogDescription>
            {tPeers("qrCodeConfigFor")} <strong>{peerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[200px] items-center justify-center">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt={`QR code ${peerName}`}
              className="size-full max-w-[256px] rounded-lg"
            />
          ) : (
            <p className="text-center text-sm text-zinc-500">
              {tPeers("noQrCode")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

