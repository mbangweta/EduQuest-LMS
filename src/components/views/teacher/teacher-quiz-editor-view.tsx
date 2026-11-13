'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Sparkles, Plus, Trash2, ChevronUp, ChevronDown, Loader2, Save, Send, Library, Check,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import {
  QUESTION_TYPES, QUESTION_TYPE_LABELS, type ParsedQuestion, type QuestionType,
} from '@/lib/quiz-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CreateSubjectDialog } from '@/components/views/shared/create-subject-dialog'

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD']
const CURRICULUMS = ['ZAMBIAN', 'ECZ', 'CAMBRIDGE', 'GENERAL']

function emptyQuestion(type: QuestionType): ParsedQuestion {
  switch (type) {
    case 'MULTIPLE_CHOICE':
      return { type, questionText: '', options: ['A. ', 'B. ', 'C. ', 'D. '], correctAnswer: 'A', markAllocation: 1, explanation: '' }
    case 'TRUE_FALSE':
      return { type, questionText: '', correctAnswer: true, markAllocation: 1, explanation: '' }
    case 'FILL_BLANK':
      return { type, questionText: '', acceptedAnswers: [''], markAllocation: 1, explanation: '' }
    case 'SHORT_ANSWER':
      return { type, questionText: '', markingGuide: '', markAllocation: 2, explanation: '' }
    case 'NUMERICAL':
      return { type, questionText: '', correctAnswer: 0, numericalTolerance: 0.01, markAllocation: 1, explanation: '' }
    case 'MATCHING':
      return { type, questionText: '', matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }], correctAnswer: {}, markAllocation: 2, explanation: '' }
  }
}

