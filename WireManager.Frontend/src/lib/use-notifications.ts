'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UserNotification {
  id: number
  title: string
  message: string
  type: number
  severity: number
  createdAt: string
  serverId: number | null
  isRead: boolean
  readAt: string | null
}

export function useNotifications() {
  const [items, setItems] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<number | 'all'>>(new Set())
  const request = useRef<AbortController | null>(null)
  const mutations = useRef(new Map<number | 'all', AbortController>())
  const channel = useRef<BroadcastChannel | null>(null)

  const refresh = useCallback(async () => {
    if (mutations.current.size > 0) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Unable to load notifications')
      const data: UserNotification[] = await response.json()
      if (!controller.signal.aborted) {
        setItems(data)
        setError(false)
      }
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const activeMutations = mutations.current
    const initialRefresh = setTimeout(() => {
      void refresh()
    }, 0)
    let events: EventSource
    let reconnect: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      events = new EventSource('/api/notifications/events')
      events.addEventListener('ready', () => {
        void refresh()
      })
      events.addEventListener('notification', () => {
        void refresh()
      })
      events.onerror = () => {
        events.close()
        // EventSource does not retry every HTTP error (for example an initial 503).
        reconnect = setTimeout(connect, 10_000)
      }
    }
    connect()
    const onFocus = () => {
      if (!document.hidden) void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    // Also reconciles missed events and read state changed on another device.
    const poll = setInterval(onFocus, 60_000)
    const broadcast =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('wm-notifications')
        : null
    channel.current = broadcast
    if (broadcast)
      broadcast.onmessage = () => {
        void refresh()
      }
    return () => {
      clearTimeout(initialRefresh)
      clearTimeout(reconnect)
      events.close()
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      request.current?.abort()
      for (const controller of activeMutations.values()) controller.abort()
      activeMutations.clear()
      broadcast?.close()
      channel.current = null
    }
  }, [refresh])

  const markRead = async (id: number | 'all') => {
    if (
      mutations.current.has(id) ||
      mutations.current.has('all') ||
      (id === 'all' && mutations.current.size > 0)
    )
      return
    request.current?.abort()
    const controller = new AbortController()
    mutations.current.set(id, controller)
    setPending((current) => new Set(current).add(id))
    try {
      const response = await fetch(
        id === 'all'
          ? '/api/notifications/read-all'
          : `/api/notifications/${id}/read`,
        {
          method: 'PATCH',
          signal: controller.signal,
        },
      )
      if (!response.ok) throw new Error('Unable to mark notification as read')
      if (controller.signal.aborted) return
      // Update only the affected rows after confirmation. Keep the list visible
      // while the subsequent background refresh reconciles with the database.
      const readAt = new Date().toISOString()
      setItems((current) =>
        current.map((item) =>
          !item.isRead && (id === 'all' || item.id === id)
            ? { ...item, isRead: true, readAt }
            : item,
        ),
      )
      channel.current?.postMessage('read')
      return true
    } catch {
      if (!controller.signal.aborted) return false
    } finally {
      if (!controller.signal.aborted) {
        mutations.current.delete(id)
        setPending((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
        if (mutations.current.size === 0) void refresh()
      }
    }
  }

  return {
    items,
    loading,
    error,
    pending,
    refresh,
    markRead,
    unread: items.filter((item) => !item.isRead).length,
  }
}
