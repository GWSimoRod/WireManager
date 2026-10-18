'use client'

import { useState } from 'react'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CircleCheck,
  Clock3,
  DatabaseBackup,
  Info,
  Loader2,
  RefreshCw,
  Server,
  ShieldAlert,
  Timer,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  useNotifications,
  type UserNotification,
} from '@/lib/use-notifications'
import { cn } from '@/lib/utils'

const typeKeys = ['ids', 'peer', 'server', 'backup', 'system'] as const
const typeIcons = [ShieldAlert, Timer, Server, DatabaseBackup, Info]
const severityKeys = ['info', 'warning', 'critical'] as const

// Older database timestamps may not include an explicit UTC suffix.
function date(value: string) {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`)
}

export function NotificationCenter() {
  const t = useTranslations('Notifications')
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { items, unread, loading, error, pending, refresh, markRead } =
    useNotifications()
  const visible =
    filter === 'unread' ? items.filter((item) => !item.isRead) : items
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const groups: {
    key: 'today' | 'yesterday' | 'earlier'
    items: UserNotification[]
  }[] = [
    {
      key: 'today',
      items: visible.filter((item) => date(item.createdAt) >= today),
    },
    {
      key: 'yesterday',
      items: visible.filter(
        (item) =>
          date(item.createdAt) >= yesterday && date(item.createdAt) < today,
      ),
    },
    {
      key: 'earlier',
      items: visible.filter((item) => date(item.createdAt) < yesterday),
    },
  ]

  async function read(id: number | 'all') {
    if ((await markRead(id)) === false) toast.error(t('readError'))
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) void refresh()
      }}
    >
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative text-zinc-400 hover:text-zinc-100"
            aria-label={t('open', { count: unread })}
          />
        }
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-zinc-950 bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
      >
        <div className="shrink-0 border-b border-zinc-800/80 bg-gradient-to-br from-blue-500/[0.07] via-zinc-950 to-zinc-950 px-5 pb-5 pt-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <BellRing className="size-5" />
            </div>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('close')}
                  className="text-zinc-500 hover:text-zinc-100"
                />
              }
            >
              <X className="size-4" />
            </SheetClose>
          </div>
          <div className="flex items-center gap-2.5">
            <SheetTitle className="text-xl font-semibold tracking-tight text-zinc-100">
              {t('title')}
            </SheetTitle>
            {unread > 0 && (
              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                {unread}
              </span>
            )}
          </div>
          <SheetDescription className="mt-1.5 text-sm text-zinc-400">
            {t('subtitle')}
          </SheetDescription>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-5 py-3">
          <div
            className="flex gap-1 rounded-lg bg-zinc-900 p-1"
            role="group"
            aria-label={t('filter')}
          >
            {(['all', 'unread'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500',
                  filter === value
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {t(value)}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || pending.size > 0 || loading || error}
            aria-busy={pending.has('all')}
            onClick={() => void read('all')}
            className="gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            {pending.has('all') ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            {t('readAll')}
          </Button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          aria-busy={loading}
        >
          {error && (
            <div
              role="alert"
              className="m-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200"
            >
              <p>{t('loadError')}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refresh()}
                className="mt-2 gap-2 text-amber-300"
              >
                <RefreshCw className="size-3.5" />
                {t('retry')}
              </Button>
            </div>
          )}
          {loading ? (
            <div className="space-y-4 p-5" role="status">
              <span className="sr-only">{t('loading')}</span>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border border-zinc-800/60 p-4 motion-safe:animate-pulse"
                >
                  <div className="size-9 shrink-0 rounded-lg bg-zinc-800" />
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-3/4 rounded bg-zinc-800" />
                    <div className="h-2.5 w-full rounded bg-zinc-900" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-900" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 && !error ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-8 py-12 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60">
                {filter === 'unread' ? (
                  <CircleCheck className="size-7 text-emerald-400/80" />
                ) : (
                  <Bell className="size-7 text-zinc-500" />
                )}
              </div>
              <h3 className="text-base font-medium text-zinc-200">
                {t(filter === 'unread' ? 'caughtUp' : 'empty')}
              </h3>
              <p className="mt-2 max-w-64 text-sm leading-relaxed text-zinc-500">
                {t(
                  filter === 'unread'
                    ? 'caughtUpDescription'
                    : 'emptyDescription',
                )}
              </p>
            </div>
          ) : (
            groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section
                  key={group.key}
                  aria-label={t(group.key)}
                  className="px-4 pb-2"
                >
                  <h3 className="px-1 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {t(group.key)}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const Icon = typeIcons[item.type] || Info
                      const severity = severityKeys[item.severity] || 'info'
                      return (
                        <li key={item.id}>
                          <article
                            className={cn(
                              'relative rounded-xl border p-4 transition-colors',
                              item.isRead
                                ? 'border-zinc-800/60 bg-zinc-900/20'
                                : 'border-blue-500/20 bg-blue-500/[0.045]',
                            )}
                          >
                            <div className="flex gap-3">
                              <div
                                className={cn(
                                  'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                                  severity === 'critical'
                                    ? 'border-red-500/20 bg-red-500/10 text-red-400'
                                    : severity === 'warning'
                                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                      : 'border-blue-500/15 bg-blue-500/10 text-blue-400',
                                )}
                              >
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] font-medium">
                                  <span className="uppercase tracking-wider text-zinc-500">
                                    {t(typeKeys[item.type] || 'system')}
                                  </span>
                                  {severity !== 'info' && (
                                    <span
                                      className={cn(
                                        'rounded px-1.5 py-0.5',
                                        severity === 'critical'
                                          ? 'bg-red-500/10 text-red-400'
                                          : 'bg-amber-500/10 text-amber-400',
                                      )}
                                    >
                                      {t(severity)}
                                    </span>
                                  )}
                                  {!item.isRead && (
                                    <span className="ml-auto size-1.5 rounded-full bg-blue-400">
                                      <span className="sr-only">
                                        {t('unread')}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <h4
                                  className={cn(
                                    'break-words text-sm font-medium leading-snug',
                                    item.isRead
                                      ? 'text-zinc-400'
                                      : 'text-zinc-100',
                                  )}
                                >
                                  {item.title}
                                </h4>
                                <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-400">
                                  {item.message}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                  <time
                                    dateTime={date(
                                      item.createdAt,
                                    ).toISOString()}
                                    title={format.dateTime(
                                      date(item.createdAt),
                                      { dateStyle: 'full', timeStyle: 'short' },
                                    )}
                                    className="flex items-center gap-1.5 text-[11px] text-zinc-500"
                                  >
                                    <Clock3 className="size-3" />
                                    {format.relativeTime(
                                      date(item.createdAt),
                                      now,
                                    )}
                                  </time>
                                  {!item.isRead ? (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      disabled={
                                        pending.has(item.id) ||
                                        pending.has('all')
                                      }
                                      aria-busy={pending.has(item.id)}
                                      onClick={() => void read(item.id)}
                                      aria-label={t('readNamed', {
                                        title: item.title,
                                      })}
                                      className="gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                                    >
                                      {pending.has(item.id) ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <Check className="size-3" />
                                      )}
                                      {t('read')}
                                    </Button>
                                  ) : (
                                    <span className="inline-flex h-6 items-center gap-1 text-[10px] text-zinc-500">
                                      <CheckCheck className="size-3" />
                                      {t('alreadyRead')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-800/80 px-5 py-3 text-xs text-zinc-500">
          <span aria-live="polite">
            {loading ? t('loading') : t('remaining', { count: unread })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('refresh')}
            onClick={() => void refresh()}
            disabled={loading || pending.size > 0}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
