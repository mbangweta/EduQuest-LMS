'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Library, Loader2, FileQuestion, Search } from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import {
  QUESTION_TYPES, QUESTION_TYPE_LABELS, type ParsedQuestion, type QuestionType,
} from '@/lib/quiz-utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD']

function emptyQuestion(type: QuestionType): ParsedQuestion {
  switch (type) {
    case 'MULTIPLE_CHOICE': return { type, questionText: '', options: ['A. ', 'B. ', 'C. ', 'D. '], correctAnswer: 'A', markAllocation: 1 }
    case 'TRUE_FALSE': return { type, questionText: '', correctAnswer: true, markAllocation: 1 }
    case 'FILL_BLANK': return { type, questionText: '', acceptedAnswers: [''], markAllocation: 1 }
    case 'SHORT_ANSWER': return { type, questionText: '', markingGuide: '', markAllocation: 2 }
    case 'NUMERICAL': return { type, questionText: '', correctAnswer: 0, numericalTolerance: 0.01, markAllocation: 1 }
    case 'MATCHING': return { type, questionText: '', matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }], correctAnswer: {}, markAllocation: 2 }
  }
}

export function TeacherQuestionBankView() {
  const { navigate } = useRouter()
  const [questions, setQuestions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ grade: 'ALL', subjectId: 'ALL', type: 'ALL', difficulty: 'ALL', q: '', topic: '' })
  const [selected, setSelected] = useState<string[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    type: 'MULTIPLE_CHOICE' as QuestionType,
    grade: '7',
    subjectId: '',
    topic: '',
    difficulty: 'MEDIUM',
    questionText: '',
    options: ['A. ', 'B. ', 'C. ', 'D. '] as string[],
    correctAnswer: 'A' as any,
    acceptedAnswers: [''],
    matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }],
    markingGuide: '',
    numericalTolerance: 0.01,
    markAllocation: 1,
    explanation: '',
  })

  useEffect(() => {
    Promise.all([
      api.get<{ questions: any[] }>('/api/question-bank'),
      api.get<{ subjects: any[] }>('/api/subjects'),
    ]).then(([q, s]) => {
      setQuestions(q.questions); setSubjects(s.subjects)
      if (s.subjects[0]) setForm((f) => ({ ...f, subjectId: s.subjects[0].id }))
    }).finally(() => setLoading(false))
  }, [])

  async function refresh() {
    const params = new URLSearchParams()
    if (filter.grade !== 'ALL') params.set('grade', filter.grade)
    if (filter.subjectId !== 'ALL') params.set('subjectId', filter.subjectId)
    if (filter.type !== 'ALL') params.set('type', filter.type)
    if (filter.difficulty !== 'ALL') params.set('difficulty', filter.difficulty)
    if (filter.q) params.set('q', filter.q)
    if (filter.topic) params.set('topic', filter.topic)
    const { questions } = await api.get<{ questions: any[] }>(`/api/question-bank${params.toString() ? `?${params}` : ''}`)
    setQuestions(questions)
  }
  useEffect(() => { if (!loading) refresh() }, [filter])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyQuestion('MULTIPLE_CHOICE'), grade: '7', subjectId: subjects[0]?.id ?? '', topic: '', difficulty: 'MEDIUM' })
    setEditOpen(true)
  }
  function openEdit(q: any) {
    setEditing(q)
    setForm({
      type: q.type, grade: String(q.grade), subjectId: q.subjectId, topic: q.topic, difficulty: q.difficulty,
      questionText: q.questionText,
      options: q.optionsJson ? safeParseArr(q.optionsJson) : ['A. ', 'B. ', 'C. ', 'D. '],
      correctAnswer: q.correctAnswerJson ? safeParse(q.correctAnswerJson) : 'A',
      acceptedAnswers: q.acceptedAnswersJson ? safeParseArr(q.acceptedAnswersJson) : [''],
      matchingPairs: q.matchingPairsJson ? safeParseArr(q.matchingPairsJson) : [],
      markingGuide: q.markingGuide ?? '',
      numericalTolerance: q.numericalTolerance ?? 0.01,
      markAllocation: q.markAllocation ?? 1,
      explanation: q.explanation ?? '',
    })
    setEditOpen(true)
  }

  async function save() {
    if (!form.questionText || !form.subjectId || !form.topic) { toast.error('Question, subject and topic required'); return }
    setSaving(true)
    try {
      const payload: any = {
        grade: Number(form.grade), subjectId: form.subjectId, topic: form.topic, difficulty: form.difficulty,
        type: form.type, questionText: form.questionText,
        options: form.options, correctAnswer: form.correctAnswer,
        acceptedAnswers: form.acceptedAnswers, matchingPairs: form.matchingPairs,
        markingGuide: form.markingGuide, numericalTolerance: form.numericalTolerance,
        markAllocation: form.markAllocation, explanation: form.explanation,
      }
      if (editing) {
        await api.patch(`/api/question-bank/${editing.id}`, payload)
        toast.success('Question updated')
      } else {
        await api.post('/api/question-bank', payload)
        toast.success('Question added to bank')
      }
      setEditOpen(false)
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.del(`/api/question-bank/${toDelete}`)
      toast.success('Question deleted')
      setToDelete(null)
      refresh()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  async function generateQuizFromSelected() {
    if (selected.length === 0) { toast.error('Select questions first'); return }
    const selectedQuestions = questions.filter((q) => selected.includes(q.id))
    const payload = {
      title: `${selectedQuestions[0].topic} Quiz (from Bank)`,
      grade: Number(selectedQuestions[0].grade),
      subjectId: selectedQuestions[0].subjectId,
      topic: selectedQuestions[0].topic,
      status: 'DRAFT',
      questions: selectedQuestions.map((q) => ({
        type: q.type,
        questionText: q.questionText,
        options: q.optionsJson ? safeParseArr(q.optionsJson) : undefined,
        correctAnswer: q.correctAnswerJson ? safeParse(q.correctAnswerJson) : undefined,
        acceptedAnswers: q.acceptedAnswersJson ? safeParseArr(q.acceptedAnswersJson) : undefined,
        matchingPairs: q.matchingPairsJson ? safeParseArr(q.matchingPairsJson) : undefined,
        markingGuide: q.markingGuide ?? undefined,
        numericalTolerance: q.numericalTolerance ?? undefined,
        markAllocation: q.markAllocation ?? 1,
        explanation: q.explanation ?? undefined,
        questionBankId: q.id,
      })),
    }
    try {
      const { quiz } = await api.post<{ quiz: any }>('/api/quizzes', payload)
      toast.success('Quiz created from selected questions')
      navigate('teacher.quiz-editor', { quizId: quiz.id })
    } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">Reusable questions, shareable across quizzes.</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="outline" onClick={generateQuizFromSelected}>
              <FileQuestion className="mr-2 h-4 w-4" /> New Quiz from {selected.length} Selected
            </Button>
          )}
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Question</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search question text…" className="pl-9" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          </div>
          <Select value={filter.grade} onValueChange={(v) => setFilter({ ...filter, grade: v })}>
            <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All grades</SelectItem>
              {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.subjectId} onValueChange={(v) => setFilter({ ...filter, subjectId: v })}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.difficulty} onValueChange={(v) => setFilter({ ...filter, difficulty: v })}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d.replace('_', ' ').toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64" />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<Library className="h-6 w-6" />}
          title="No questions in bank"
          description="Add questions you want to reuse, or generate a quiz from selected."
          action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Question</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(q.id)}
                          onCheckedChange={(v) => setSelected(v ? [...selected, q.id] : selected.filter((x) => x !== q.id))}
                        />
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{q.questionText}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[q.type as QuestionType]}</Badge></TableCell>
                      <TableCell>{q.grade}</TableCell>
                      <TableCell className="text-sm">{q.subject?.name}</TableCell>
                      <TableCell className="text-sm">{q.topic}</TableCell>
                      <TableCell>{q.markAllocation}</TableCell>
                      <TableCell><span className="text-xs">{q.difficulty}</span></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit / Add dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Question' : 'Add Question to Bank'}</DialogTitle>
            <DialogDescription>Fully reusable across quizzes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as QuestionType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d.replace('_', ' ').toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
            <div><Label className="text-xs">Question text</Label><Textarea rows={2} value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} /></div>

            {form.type === 'MULTIPLE_CHOICE' && (
              <div>
                <Label className="text-xs">Options (mark correct with green check)</Label>
                <div className="space-y-1">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={opt} onChange={(e) => setForm({ ...form, options: form.options.map((o, idx) => idx === i ? e.target.value : o) })} />
                      <Button size="sm" variant={String(form.correctAnswer).toUpperCase() === opt.slice(0, 1).toUpperCase() ? 'default' : 'outline'} onClick={() => setForm({ ...form, correctAnswer: opt.slice(0, 1).toUpperCase() })}>✓</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {form.type === 'TRUE_FALSE' && (
              <div>
                <Label className="text-xs">Correct answer</Label>
                <Select value={String(form.correctAnswer)} onValueChange={(v) => setForm({ ...form, correctAnswer: v === 'true' })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">True</SelectItem><SelectItem value="false">False</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            {form.type === 'FILL_BLANK' && (
              <div>
                <Label className="text-xs">Accepted answers</Label>
                <div className="space-y-1">
                  {form.acceptedAnswers.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={a} onChange={(e) => setForm({ ...form, acceptedAnswers: form.acceptedAnswers.map((x, idx) => idx === i ? e.target.value : x) })} />
                      <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, acceptedAnswers: form.acceptedAnswers.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...form, acceptedAnswers: [...form.acceptedAnswers, ''] })}><Plus className="mr-2 h-4 w-4" /> Add</Button>
                </div>
              </div>
            )}
            {form.type === 'SHORT_ANSWER' && <div><Label className="text-xs">Marking guide</Label><Textarea rows={3} value={form.markingGuide} onChange={(e) => setForm({ ...form, markingGuide: e.target.value })} /></div>}
            {form.type === 'NUMERICAL' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Correct answer</Label><Input type="number" step="any" value={String(form.correctAnswer ?? '')} onChange={(e) => setForm({ ...form, correctAnswer: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Tolerance</Label><Input type="number" step="any" value={String(form.numericalTolerance)} onChange={(e) => setForm({ ...form, numericalTolerance: Number(e.target.value) })} /></div>
              </div>
            )}
            {form.type === 'MATCHING' && (
              <div>
                <Label className="text-xs">Pairs</Label>
                <div className="space-y-1">
                  {form.matchingPairs.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <Input value={p.left} onChange={(e) => setForm({ ...form, matchingPairs: form.matchingPairs.map((x, idx) => idx === i ? { ...x, left: e.target.value } : x) })} />
                      <Input value={p.right} onChange={(e) => setForm({ ...form, matchingPairs: form.matchingPairs.map((x, idx) => idx === i ? { ...x, right: e.target.value } : x) })} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Mark allocation</Label><Input type="number" min={1} max={10} value={form.markAllocation} onChange={(e) => setForm({ ...form, markAllocation: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Explanation (optional)</Label><Input value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete question?"
        description="This removes it from the bank. Quizzes already using copies keep their copies."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function safeParse<T>(v: any): T {
  try { return JSON.parse(v) as T } catch { return v as T }
}
function safeParseArr<T>(v: any): T[] {
  try { return JSON.parse(v) as T[] } catch { return [] }
}
