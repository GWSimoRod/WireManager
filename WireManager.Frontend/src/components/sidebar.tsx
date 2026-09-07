'use client'

import { Link, usePathname } from '@/i18n/routing'
import { Shield, Monitor, Users, Tags, Server, LogOut, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export function SidebarContent({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname()
  const { logout, userRole } = useAuth()
  const t = useTranslations('Sidebar')
  const tCommon = useTranslations('Common')

  const navLinks = [
    { href: '/peers', label: t('peers'), icon: Users },
    { href: '/tags', label: t('tags'), icon: Tags },
    { href: '/services', label: t('services'), icon: Server },
  ]

  const adminLinks = [
    { href: '/dashboard', label: t('servers'), icon: Monitor },
    { href: '/users', label: t('users'), icon: UserPlus },
  ]

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <Shield className="size-6 text-blue-500" />
        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          WireManager
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}

        {/* Admin-only links */}
        {userRole === 'Admin' && (
          <>
            <div className="my-2 h-px shrink-0 bg-zinc-800" />
            {adminLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClick}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600/15 text-blue-400'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-zinc-800 p-3 shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-zinc-400 hover:text-red-400"
          onClick={() => {
            onClick?.()
            logout()
          }}
        >
          <LogOut className="size-4" />
          {tCommon('logout')}
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <SidebarContent />
    </aside>
  )
}
