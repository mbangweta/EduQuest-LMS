'use client'

import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useRealtimeSubscription } from '@/hooks/use-realtime'
import { useEffect, useRef, useState } from 'react'

// ============================================================================
// useRealtimeQuery — TanStack Query + Supabase Realtime
// ============================================================================
// A drop-in replacement for `useQuery` that automatically invalidates the
// cache when matching rows change in the database. Returns the same shape
// as useQuery plus a `lastUpdatedAt` timestamp for "live" indicators.
//
// Usage:
//   const { data, isLoading, lastUpdatedAt } = useRealtimeQuery({
//     queryKey: ['classes'],
//     queryFn: () => fetch('/api/classes').then(r => r.json()),
//     table: 'classes',
//     event: '*',           // optional, defaults to '*'
//     filter: undefined,    // optional, e.g. 'teacher_id=eq.abc-123'
//   })
// ============================================================================

interface RealtimeQueryOptions<T> {
  queryKey: QueryKey
  queryFn: () => Promise<T>
  table: string
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  enabled?: boolean
  staleTime?: number
}

export function useRealtimeQuery<T>({
  queryKey, queryFn, table, filter, event = '*', enabled = true, staleTime = 30_000,
}: RealtimeQueryOptions<T>) {
  const qc = useQueryClient()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now())

  const query = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const data = await queryFn()
      setLastUpdatedAt(Date.now())
      return data
    },
    enabled,
    staleTime,
    refetchOnWindowFocus: true,
  })

  useRealtimeSubscription({
    table,
    filter,
    event,
    enabled,
    onChange: () => {
      qc.invalidateQueries({ queryKey })
      setLastUpdatedAt(Date.now())
    },
  })

  return {
    ...query,
    lastUpdatedAt,
  }
}

// ============================================================================
// useLiveCount — subscribe to a table's row count via realtime
// ============================================================================

interface LiveCountOptions {
  queryKey: QueryKey
  queryFn: () => Promise<number>
  table: string
  filter?: string
  onInsert?: () => number  // delta to add (default +1)
  onDelete?: () => number  // delta to subtract (default -1)
  enabled?: boolean
}

export function useLiveCount({
  queryKey, queryFn, table, filter, onInsert, onDelete, enabled = true,
}: LiveCountOptions) {
  const qc = useQueryClient()
  const query = useQuery<number>({
    queryKey,
    queryFn,
    enabled,
    staleTime: 60_000,
  })

  useRealtimeSubscription({
    table,
    filter,
    event: 'INSERT',
    enabled,
    onChange: () => {
      qc.setQueryData(queryKey, (old: number | undefined) => (old ?? 0) + (onInsert ? onInsert() : 1))
    },
  })

  useRealtimeSubscription({
    table,
    filter,
    event: 'DELETE',
    enabled,
    onChange: () => {
      qc.setQueryData(queryKey, (old: number | undefined) => (old ?? 0) + (onDelete ? onDelete() : -1))
    },
  })

  return query
}
