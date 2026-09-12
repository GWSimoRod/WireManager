'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface MfaSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  secret: string
  otpauthUri: string
}

export function MfaSetupDialog({
  open,
  onOpenChange,
  secret,
  otpauthUri,
}: MfaSetupDialogProps) {
  const tSettings = useTranslations('Settings')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(true)
  const [hasCopied, setHasCopied] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true

    async function generateQr() {
      if (!otpauthUri) {
        setQrCodeUrl('')
        setIsGeneratingQr(false)
        return
      }

      try {
        setIsGeneratingQr(true)
        const url = await QRCode.toDataURL(otpauthUri, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        })
        if (isMounted) {
          setQrCodeUrl(url)
        }
      } catch (err) {
        console.error('Failed to generate MFA QR Code:', err)
        if (isMounted) {
          setQrCodeUrl('')
        }
      } finally {
        if (isMounted) {
          setIsGeneratingQr(false)
        }
      }
    }

    if (open) {
      generateQr()
      setHasCopied(false)
    }

    return () => {
      isMounted = false
    }
  }, [otpauthUri, open])

  async function handleCopySecret() {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setHasCopied(true)
      toast.success(tSettings('mfaCopied'))
      setTimeout(() => setHasCopied(false), 2500)
    } catch {
      toast.error('Errore durante la copia')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-900/95 text-zinc-100 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-zinc-100">
            {tSettings('mfaSetupTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 max-w-sm mt-1">
            {tSettings('mfaSetupSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center">
            {isGeneratingQr ? (
              <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : qrCodeUrl ? (
              <div className="rounded-2xl bg-white p-3 shadow-xl">
                <img
                  src={qrCodeUrl}
                  alt={tSettings('mfaQrCodeAlt')}
                  className="h-44 w-44 rounded-lg block"
                />
              </div>
            ) : null}
            <p className="mt-3 text-center text-xs text-zinc-400 max-w-xs leading-relaxed">
              {tSettings('mfaInstructions')}
            </p>
          </div>

          {/* Secret Key for Manual Entry */}
          {secret && (
            <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <Label className="text-[11px] font-medium text-zinc-400">
                {tSettings('mfaManualEntry')}
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 font-mono text-xs font-semibold tracking-wider text-blue-400 select-all border border-zinc-800 break-all text-center">
                  {secret}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopySecret}
                  className="shrink-0 cursor-pointer border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {hasCopied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      {tSettings('mfaCopied')}
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {tSettings('mfaCopySecret')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 font-medium transition-all"
          >
            {tSettings('mfaDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
