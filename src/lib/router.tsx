'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// EduQuest LMS — Client-side router via URL hash sync.
// Single-page architecture: views swap based on `view` state, no Next page routes.

export interface RouterState {
  view: string
  params: Record<string, string>
  navigate: (view: string, params?: Record<string, string>) => void
  back: () => void
}

const RouterContext = createContext<RouterState | null>(null)

const DEFAULT_VIEW = 'login'

function parseHash(): { view: string; params: Record<string, string> } {
  if (typeof window === 'undefined') return { view: DEFAULT_VIEW, params: {} }
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash) return { view: DEFAULT_VIEW, params: {} }
  const [path, queryStr] = hash.split('?')
  const parts = path.split('/').filter(Boolean)
  // views are dotted: e.g. teacher.classes, learner.quiz-take
  // The hash format is: #/teacher/classes?classId=xxx
  // We join the first two segments with a dot.
  let view = parts.length > 0 ? parts.join('.') : DEFAULT_VIEW
  if (parts.length > 2) view = parts.slice(0, 2).join('.') + '.' + parts.slice(2).join('.')
  const params: Record<string, string> = {}
  if (queryStr) {
    for (const kv of queryStr.split('&')) {
      const [k, v] = kv.split('=')
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
    }
  }
  return { view, params }
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ view: string; params: Record<string, string> }>(() => parseHash())

  useEffect(() => {
    const onHashChange = () => setState(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((view: string, params: Record<string, string> = {}) => {
    const queryStr = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    const hash = `#/${view.replace(/\./g, '/')}${queryStr ? `?${queryStr}` : ''}`
    if (window.location.hash !== hash) {
      window.location.hash = hash
    } else {
      setState({ view, params })
    }
  }, [])

  const back = useCallback(() => {
    window.history.back()
  }, [])

  return (
    <RouterContext.Provider value={{ view: state.view, params: state.params, navigate, back }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}
