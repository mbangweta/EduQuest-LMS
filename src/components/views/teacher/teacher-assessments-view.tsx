'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ClipboardList, Loader2, FileText, Calendar,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'
import { ASSESSMENT_TYPES, formatAssessmentType } from '@/lib/assessment-utils'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  PUBLISHED: { label: 'Published', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CLOSED: { label: 'Closed', cls: 'bg-muted text-muted-foreground border-border' },
}

export function TeacherAssessmentsView() {
  const { navigate } = useRouter()
  const [assessments, setAssessments] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('ALL')
  const [termFilter, setTermFilter] = useState('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)

  // Create form
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'FORTNIGHTLY',
    term: '1',
    subjectId: '',
    grade: '5',
    classId: 'NONE',
    date: new Date().toISOString().slice(0, 10),
    maxScore: '100',
    weight: '1.0',
    status: 'DRAFT',
  })

  useEffect(() => {
    Promise.all([
      api.get<{ assessments: any[] }>('/api/assessments'),
      api.get<{ subjects: any[] }>('/api/subjects'),
      api.get<{ classes: any[] }>('/api/classes'),
    ]).then(([a, s, c]) => {
      setAssessments(a.assessments)
      setSubjects(s.subjects)
      setClasses(c.classes)
      if (s.subjects[0]) setForm((f) => ({ ...f, subjectId: s.subjects[0].id }))
    }).finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const r = await api.get<{ assessments: any[] }>('/api/assessments')
    setAssessments(r.assessments)
  }

  async function createAssessment() {
    if (!form.title.trim() || !form.subjectId || !form.grade) {
      toast.error('Title, subject and grade are required')
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        term: Number(form.term),
        subjectId: form.subjectId,
        grade: Number(form.grade),
        classId: form.classId !== 'NONE' ? form.classId : undefined,
        date: form.date,
        maxScore: Number(form.maxScore),
        weight: Number(form.weight),
        status: form.status,
      }
      const { assessment } = await api.post<{ assessment: any }>('/api/assessments', payload)
      toast.success('Assessment created')
      setCreateOpen(false)
      setForm({
        title: '', description: '', type: 'CLASS_TEST', term: '1',
        subjectId: subjects[0]?.id || '', grade: '5', classId: '',
        date: new Date().toISOString().slice(0, 10), maxScore: '100', weight: '1.0', status: 'DRAFT',
      })
      navigate('teacher.assessment-editor', { assessmentId: assessment.id })
    } catch (e: any) { toast.error(e?.message || 'Failed to create') }
    finally { setSaving(false) }
  }

  async function deleteAssessment() {
    if (!toDelete) return
    try {
      await api.del(`/api/assessments/${toDelete.id}`)
      toast.success('Assessment deleted')
      setToDelete(null)
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed to delete') }
  }

  const filtered = assessments.filter((a) => {
    if (subjectFilter !== 'ALL' && a.subjectId !== subjectFilter) return false
    if (termFilter !== 'ALL' && String(a.term) !== termFilter) return false
    return true
  })

  if (loading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Tests and assignments across your classes. To create a new assessment, open a class and click "Create Assessment".
          </p>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-3 text-sm text-muted-foreground">
          To create a new assessment, go to your <span className="font-medium text-foreground">Classes</span>, open the class, and click <span className="font-medium text-foreground">"Create Assessment"</span>. The assessment will automatically be for that class and cover all subjects.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All terms</SelectItem>
              <SelectItem value="1">Term 1</SelectItem>
              <SelectItem value="2">Term 2</SelectItem>
              <SelectItem value="3">Term 3</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No assessments yet"
          description="Create your first test or assignment to start recording scores."
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const st = STATUS_BADGE[a.status] || STATUS_BADGE.DRAFT
            return (
              <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('teacher.assessment-editor', { assessmentId: a.id })}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Grade {a.grade}</span>
                        <span>·</span>
                        <span>Term {a.term}</span>
                        <span>·</span>
                        <span>{a.subject?.name ?? 'All subjects'}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-2">
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {formatAssessmentType(a.type)}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {a.date ? format(new Date(a.date), 'dd MMM yyyy') : '—'}</span>
                    <span>Out of {a.maxScore}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => navigate('teacher.assessment-editor', { assessmentId: a.id })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Assessment</DialogTitle></DialogHeader>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input placeholder="e.g. Term 1 Mathematics Test" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7].map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class (optional)</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Grade-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Grade-wide (all learners)</SelectItem>
                  {classes
                    .filter((c) => c.grade === Number(form.grade) && (!form.subjectId || c.subjectId === form.subjectId))
                    .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Score</Label>
              <Input type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (relative)</Label>
              <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft (only you can see)</SelectItem>
                  <SelectItem value="PUBLISHED">Published (visible to learners)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea rows={2} placeholder="What this assessment covers…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createAssessment} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete assessment?"
        description={`"${toDelete?.title}" and all its recorded scores will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={deleteAssessment}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
