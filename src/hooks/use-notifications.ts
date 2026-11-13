'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useRealtimeSubscription } from '@/hooks/use-realtime'
import { useState } from 'react'

// EduQuest LMS — Notification hook with realtime updates.
// Polls every 30s as a fallback; realtime updates invalidate the cache
// immediately so new notifications appear without a reload.

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  dataJson?: string | null
}

export function useNotifications(currentUserId?: string) {
  const qc = useQueryClient()
  const [hasNewSinceLastView, setHasNewSinceLastView] = useState(false)

  const query = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ notifications: Notification[] }>('/api/notifications').then((r) => r.notifications),
    refetchInterval: 60_000,  // slower fallback poll — realtime is the main path
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })

  // Single realtime subscription for ALL events (INSERT + UPDATE) — one WebSocket
  // channel instead of two.
  useRealtimeSubscription({
    table: 'notifications',
    filter: currentUserId ? `user_id=eq.${currentUserId}` : undefined,
    event: '*',
    onChange: (payload: any) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      // Only beep + flash on INSERT, not UPDATE
      if (payload?.eventType === 'INSERT') {
        setHasNewSinceLastView(true)
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext
          const ctx = new AC()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = 880; osc.type = 'sine'
          gain.gain.setValueAtTime(0.05, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
          osc.start(); osc.stop(ctx.currentTime + 0.2)
        } catch {}
      }
    },
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setHasNewSinceLastView(false)
    },
  })

  const all = query.data ?? []
  const unread = all.filter((n) => !n.read)

  return {
    all,
    unread,
    loading: query.isLoading,
    hasNewSinceLastView,
    clearNewIndicator: () => setHasNewSinceLastView(false),
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  }
}
