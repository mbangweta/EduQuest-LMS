'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  FileText, CheckCircle2, Clock, ArrowLeft, BookOpen, Search, ChevronRight,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/views/shared/empty-state'

interface Lesson {
  id: string
  title: string
  topic: string
  grade: number
  subjectId: string
  completed: boolean
  subject?: { id: string; name: string; code?: string; color?: string }
}

interface SubjectGroup {
  id: string
  name: string
  code?: string
  color?: string
  total: number
  completed: number
  lessons: Lesson[]
}

const SUBJECT_COLOR_FALLBACK = '#0f766e' // teal-700

export function LearnerLessonsView() {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    api.get('/api/analytics/learner')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  // Group lessons by subject — only subjects with at least 1 lesson appear
  const subjectGroups: SubjectGroup[] = useMemo(() => {
    const lessons: Lesson[] = (data?.availableLessons ?? []) as Lesson[]
    const map = new Map<string, SubjectGroup>()
    for (const l of lessons) {
      const subj = l.subject ?? { id: l.subjectId, name: 'Unknown subject' }
      const key = subj.id ?? l.subjectId ?? 'unknown'
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: subj.name ?? 'Unknown subject',
          code: subj.code,
          color: subj.color,
          total: 0,
          completed: 0,
          lessons: [],
        })
      }
      const g = map.get(key)!
      g.total += 1
      if (l.completed) g.completed += 1
      g.lessons.push(l)
    }
    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ ...g, lessons: g.lessons.sort((a, b) => a.title.localeCompare(b.title)) }))
  }, [data])

  const selectedGroup = selectedSubjectId
    ? subjectGroups.find((g) => g.id === selectedSubjectId) ?? null
    : null

  const visibleLessons = useMemo(() => {
    if (!selectedGroup) return []
    if (!q.trim()) return selectedGroup.lessons
    const needle = q.toLowerCase()
    return selectedGroup.lessons.filter((l) =>
      `${l.title} ${l.topic}`.toLowerCase().includes(needle),
    )
  }, [selectedGroup, q])

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  // ───────── Stage 2: Lessons inside a subject ─────────
  if (selectedGroup) {
    const accent = selectedGroup.color || SUBJECT_COLOR_FALLBACK
    const pct = selectedGroup.total > 0
      ? Math.round((selectedGroup.completed / selectedGroup.total) * 100)
      : 0
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedSubjectId(null); setQ('') }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> All subjects
        </Button>

        <div
          className="flex items-start gap-3 rounded-lg border p-4"
          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{selectedGroup.name}</h1>
              {selectedGroup.code && <Badge variant="outline">{selectedGroup.code}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedGroup.completed} of {selectedGroup.total} lesson{selectedGroup.total === 1 ? '' : 's'} completed
            </p>
            <div className="mt-2 max-w-xs">
              <Progress value={pct} className="h-2" />
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lessons in this subject…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {visibleLessons.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No lessons found"
            description={q ? 'Try a different search term.' : 'No lessons have been assigned for this subject yet.'}
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLessons.map((l) => (
              <Card
                key={l.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('learner.lesson-view', { lessonId: l.id })}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{l.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{l.topic} · Grade {l.grade}</div>
                    </div>
                    {l.completed ? (
                      <Badge variant="default" className="bg-accent text-accent-foreground shrink-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Done
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0"><Clock className="mr-1 h-3 w-3" /> To do</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ───────── Stage 1: Choose a subject ─────────
  if (subjectGroups.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Lessons</h1>
          <p className="text-sm text-muted-foreground">Pick a subject, then choose your lesson.</p>
        </div>
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No lessons yet"
          description="Lessons will appear here once your teacher assigns them to your classes."
        />
      </div>
    )
  }

  const totalLessons = subjectGroups.reduce((a, g) => a + g.total, 0)
  const totalCompleted = subjectGroups.reduce((a, g) => a + g.completed, 0)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lessons</h1>
          <p className="text-sm text-muted-foreground">
            Choose a subject, then pick the lesson you want to open.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {totalCompleted} / {totalLessons} lessons completed
        </Badge>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {subjectGroups.map((g) => {
          const accent = g.color || SUBJECT_COLOR_FALLBACK
          const pct = g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0
          return (
            <Card
              key={g.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => { setSelectedSubjectId(g.id); setQ('') }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: accent }}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{g.name}</div>
                      {g.code && <Badge variant="outline" className="text-[10px]">{g.code}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {g.total} lesson{g.total === 1 ? '' : 's'}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{g.completed} completed</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
