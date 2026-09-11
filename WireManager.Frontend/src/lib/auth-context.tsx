'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type UserRole = 'Admin' | 'Operator' | 'Disabled'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  username: string | null
  userRole: UserRole | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const router = useRouter()

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUsername(data.username || null)
        setUserRole(data.role || null)
      }
    } catch {
      // ignore — user info is best-effort
    }
  }, [])

  const checkSession = useCallback(async () => {
    try {
      // First check if setup is required
      try {
        const setupRes = await fetch('/api/setup/status')
        if (setupRes.ok) {
          const setupData = await setupRes.json()
          if (!setupData.isSetupCompleted) {
            setIsAuthenticated(false)
            if (!window.location.pathname.startsWith('/setup')) {
              router.push('/setup')
            }
            return
          }
        }
      } catch (e) {
        // Ignore network errors here and continue to auth check
      }

      const res = await fetch('/api/auth/check')
      if (res.ok) {
        const data = await res.json()
        const authed = data.authenticated === true
        setIsAuthenticated(authed)
        if (authed) {
          await fetchUserInfo()
        }
      } else {
        setIsAuthenticated(false)
      }
    } catch {
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [fetchUserInfo, router])

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Credenziali non valide')
      }

      setIsAuthenticated(true)
      await fetchUserInfo()
    },
    [fetchUserInfo]
  )

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setIsAuthenticated(false)
      setUsername(null)
      setUserRole(null)
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <AuthContext value={{ isAuthenticated, isLoading, username, userRole, login, logout, checkSession }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
