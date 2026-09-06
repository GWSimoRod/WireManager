'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SidebarContent } from '@/components/sidebar'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Server WireGuard',
  '/peers': 'Gestione Peer',
  '/tags': 'Gestione Tag',
  '/services': 'Gestione Servizi',
  '/users': 'Gestione Utenti',
}

const roleBadgeColors: Record<string, string> = {
  Admin: 'bg-red-500/15 text-red-400 border-red-500/20',
  Operator: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  User: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

export function Navbar() {
  const pathname = usePathname()
  const { logout, username, userRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? 'Dashboard'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 md:px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="text-zinc-400" />}>
              <Menu className="size-5" />
              <span className="sr-only">Toggle Menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 flex flex-col">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
              <SidebarContent onClick={() => setIsOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={`gap-1.5 ${userRole ? roleBadgeColors[userRole] || '' : ''}`}>
          <User className="size-3" />
          <span className="hidden sm:inline">{username ?? 'Utente'}</span>
        </Badge>
        <Button variant="ghost" size="icon-sm" onClick={() => logout()}>
          <LogOut className="size-4 text-zinc-400" />
        </Button>
      </div>
    </header>
  )
}
