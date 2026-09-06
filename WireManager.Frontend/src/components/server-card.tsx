'use client'

import { useState } from 'react'
import { Copy, Check, Network, Wifi, Pencil, Trash2, RefreshCw } from 'lucide-react'
import type { ConfServer } from '@/lib/types'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ServerCardProps {
  server: ConfServer
  onEdit: (server: ConfServer) => void
  onDelete: (server: ConfServer) => void
  onSync: (server: ConfServer) => void
}

export function ServerCard({ server, onEdit, onDelete, onSync }: ServerCardProps) {
  const [copied, setCopied] = useState(false)

  const truncatedKey =
    server.publicKey.length > 20
      ? `${server.publicKey.slice(0, 10)}…${server.publicKey.slice(-10)}`
      : server.publicKey

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(server.publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{server.endPoint}</CardTitle>
          <Badge variant="secondary">ID: {server.id}</Badge>
        </div>
        <CardDescription>WireGuard Server</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Range IP */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Network className="size-4 text-zinc-500" />
          <span className="text-zinc-300">{server.rangeIP}</span>
        </div>

        {/* Listen Port */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Wifi className="size-4 text-zinc-500" />
          <span className="text-zinc-300">Porta {server.listenPort}</span>
        </div>

        {/* Public Key */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="flex items-center gap-2 font-mono text-xs text-zinc-400"
              >
                <span className="truncate">{truncatedKey}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs break-all font-mono text-xs">
                  {server.publicKey}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyKey}
            className="ml-auto"
          >
            {copied ? (
              <Check className="size-3 text-green-400" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(server)}>
          <Pencil className="size-3.5" />
          Modifica
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(server)}>
          <Trash2 className="size-3.5" />
          Elimina
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-blue-400 hover:text-blue-300"
          onClick={() => onSync(server)}
        >
          <RefreshCw className="size-3.5" />
          Sync
        </Button>
      </CardFooter>
    </Card>
  )
}
