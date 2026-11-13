'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Sparkles, Save, Eye, Plus, Loader2, X, Trash2 } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'

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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/views/shared/markdown'
import { CreateSubjectDialog } from '@/components/views/shared/create-subject-dialog'

const SECTIONS = ['objectives', 'notes', 'activities', 'examples', 'practiceQuestions', 'homework', 'summary'] as const
const SECTION_LABELS: Record<typeof SECTIONS[number], string> = {
  objectives: 'Objectives',
  notes: 'Notes',
  activities: 'Activities',
  examples: 'Examples',
  practiceQuestions: 'Practice Questions',
  homework: 'Homework',
  summary: 'Summary',
}

interface Attachment { name: string; url: string; type: string }

export function TeacherLessonEditorView({ lessonId }: { lessonId?: string }) {
  const { navigate } = useRouter()
  const isNew = !lessonId || lessonId === 'new' || lessonId === 'ai'

  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)

  const [form, setForm] = useState({
    title: '',
    grade: '5',
    subjectId: '',
    topic: '',
    status: 'DRAFT',
    objectives: '',
    notes: '',
    activities: '',
    examples: '',
    practiceQuestions: '',
    homework: '',
    summary: '',
  })
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [videoLinks, setVideoLinks] = useState<string[]>([])
  const [newAttachment, setNewAttachment] = useState<Attachment>({ name: '', url: '', type: 'pdf' })
  const [newVideo, setNewVideo] = useState('')

  // AI difficulty (the only AI-specific setting still needed)
  const [aiDifficulty, setAiDifficulty] = useState('MEDIUM')

  useEffect(() => {
    api.get<{ subjects: any[] }>('/api/subjects').then((r) => {
      setSubjects(r.subjects)
      if (!form.subjectId && r.subjects[0]) setForm((f) => ({ ...f, subjectId: r.subjects[0].id }))
    })
    if (!isNew && lessonId) {
      api.get<{ lesson: any }>(`/api/lessons/${lessonId}`)
        .then((r) => {
          const l = r.lesson
          setForm({
            title: l.title, grade: String(l.grade), subjectId: l.subjectId, topic: l.topic, status: l.status,
            objectives: l.objectives ?? '', notes: l.notes ?? '', activities: l.activities ?? '',
            examples: l.examples ?? '', practiceQuestions: l.practiceQuestions ?? '',
            homework: l.homework ?? '', summary: l.summary ?? '',
          })
          setAttachments(l.attachments ? safeParseArr<Attachment>(l.attachments) : [])
          setVideoLinks(l.videoLinks ? safeParseArr<string>(l.videoLinks) : [])
        })
        .catch((e: any) => toast.error(e?.message || 'Failed to load lesson'))
        .finally(() => setLoading(false))
    }
  }, [lessonId])

  async function generateWithAI() {
    if (!form.topic) { toast.error('Topic required'); return }
    if (!form.subjectId) { toast.error('Subject required'); return }
    setGenerating(true)
    try {
      const subjectName = subjects.find((s) => s.id === form.subjectId)?.name || ''
      const { lesson } = await api.post<{ lesson: any }>('/api/ai/generate-lesson', {
        grade: Number(form.grade),
        subject: subjectName,
        topic: form.topic,
        difficulty: aiDifficulty,
        curriculum: 'ZAMBIAN',
        learningObjectives: form.objectives || undefined,
      })
      setForm((f) => ({
        ...f,
        // Keep the teacher's title/topic/grade/objectives if they filled them in
        title: f.title || lesson.title || `${form.topic} — Grade ${form.grade} ${subjectName}`,
        objectives: f.objectives || lesson.objectives || f.objectives,
        notes: lesson.notes ?? f.notes,
        activities: lesson.activities ?? f.activities,
        examples: lesson.examples ?? f.examples,
        practiceQuestions: lesson.practiceQuestions ?? f.practiceQuestions,
        homework: lesson.homework ?? f.homework,
        summary: lesson.summary ?? f.summary,
      }))
      toast.success('Lesson content generated. Review and edit before saving.')
    } catch (e: any) { toast.error(e?.message || 'AI generation failed') }
    finally { setGenerating(false) }
  }

  async function save(status?: string) {
    if (!form.title || !form.topic || !form.subjectId) {
      toast.error('Title, topic, and subject are required')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      grade: Number(form.grade),
      status: status ?? form.status,
      attachments,
      videoLinks,
    }
    try {
      if (isNew) {
        const { lesson } = await api.post<{ lesson: any }>('/api/lessons', payload)
        toast.success('Lesson saved')
        navigate('teacher.lesson-editor', { lessonId: lesson.id })
      } else {
        await api.patch(`/api/lessons/${lessonId}`, payload)
        toast.success('Lesson updated')
      }
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('teacher.lessons')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save('DRAFT')} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => save('PUBLISHED')} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Adding and Subtracting Fractions" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Subject</Label>
                <CreateSubjectDialog onCreated={(s) => setSubjects((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))} />
              </div>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" placeholder="Fractions" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Objectives — prominent field with AI option */}
          <div className="space-y-1.5">
            <Label htmlFor="objectives">Learning Objectives</Label>
            <Textarea
              id="objectives"
              rows={3}
              placeholder="By the end of this lesson, learners will be able to:&#10;- Add fractions with the same denominator&#10;- Subtract fractions with different denominators"
              value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
            />
          </div>

          {/* "Let AI do the rest" button — appears after the teacher fills in the basics */}
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">Let AI complete the rest</p>
              <p className="text-xs text-muted-foreground">
                Fill in the title, topic, grade, subject, and objectives above,
                then click the button — AI will generate notes, activities, examples, practice questions, homework, and a summary.
              </p>
            </div>
            <Button
              onClick={generateWithAI}
              disabled={generating || !form.title || !form.topic || !form.subjectId}
              className="shrink-0"
            >
              {generating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                : <><Sparkles className="mr-2 h-4 w-4" /> Generate with AI</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attachments & Videos — below objectives, above editor */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Attachments & Videos</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAttachmentOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add File
              </Button>
            </div>
          </div>
          {(attachments.length > 0 || videoLinks.length > 0) ? (
            <div className="space-y-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {a.name} ({a.type})
                  </a>
                  <Button size="icon" variant="ghost" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {videoLinks.map((v, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <a href={v} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{v}</a>
                  <Button size="icon" variant="ghost" onClick={() => setVideoLinks(videoLinks.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No attachments. Add links to PDFs, slides, or YouTube videos.</p>
          )}
          <div className="flex gap-2">
            <Input placeholder="https://www.youtube.com/watch?v=…" value={newVideo} onChange={(e) => setNewVideo(e.target.value)} />
            <Button size="sm" variant="outline" onClick={() => { if (newVideo) { setVideoLinks([...videoLinks, newVideo]); setNewVideo('') } }}>
              <Plus className="h-4 w-4" /> Add Video
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Editor</h3>
            {SECTIONS.map((s) => (
              <div key={s} className="space-y-1">
                <Label className="text-xs">{SECTION_LABELS[s]}</Label>
                <Textarea
                  rows={s === 'notes' ? 8 : 4}
                  className="font-mono text-xs"
                  value={(form as any)[s]}
                  onChange={(e) => setForm({ ...form, [s]: e.target.value })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Eye className="h-4 w-4" /> Live Preview</h3>
            {form.title && <h2 className="text-xl font-bold">{form.title}</h2>}
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="secondary">Grade {form.grade}</Badge>
              <Badge variant="outline">{subjects.find((s) => s.id === form.subjectId)?.name ?? '—'}</Badge>
              <Badge variant="outline">{form.topic || 'No topic'}</Badge>
            </div>
            {SECTIONS.map((s) => (form as any)[s] ? (
              <div key={s}>
                <h4 className="font-semibold text-sm mb-1">{SECTION_LABELS[s]}</h4>
                <Markdown content={(form as any)[s]} />
              </div>
            ) : null)}
          </CardContent>
        </Card>
      </div>

      {/* Add attachment dialog */}
      <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Attachment (URL)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={newAttachment.name} onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })} placeholder="Lesson slides" /></div>
            <div><Label className="text-xs">URL</Label><Input value={newAttachment.url} onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })} placeholder="https://…" /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newAttachment.type} onValueChange={(v) => setNewAttachment({ ...newAttachment, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="doc">Document</SelectItem>
                  <SelectItem value="slides">Slides</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="link">Web Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (newAttachment.name && newAttachment.url) {
                setAttachments([...attachments, newAttachment])
                setNewAttachment({ name: '', url: '', type: 'pdf' })
                setAttachmentOpen(false)
              }
            }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function safeParseArr<T>(v: any): T[] {
  try { return JSON.parse(v) as T[] } catch { return [] }
}
