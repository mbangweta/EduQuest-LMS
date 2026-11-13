'use client'

import { useEffect, useState } from 'react'
import { supabaseConfigured } from '@/lib/supabase-browser'
import { api } from '@/lib/api-client'

// Academic Year hook — fetches the user's school's academic years, persists
// the selected year to localStorage, and broadcasts changes via a custom event.
export interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string
}

export function useAcademicYear(schoolId?: string | null) {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [currentYearId, setCurrentYearId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!schoolId && supabaseConfigured)

  useEffect(() => {
    let cancelled = false
    if (!supabaseConfigured || !schoolId) return
    api.get<{ academicYears: AcademicYear[] }>('/api/academic-years').then((r) => {
      if (cancelled) return
      setYears(r.academicYears || [])
      const stored = typeof window !== 'undefined'
        ? window.localStorage.getItem(`eduquest-academic-year-${schoolId}`)
        : null
      const initial = stored && r.academicYears.find((y) => y.id === stored)
        ? stored
        : (r.academicYears.find((y) => y.is_current)?.id ?? r.academicYears[0]?.id ?? null)
      setCurrentYearId(initial)
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [schoolId])

  const setYear = (id: string) => {
    setCurrentYearId(id)
    if (schoolId && typeof window !== 'undefined') {
      window.localStorage.setItem(`eduquest-academic-year-${schoolId}`, id)
      window.dispatchEvent(new CustomEvent('eduquest-academic-year-changed', { detail: { schoolId, yearId: id } }))
    }
  }

  const currentYear = years.find((y) => y.id === currentYearId) || null

  return {
    years,
    currentYearId,
    currentYear,
    setYear,
    loading,
  }
}
