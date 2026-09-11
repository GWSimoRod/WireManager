'use client'

import { useState } from 'react'
import { usePathname } from '@/i18n/routing'
import { LogOut, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SidebarContent } from '@/components/sidebar'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './language-switcher'

const roleBadgeColors: Record<string, string> = {
  Admin: 'bg-red-500/15 text-red-400 border-red-500/20',
  Operator: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  User: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

export function Navbar() {
  const pathname = usePathname()
  const { logout, username, userRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations('Sidebar')

  // Map paths to translation keys
  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return t('servers')
    if (pathname.startsWith('/peers')) return t('peers')
    if (pathname.startsWith('/tags')) return t('tags')
    if (pathname.startsWith('/services')) return t('services')
    if (pathname.startsWith('/users')) return t('users')
    if (pathname.startsWith('/audit')) return t('audit')
    if (pathname.startsWith('/settings')) return t('settings')
    return t('dashboard')
  }

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
        <h1 className="text-lg font-semibold text-zinc-100">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <Badge
          variant="secondary"
          className={`gap-1.5 max-w-[140px] sm:max-w-[200px] md:max-w-[260px] min-w-0 ${userRole ? roleBadgeColors[userRole] || '' : ''}`}
        >
          <User className="size-3 shrink-0" />
          <span className="truncate" title={username ?? 'User'}>
            {username ?? 'User'}
          </span>
        </Badge>
        <Button variant="ghost" size="icon-sm" onClick={() => logout()}>
          <LogOut className="size-4 text-zinc-400" />
        </Button>
      </div>
    </header>
  )
}
