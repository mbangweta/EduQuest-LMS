'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Copy, Trash2, Eye, Archive, Loader2, FileText, Sparkles,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { Markdown } from '@/components/views/shared/markdown'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  PUBLISHED: 'bg-accent/15 text-accent-foreground border-accent/30',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
}

export function TeacherLessonsView() {
  const { navigate } = useRouter()
  const [lessons, setLessons] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState('ALL')
  const [subjectId, setSubjectId] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [view, setView] = useState<any | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<{ lessons: any[] }>('/api/lessons'),
      api.get<{ subjects: any[] }>('/api/subjects'),
    ]).then(([l, s]) => { setLessons(l.lessons); setSubjects(s.subjects) }).finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const r = await api.get<{ lessons: any[] }>('/api/lessons')
    setLessons(r.lessons)
  }

  const filtered = lessons.filter((l) => {
    if (grade !== 'ALL' && String(l.grade) !== grade) return false
    if (subjectId !== 'ALL' && l.subjectId !== subjectId) return false
    if (status !== 'ALL' && l.status !== status) return false
    if (q && !(`${l.title} ${l.topic}`.toLowerCase().includes(q.toLowerCase()))) return false
    return true
  })

  async function archive(l: any) {
    try {
      await api.patch(`/api/lessons/${l.id}`, { status: l.status === 'ARCHIVED' ? 'PUBLISHED' : 'ARCHIVED' })
      toast.success(l.status === 'ARCHIVED' ? 'Lesson restored' : 'Lesson archived')
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function duplicate(l: any) {
    try {
      const { lesson } = await api.post<{ lesson: any }>(`/api/lessons/${l.id}/duplicate`, {})
      toast.success('Lesson duplicated (draft)')
      navigate('teacher.lesson-editor', { lessonId: lesson.id })
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/lessons/${toDelete}`)
      toast.success('Lesson deleted')
      setToDelete(null)
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Lessons</h1>
          <p className="text-sm text-muted-foreground">Create and manage lesson content.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Lesson
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <Input placeholder="Search by title or topic…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All grades</SelectItem>
              {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No lessons found"
          description="Create a new lesson, or generate one with AI."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Lesson</Button>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Card key={l.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.topic} · Grade {l.grade} · {l.subject?.name}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[l.status]}`}>
                    {l.status}
                  </span>
                </div>
                {l.objectives && <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{l.objectives.replace(/[#*-]/g, '').slice(0, 120)}</p>}
                <div className="text-xs text-muted-foreground mb-3">
                  Updated {l.updatedAt ? format(new Date(l.updatedAt), 'MMM d, yyyy') : ''}
                </div>
                <div className="flex items-center justify-end gap-1 border-t pt-2">
                  <Button variant="ghost" size="icon" onClick={() => setView(l)} title="View"><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate('teacher.lesson-editor', { lessonId: l.id })} title="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicate(l)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => archive(l)} title="Archive"><Archive className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(l.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Lesson dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Lesson</DialogTitle>
            <DialogDescription>Choose a starting point.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              onClick={() => { setCreateOpen(false); navigate('teacher.lesson-editor', { lessonId: 'new' }) }}
              className="flex items-start gap-3 rounded-md border p-4 text-left hover:bg-accent/10"
            >
              <FileText className="mt-1 h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Start from scratch</div>
                <div className="text-sm text-muted-foreground">Blank lesson with empty fields.</div>
              </div>
            </button>
            <button
              onClick={() => { setCreateOpen(false); navigate('teacher.lesson-editor', { lessonId: 'ai' }) }}
              className="flex items-start gap-3 rounded-md border p-4 text-left hover:bg-accent/10"
            >
              <Sparkles className="mt-1 h-5 w-5 text-accent-foreground" />
              <div>
                <div className="font-medium">Generate with AI</div>
                <div className="text-sm text-muted-foreground">Zambian curriculum-aligned content, editable.</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View lesson dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{view?.title}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">Grade {view.grade}</Badge>
                <Badge variant="outline">{view.subject?.name}</Badge>
                <Badge variant="outline">{view.topic}</Badge>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Objectives</h4>
                <Markdown content={view.objectives} />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Notes</h4>
                <Markdown content={view.notes} />
              </div>
              {view.activities && <div><h4 className="font-semibold text-sm mb-1">Activities</h4><Markdown content={view.activities} /></div>}
              {view.summary && <div><h4 className="font-semibold text-sm mb-1">Summary</h4><Markdown content={view.summary} /></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete lesson?"
        description="This permanently removes the lesson and its assignments."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