export function TeacherQuizEditorView({ quizId }: { quizId?: string }) {
  const { navigate } = useRouter()
  const isNew = !quizId || quizId === 'new' || quizId === 'ai'
  const isAi = quizId === 'ai'

  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(isAi)
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [publishFlow, setPublishFlow] = useState<string | null>(null)

  const [settings, setSettings] = useState({
    title: '',
    grade: '5',
    subjectId: '',
    topic: '',
    description: '',
    difficulty: 'MEDIUM',
    curriculum: 'ZAMBIAN',
    instructions: '',
    timeLimit: '30',
    passingScore: '50',
    maxAttempts: '1',
    randomQuestionOrder: false,
    randomAnswerOrder: false,
    allowRetakes: true,
    showAnswers: 'AFTER_SUBMISSION',
    showExplanations: true,
    scorePolicy: 'HIGHEST',
    status: 'DRAFT',
  })
  const [questions, setQuestions] = useState<ParsedQuestion[]>([])

  // AI generation
  const [aiGrade, setAiGrade] = useState('7')
  const [aiSubject, setAiSubject] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('MEDIUM')
  const [aiNum, setAiNum] = useState('5')
  const [aiTypes, setAiTypes] = useState<QuestionType[]>(['MULTIPLE_CHOICE'])

  useEffect(() => {
    api.get<{ subjects: any[] }>('/api/subjects').then((r) => {
      setSubjects(r.subjects)
      if (!settings.subjectId && r.subjects[0]) {
        setSettings((s) => ({ ...s, subjectId: r.subjects[0].id }))
        setAiSubject(r.subjects[0].name)
      }
    })
    if (!isNew && quizId) {
      api.get<{ quiz: any }>(`/api/quizzes/${quizId}`).then(({ quiz }) => {
        setSettings({
          title: quiz.title, grade: String(quiz.grade), subjectId: quiz.subjectId, topic: quiz.topic,
          description: quiz.description ?? '', difficulty: quiz.difficulty, curriculum: quiz.curriculum,
          instructions: quiz.instructions ?? '', timeLimit: String(quiz.timeLimit), passingScore: String(quiz.passingScore),
          maxAttempts: String(quiz.maxAttempts), randomQuestionOrder: quiz.randomQuestionOrder,
          randomAnswerOrder: quiz.randomAnswerOrder, allowRetakes: quiz.allowRetakes,
          showAnswers: quiz.showAnswers, showExplanations: quiz.showExplanations,
          scorePolicy: quiz.scorePolicy, status: quiz.status,
        })
        setQuestions(quiz.questions ?? [])
      }).finally(() => setLoading(false))
    }
  }, [quizId])

  function updateQuestion(i: number, patch: Partial<ParsedQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const arr = [...qs]
      const j = i + dir
      if (j < 0 || j >= arr.length) return arr
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
  }
  function addQuestion(type: QuestionType) {
    setQuestions((qs) => [...qs, emptyQuestion(type)])
    setAddTypeOpen(false)
  }

  async function generateWithAI() {
    if (!aiTopic) { toast.error('Topic required'); return }
    setSaving(true)
    try {
      const { questions: aiQuestions } = await api.post<{ questions: any[] }>('/api/ai/generate-quiz', {
        title: aiTopic,
        grade: Number(aiGrade),
        subject: aiSubject,
        topic: aiTopic,
        difficulty: aiDifficulty,
        numberOfQuestions: Number(aiNum),
        questionTypes: aiTypes,
        curriculum: 'ZAMBIAN',
      })
      // Normalize: ensure MC options have prefixes
      const normalized: ParsedQuestion[] = aiQuestions.map((q) => {
        const qq: ParsedQuestion = {
          type: q.type,
          questionText: q.questionText || '',
          options: q.options,
          correctAnswer: q.correctAnswer,
          acceptedAnswers: q.acceptedAnswers,
          matchingPairs: q.matchingPairs,
          markingGuide: q.markingGuide,
          numericalTolerance: q.numericalTolerance,
          markAllocation: q.markAllocation || 1,
          explanation: q.explanation,
        }
        return qq
      })
      setQuestions((qs) => [...qs, ...normalized])
      // Prefill settings if blank
      setSettings((s) => ({
        ...s,
        title: s.title || `${aiTopic} Quiz`,
        topic: s.topic || aiTopic,
        grade: s.grade === '5' ? aiGrade : s.grade,
        subjectId: s.subjectId || subjects.find((x) => x.name === aiSubject)?.id || s.subjectId,
      }))
      toast.success(`Generated ${normalized.length} questions`)
      setAiOpen(false)
    } catch (e: any) { toast.error(e?.message || 'AI failed') }
    finally { setSaving(false) }
  }

  async function save(status?: string, afterAction?: () => void) {
    if (!settings.title || !settings.topic || !settings.subjectId) {
      toast.error('Title, topic, and subject are required')
      return
    }
    setSaving(true)
    const payload = {
      ...settings,
      grade: Number(settings.grade),
      timeLimit: Number(settings.timeLimit),
      passingScore: Number(settings.passingScore),
      maxAttempts: Number(settings.maxAttempts),
      status: status ?? settings.status,
      questions: questions.map((q, i) => ({ ...q, order: i })),
    }
    try {
      if (isNew) {
        const { quiz } = await api.post<{ quiz: any }>('/api/quizzes', payload)
        toast.success('Quiz saved')
        setPublishFlow(status === 'PUBLISHED' ? quiz.id : null)
        if (status !== 'PUBLISHED') navigate('teacher.quiz-editor', { quizId: quiz.id })
        else setMyClasses((await api.get<{ classes: any[] }>('/api/classes')).classes)
        afterAction?.()
      } else {
        await api.patch(`/api/quizzes/${quizId}`, payload)
        toast.success('Quiz updated')
        setSettings((s) => ({ ...s, status: status ?? s.status }))
        if (status === 'PUBLISHED') {
          setMyClasses((await api.get<{ classes: any[] }>('/api/classes')).classes)
          setPublishFlow(quizId!)
        }
        afterAction?.()
      }
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  async function saveToBank(q: ParsedQuestion) {
    if (!q.questionText) { toast.error('Question text required'); return }
    try {
      await api.post('/api/question-bank', {
        grade: Number(settings.grade),
        subjectId: settings.subjectId,
        topic: settings.topic,
        difficulty: settings.difficulty,
        ...q,
      })
      toast.success('Saved to Question Bank')
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function assignToClasses(classIds: string[], startDate?: string, endDate?: string) {
    setSaving(true)
    try {
      for (const cid of classIds) {
        await api.post(`/api/quizzes/${publishFlow}/assign`, { classId: cid, startDate: startDate || undefined, endDate: endDate || undefined })
      }
      toast.success(`Assigned to ${classIds.length} class(es)`)
      setAssignOpen(false)
      setPublishFlow(null)
      navigate('teacher.quizzes')
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-96" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('teacher.quizzes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
          </Button>
          <Button variant="outline" onClick={() => save('DRAFT')} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => save('PUBLISHED')} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publish
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quiz Settings</CardTitle></CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Grade</Label>
            <Select value={settings.grade} onValueChange={(v) => setSettings({ ...settings, grade: v })}>
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
            <Select value={settings.subjectId} onValueChange={(v) => setSettings({ ...settings, subjectId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" value={settings.topic} onChange={(e) => setSettings({ ...settings, topic: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={settings.difficulty} onValueChange={(v) => setSettings({ ...settings, difficulty: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d.replace('_', ' ').toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Curriculum</Label>
            <Select value={settings.curriculum} onValueChange={(v) => setSettings({ ...settings, curriculum: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRICULUMS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Time Limit (min)</Label>
            <Input type="number" value={settings.timeLimit} onChange={(e) => setSettings({ ...settings, timeLimit: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Passing Score (%)</Label>
            <Input type="number" value={settings.passingScore} onChange={(e) => setSettings({ ...settings, passingScore: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Max Attempts (0 = unlimited)</Label>
            <Input type="number" value={settings.maxAttempts} onChange={(e) => setSettings({ ...settings, maxAttempts: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Show Answers</Label>
            <Select value={settings.showAnswers} onValueChange={(v) => setSettings({ ...settings, showAnswers: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NEVER">Never</SelectItem>
                <SelectItem value="AFTER_SUBMISSION">After submission</SelectItem>
                <SelectItem value="AFTER_DEADLINE">After deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Score Policy</Label>
            <Select value={settings.scorePolicy} onValueChange={(v) => setSettings({ ...settings, scorePolicy: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGHEST">Highest</SelectItem>
                <SelectItem value="LATEST">Latest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={settings.status} onValueChange={(v) => setSettings({ ...settings, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <Label htmlFor="desc">Description (optional)</Label>
            <Input id="desc" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} />
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <Label htmlFor="ins">Instructions (optional)</Label>
            <Textarea id="ins" rows={2} value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} />
          </div>
          <div className="lg:col-span-3 flex flex-wrap gap-4 pt-2">
            <Toggle label="Random question order" checked={settings.randomQuestionOrder} onChange={(v) => setSettings({ ...settings, randomQuestionOrder: v })} />
            <Toggle label="Random answer order" checked={settings.randomAnswerOrder} onChange={(v) => setSettings({ ...settings, randomAnswerOrder: v })} />
            <Toggle label="Allow retakes" checked={settings.allowRetakes} onChange={(v) => setSettings({ ...settings, allowRetakes: v })} />
            <Toggle label="Show explanations" checked={settings.showExplanations} onChange={(v) => setSettings({ ...settings, showExplanations: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
        <Button onClick={() => setAddTypeOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Question</Button>
      </div>

      {questions.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No questions yet. Click "Generate with AI" or "Add Question" to begin.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={i}
              index={i}
              total={questions.length}
              question={q}
              onChange={(patch) => updateQuestion(i, patch)}
              onRemove={() => removeQuestion(i)}
              onMove={(dir) => move(i, dir)}
              onSaveBank={() => saveToBank(q)}
            />
          ))}
        </div>
      )}

      {/* AI generation dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Quiz with AI</DialogTitle>
            <DialogDescription>Tailored to the Zambian curriculum (ECZ standards).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={aiGrade} onValueChange={setAiGrade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={aiSubject} onValueChange={setAiSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Topic</Label>
              <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Decimals" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Difficulty</Label>
                <Select value={aiDifficulty} onValueChange={setAiDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d.replace('_', ' ').toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Number of questions</Label>
                <Input type="number" min={1} max={10} value={aiNum} onChange={(e) => setAiNum(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Question types</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {QUESTION_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={aiTypes.includes(t)}
                      onCheckedChange={(v) => setAiTypes(v ? [...aiTypes, t] : aiTypes.filter((x) => x !== t))}
                    />
                    {QUESTION_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={generateWithAI} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add question type dialog */}
      <Dialog open={addTypeOpen} onOpenChange={setAddTypeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            {QUESTION_TYPES.map((t) => (
              <button key={t} onClick={() => addQuestion(t)} className="text-left rounded-md border p-3 hover:bg-accent/10">
                <div className="font-medium">{QUESTION_TYPE_LABELS[t]}</div>
                <div className="text-xs text-muted-foreground">{describeType(t)}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign after publish */}
      <Dialog open={!!publishFlow} onOpenChange={(o) => !o && setPublishFlow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quiz Published — Assign to Classes</DialogTitle>
            <DialogDescription>Optionally assign to one or more of your classes.</DialogDescription>
          </DialogHeader>
          <AssignClassesBody classes={myClasses} onAssign={assignToClasses} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  )
}

function describeType(t: QuestionType) {
  switch (t) {
    case 'MULTIPLE_CHOICE': return '4 options (A–D)'
    case 'TRUE_FALSE': return 'True or False'
    case 'FILL_BLANK': return 'Accept multiple answers'
    case 'SHORT_ANSWER': return 'AI-marked using marking guide'
    case 'NUMERICAL': return 'Number with tolerance'
    case 'MATCHING': return 'Pairs of left/right'
  }
}

function QuestionCard({ index, total, question, onChange, onRemove, onMove, onSaveBank }: {
  index: number; total: number; question: ParsedQuestion
  onChange: (patch: Partial<ParsedQuestion>) => void
  onRemove: () => void; onMove: (dir: -1 | 1) => void; onSaveBank: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Badge variant="outline">{QUESTION_TYPE_LABELS[question.type]}</Badge>
            <span className="text-xs text-muted-foreground shrink-0">Q{index + 1} · {question.markAllocation} mark(s)</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={onSaveBank} title="Save to Question Bank"><Library className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Question text</Label>
            <Textarea rows={2} value={question.questionText} onChange={(e) => onChange({ questionText: e.target.value })} />
          </div>

          {/* MC */}
          {question.type === 'MULTIPLE_CHOICE' && (
            <div>
              <Label className="text-xs">Options (one per line — format: "A. text")</Label>
              <div className="space-y-1">
                {(question.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => onChange({ options: (question.options ?? []).map((o, idx) => idx === i ? e.target.value : o) })}
                    />
                    <Button
                      size="sm"
                      variant={String(question.correctAnswer).toUpperCase() === opt.slice(0, 1).toUpperCase() ? 'default' : 'outline'}
                      onClick={() => onChange({ correctAnswer: opt.slice(0, 1).toUpperCase() })}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">The green button marks the correct option.</p>
            </div>
          )}

          {/* TRUE_FALSE */}
          {question.type === 'TRUE_FALSE' && (
            <div>
              <Label className="text-xs">Correct answer</Label>
              <Select value={String(question.correctAnswer)} onValueChange={(v) => onChange({ correctAnswer: v === 'true' })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* FILL_BLANK */}
          {question.type === 'FILL_BLANK' && (
            <div>
              <Label className="text-xs">Accepted answers (case-insensitive)</Label>
              <div className="space-y-1">
                {(question.acceptedAnswers ?? []).map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={a} onChange={(e) => onChange({ acceptedAnswers: (question.acceptedAnswers ?? []).map((x, idx) => idx === i ? e.target.value : x) })} />
                    <Button size="icon" variant="ghost" onClick={() => onChange({ acceptedAnswers: (question.acceptedAnswers ?? []).filter((_, idx) => idx !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => onChange({ acceptedAnswers: [...(question.acceptedAnswers ?? []), ''] })}>
                  <Plus className="mr-2 h-4 w-4" /> Add accepted answer
                </Button>
              </div>
            </div>
          )}

          {/* SHORT_ANSWER */}
          {question.type === 'SHORT_ANSWER' && (
            <div>
              <Label className="text-xs">Marking guide (key points learners should mention; AI will use this)</Label>
              <Textarea rows={3} value={question.markingGuide ?? ''} onChange={(e) => onChange({ markingGuide: e.target.value })} placeholder="e.g. Must mention: photosynthesis, sunlight, chlorophyll, glucose" />
            </div>
          )}

          {/* NUMERICAL */}
          {question.type === 'NUMERICAL' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Correct answer</Label>
                <Input type="number" step="any" value={String(question.correctAnswer ?? '')} onChange={(e) => onChange({ correctAnswer: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Tolerance</Label>
                <Input type="number" step="any" value={String(question.numericalTolerance ?? 0.01)} onChange={(e) => onChange({ numericalTolerance: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {/* MATCHING */}
          {question.type === 'MATCHING' && (
            <div>
              <Label className="text-xs">Matching pairs</Label>
              <div className="space-y-1">
                {(question.matchingPairs ?? []).map((p, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <Input value={p.left} placeholder="Left" onChange={(e) => onChange({ matchingPairs: (question.matchingPairs ?? []).map((x, idx) => idx === i ? { ...x, left: e.target.value } : x) })} />
                    <Input value={p.right} placeholder="Right" onChange={(e) => onChange({ matchingPairs: (question.matchingPairs ?? []).map((x, idx) => idx === i ? { ...x, right: e.target.value } : x) })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Explanation (optional)</Label>
            <Textarea rows={2} value={question.explanation ?? ''} onChange={(e) => onChange({ explanation: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mark allocation</Label>
              <Input type="number" min={1} max={10} value={question.markAllocation} onChange={(e) => onChange({ markAllocation: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AssignClassesBody({ classes, onAssign, saving }: { classes: any[]; onAssign: (ids: string[], sd?: string, ed?: string) => void; saving: boolean }) {
  const [selected, setSelected] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  return (
    <>
      <div className="space-y-2 max-h-64 overflow-y-auto scroll-thin">
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">You have no classes. You can assign later from the Classes view.</p>
        ) : classes.map((c) => (
          <label key={c.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/10">
            <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => setSelected(v ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />
            <div>
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.subject?.name} · Grade {c.grade} · {c._count?.members ?? 0} learners</div>
            </div>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
        <div><Label className="text-xs">Start date (optional)</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label className="text-xs">End date (deadline)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onAssign([])}>Skip</Button>
        <Button onClick={() => onAssign(selected, startDate, endDate)} disabled={saving || selected.length === 0}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Assign
        </Button>
      </DialogFooter>
    </>
  )
}
