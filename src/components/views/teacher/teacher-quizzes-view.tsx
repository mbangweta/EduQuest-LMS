'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Plus, Pencil, Trash2, Eye, FileQuestion, Sparkles, BarChart3, Loader2,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

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
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { QuizCreationWizard } from '@/components/views/shared/quiz-creation-wizard'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-200',
  PUBLISHED: 'bg-accent/15 text-accent-foreground border-accent/30',
  CLOSED: 'bg-muted text-muted-foreground border-border',
}

export function TeacherQuizzesView() {
  const { navigate } = useRouter()
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState('ALL')
  const [subjectId, setSubjectId] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      api.get<{ quizzes: any[] }>('/api/quizzes'),
      api.get<{ subjects: any[] }>('/api/subjects'),
      api.get<{ classes: any[] }>('/api/classes'),
    ]).then(([r, s, c]) => { setQuizzes(r.quizzes); setSubjects(s.subjects); setTeacherClasses(c.classes || []) }).finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const r = await api.get<{ quizzes: any[] }>('/api/quizzes')
    setQuizzes(r.quizzes)
  }

  const filtered = quizzes.filter((qz) => {
    if (grade !== 'ALL' && String(qz.grade) !== grade) return false
    if (subjectId !== 'ALL' && qz.subjectId !== subjectId) return false
    if (status !== 'ALL' && qz.status !== status) return false
    if (q && !(`${qz.title} ${qz.topic}`.toLowerCase().includes(q.toLowerCase()))) return false
    return true
  })

  async function publish(qz: any) {
    try {
      await api.patch(`/api/quizzes/${qz.id}`, { status: qz.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT' })
      toast.success(qz.status === 'DRAFT' ? 'Quiz published' : 'Quiz reverted to draft')
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/quizzes/${toDelete}`)
      toast.success('Quiz deleted')
      setToDelete(null)
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Quizzes</h1>
          <p className="text-sm text-muted-foreground">Build quizzes manually or with AI.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Quiz
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
              <SelectItem value="CLOSED">Closed</SelectItem>
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
          icon={<FileQuestion className="h-6 w-6" />}
          title="No quizzes found"
          description="Create a new quiz, or generate one with AI."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Quiz</Button>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((qz) => (
            <Card key={qz.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{qz.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{qz.topic} · Grade {qz.grade} · {qz.subject?.name}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[qz.status]}`}>
                    {qz.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 flex-1">
                  <div>{qz._count?.questions ?? 0} questions</div>
                  <div>{qz.timeLimit} min</div>
                  <div>Pass: {qz.passingScore}%</div>
                  <div>{qz._count?.attempts ?? 0} attempts</div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t pt-2">
                  <Button variant="ghost" size="icon" onClick={() => navigate('teacher.quiz-results', { quizId: qz.id })} title="View Results">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate('teacher.quiz-editor', { quizId: qz.id })} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {qz.status === 'DRAFT' && (
                    <Button variant="ghost" size="icon" onClick={() => publish(qz)} title="Publish"><Eye className="h-4 w-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(qz.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuizCreationWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        subjects={subjects}
        classes={teacherClasses}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete quiz?"
        description="This permanently removes the quiz, its questions and all attempts."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
