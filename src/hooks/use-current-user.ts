'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser, supabaseConfigured } from '@/lib/supabase-browser'

// EduQuest LMS — Hook returning the current authenticated user (Supabase Auth).
// Calls /api/auth/me (server-side) to get the role-enriched profile.
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    supabaseConfigured ? 'loading' : 'unauthenticated'
  )

  useEffect(() => {
    if (!supabaseConfigured) return
    let mounted = true
    const sb = supabaseBrowser()
    let subscription: { unsubscribe: () => void } | null = null

    async function load() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!mounted) return
        if (!res.ok) {
          setUser(null)
          setStatus('unauthenticated')
          return
        }
        const data = await res.json()
        if (!mounted) return
        if (data.user) {
          setUser(data.user)
          setStatus('authenticated')
        } else {
          setUser(null)
          setStatus('unauthenticated')
        }
      } catch {
        if (!mounted) return
        setUser(null)
        setStatus('unauthenticated')
      }
    }

    load()

    try {
      const { data } = sb.auth.onAuthStateChange(() => load())
      subscription = data.subscription
    } catch {}

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { user, status }
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'SUPER_USER' | 'ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'LEARNER'
  grade?: number | null
  phone?: string | null
  avatarColor?: string | null
  schoolId?: string | null
  schoolName?: string | null
  schoolCode?: string | null
}
