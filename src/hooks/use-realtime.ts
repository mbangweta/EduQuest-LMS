'use client'

import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// useRealtimeSubscription — subscribe to Postgres Changes on a table
// ============================================================================
// Calls `callback` whenever an INSERT/UPDATE/DELETE event matches the filter.
// Use this with TanStack Query's `invalidateQueries` for instant UI refresh.
//
// Usage:
//   useRealtimeSubscription({
//     table: 'notifications',
//     filter: 'user_id=eq.abc-123',   // optional
//     event: 'INSERT',                 // optional, defaults to '*'
//     onChange: () => qc.invalidateQueries(['notifications']),
//   })
// ============================================================================

interface RealtimeOptions {
  /** Table name (without schema, e.g. 'notifications', 'quiz_attempts') */
  table: string
  /** Optional Postgres filter, e.g. 'user_id=eq.abc-123' */
  filter?: string
  /** Optional event type: 'INSERT' | 'UPDATE' | 'DELETE' | '*' (default '*') */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** Called when a matching change occurs. Receives the payload. */
  onChange?: (payload: any) => void
  /** Enable/disable the subscription (default true) */
  enabled?: boolean
}

export function useRealtimeSubscription({
  table,
  filter,
  event = '*',
  onChange,
  enabled = true,
}: RealtimeOptions) {
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!enabled) return
    let channel: any
    try {
      const sb = supabaseBrowser() as SupabaseClient
      const channelName = `realtime-${table}-${filter || 'all'}-${event}-${Math.random().toString(36).slice(2, 8)}`
      let c = sb.channel(channelName)
      const opts: any = { event, schema: 'public', table }
      if (filter) opts.filter = filter
      c = c.on('postgres_changes', opts, (payload: any) => {
        try { cbRef.current?.(payload) } catch (e) { console.error('[realtime] callback error', e) }
      })
      c.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[realtime] channel ${channelName} status: ${status}`)
        }
      })
      channel = c
    } catch (e) {
      console.warn('[realtime] subscription failed', e)
    }
    return () => {
      try {
        if (channel) {
          const sb = supabaseBrowser() as SupabaseClient
          sb.removeChannel(channel)
        }
      } catch {}
    }
  }, [table, filter, event, enabled])
}

// ============================================================================
// useRealtimePresence — show who's currently online (presence channel)
// ============================================================================

interface PresenceUser {
  userId: string
  name: string
  role: string
  onlineAt: number
}

interface PresenceOptions {
  channelName?: string
  user: { userId: string; name: string; role: string } | null
  enabled?: boolean
}

export function useRealtimePresence({
  channelName = 'eduquest-presence',
  user,
  enabled = true,
}: PresenceOptions) {
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!enabled || !user) return
    let c: any
    try {
      const sb = supabaseBrowser() as SupabaseClient
      const myState: PresenceUser = {
        userId: user.userId, name: user.name, role: user.role, onlineAt: Date.now(),
      }
      c = sb.channel(channelName, { config: { presence: { key: user.userId } } })
        .on('presence', { event: 'sync' }, () => {
          const state = c.presenceState()
          const users = Object.values(state).flat() as PresenceUser[]
          setOnlineCount(users.length)
          window.dispatchEvent(new CustomEvent('eduquest-presence-sync', { detail: users }))
        })
        .on('presence', { event: 'join' }, ({ newPresences }: any) => {
          window.dispatchEvent(new CustomEvent('eduquest-presence-join', { detail: newPresences }))
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
          window.dispatchEvent(new CustomEvent('eduquest-presence-leave', { detail: leftPresences }))
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            try { await c.track(myState) } catch {}
          }
        })
    } catch (e) {
      console.warn('[realtime presence] failed', e)
    }
    return () => {
      try {
        if (c) {
          c.untrack()
          const sb = supabaseBrowser() as SupabaseClient
          sb.removeChannel(c)
        }
      } catch {}
    }
  }, [enabled, user?.userId, user?.name, user?.role, channelName])

  return { onlineCount }
}

// Helper: subscribe to presence-sync events from any component
export function onPresenceUpdate(cb: (users: PresenceUser[]) => void): () => void {
  const handler = (e: any) => cb(e.detail || [])
  window.addEventListener('eduquest-presence-sync', handler)
  return () => window.removeEventListener('eduquest-presence-sync', handler)
}
