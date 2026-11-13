'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { ASSESSMENT_TYPES } from '@/lib/assessment-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

/**
 * CreateAssessmentDialog — a simplified assessment creation form.
 *
 * The assessment inherits classId and grade from the class context.
 * No subject field (assessments cover all subjects for Grades 4-7).
 * No weight field (defaults to 1.0 in the API).
 * Max score is a dropdown: 50, 100, or 150.
 *
 * Used in the teacher and school-admin class detail views.
 */
export function CreateAssessmentDialog({
  classId,
  grade,
  className,
}: {
  classId: string
  grade: number
  className: string
}) {
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'FORTNIGHTLY',
    term: '1',
    date: new Date().toISOString().slice(0, 10),
    maxScore: '100',
    status: 'DRAFT',
  })

  function reset() {
    setForm({
      title: '', description: '', type: 'FORTNIGHTLY', term: '1',
      date: new Date().toISOString().slice(0, 10), maxScore: '100', status: 'DRAFT',
    })
  }

  async function create() {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const { assessment } = await api.post<{ assessment: any }>('/api/assessments', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        term: Number(form.term),
        classId,
        grade,
        date: form.date,
        maxScore: Number(form.maxScore),
        status: form.status,
      })
      toast.success('Assessment created')
      setOpen(false)
      reset()
      // Navigate to the assessment editor to start entering scores
      navigate('teacher.assessment-editor', { assessmentId: assessment.id })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create assessment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Create Assessment
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Assessment</DialogTitle>
            <p className="text-sm text-muted-foreground">
              For {className} · Grade {grade}. The assessment covers all subjects in this class.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Assessment Title</Label>
              <Input
                id="title"
                placeholder="e.g. Term 1 Fortnightly Test"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Score</Label>
                <Select value={form.maxScore} onValueChange={(v) => setForm({ ...form, maxScore: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                rows={2}
                placeholder="What this assessment covers…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
