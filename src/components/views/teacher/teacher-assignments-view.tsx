'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, FileText, Calendar, Trash2, Pencil, Save, X, Loader2,
  CheckCircle2, Clock, AlertCircle, Upload,
} from 'lucide-react'
import { format } from 'date-fns'
import { api } from '@/lib/api-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/views/shared/empty-state'
import { ConfirmDialog } from '@/components/views/shared/confirm-dialog'

const ASSIGNMENT_TYPES = [
  { value: 'HOMEWORK', label: 'Homework' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'PROJECT', label: 'Project' },
]

export function TeacherAssignmentsView() {
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState('')
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'ASSIGNMENT', maxScore: '100',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  })

  useEffect(() => {
    api.get<{ classes: any[] }>('/api/classes')
      .then((r) => {
        setClasses(r.classes)
        if (r.classes[0]) setClassId(r.classes[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!classId) { setAssignments([]); return }
    setFetching(true)
    api.get<{ assignments: any[] }>(`/api/assignments?classId=${classId}`)
      .then((r) => setAssignments(r.assignments || []))
      .catch((e: any) => { toast.error(e?.message || 'Failed to load'); setAssignments([]) })
      .finally(() => setFetching(false))
  }, [classId])

  async function createOrUpdate() {
    if (!classId || !form.title.trim() || !form.dueDate) {
      toast.error('Title and due date are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        classId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        maxScore: Number(form.maxScore) || 100,
        dueDate: form.dueDate,
      }
      if (editing) {
        await api.patch(`/api/assignments/${editing.id}`, payload)
        toast.success('Assignment updated')
      } else {
        await api.post('/api/assignments', payload)
        toast.success('Assignment created')
      }
      setCreateOpen(false)
      setEditing(null)
      setForm({ title: '', description: '', type: 'ASSIGNMENT', maxScore: '100', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })
      // Refresh
      const r = await api.get<{ assignments: any[] }>(`/api/assignments?classId=${classId}`)
      setAssignments(r.assignments || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  async function deleteAssignment() {
    if (!toDelete) return
    try {
      await api.del(`/api/assignments/${toDelete.id}`)
      toast.success('Assignment deleted')
      setToDelete(null)
      const r = await api.get<{ assignments: any[] }>(`/api/assignments?classId=${classId}`)
      setAssignments(r.assignments || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to delete') }
  }

  function openEdit(a: any) {
    setEditing(a)
    setForm({
      title: a.title || '',
      description: a.description || '',
      type: a.type || 'ASSIGNMENT',
      maxScore: String(a.max_score || 100),
      dueDate: a.due_date ? new Date(a.due_date).toISOString().slice(0, 10) : '',
    })
    setCreateOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setForm({ title: '', description: '', type: 'ASSIGNMENT', maxScore: '100', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })
    setCreateOpen(true)
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  const selectedClass = classes.find((c) => c.id === classId)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Assignments & Homework</h1>
          <p className="text-sm text-muted-foreground">
            Create assignments, collect submissions, and grade with feedback.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!classId}>
          <Plus className="mr-2 h-4 w-4" /> New Assignment
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Class: </span>
            <span className="font-medium">{selectedClass?.name ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      {!classId ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No class" description="Create a class first." />
      ) : fetching ? (
        <Skeleton className="h-96" />
      ) : assignments.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No assignments yet" description="Click 'New Assignment' to create your first one." />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          {assignments.map((a) => {
            const submissions = a.submissions || []
            const graded = submissions.filter((s: any) => s.status === 'GRADED').length
            const submitted = submissions.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'LATE').length
            const isOverdue = a.due_date && new Date(a.due_date) < new Date()
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{a.type}</Badge>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{a.due_date ? format(new Date(a.due_date), 'dd MMM yyyy') : '—'}</span>
                        <span>/{a.max_score}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(a)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  {a.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{a.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Upload className="mr-1 h-3 w-3" /> {submitted} submitted
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> {graded} graded
                    </Badge>
                    {isOverdue && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <AlertCircle className="mr-1 h-3 w-3" /> Overdue
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Term 1 Math Homework" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Score</Label>
                <Input type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description / Instructions</Label>
              <Textarea rows={3} placeholder="What should learners do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createOrUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete assignment?"
        description={`"${toDelete?.title}" and all submissions will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={deleteAssignment}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
