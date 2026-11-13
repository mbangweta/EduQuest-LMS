'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sparkles, FileText, Library, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  RefreshCw, Plus, Trash2, Save, Eye, AlertCircle,
} from 'lucide-react'

type CreationMethod = 'ai_prompt' | 'pasted_questions' | 'question_bank'
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'NUMERICAL' | 'MATCHING'

interface Question {
  type: QuestionType
  questionText: string
  options?: string[]
  correctAnswer?: any
  acceptedAnswers?: string[]
  markingGuide?: string
  markAllocation?: number
  explanation?: string
  uncertain?: boolean
}

export function QuizCreationWizard({
  open, onOpenChange, subjects = [], classes = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  subjects?: any[]
  classes?: any[]
}) {
  const { navigate } = useRouter()
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState<CreationMethod>('ai_prompt')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])

  // Step 2: Content
  const [aiPrompt, setAiPrompt] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [generateMissingOptions, setGenerateMissingOptions] = useState(false)

  // Step 3: Settings
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [grade, setGrade] = useState('7')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(['MULTIPLE_CHOICE'])
  const [curriculum, setCurriculum] = useState('ZAMBIAN')
  const [timeLimit, setTimeLimit] = useState(30)
  const [isTimed, setIsTimed] = useState(false)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [allowLate, setAllowLate] = useState(false)
  const [openingDate, setOpeningDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])

  // Question bank selection
  const [bankQuestions, setBankQuestions] = useState<any[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [selectionMode, setSelectionMode] = useState<'random' | 'manual'>('random')

  function reset() {
    setStep(1); setMethod('ai_prompt'); setQuestions([])
    setAiPrompt(''); setPastedText(''); setTitle(''); setInstructions('')
    setTopic(''); setNumQuestions(10); setQuestionTypes(['MULTIPLE_CHOICE'])
    setIsTimed(false); setShuffleQuestions(false); setShuffleOptions(false)
    setOpeningDate(''); setDueDate(''); setSelectedClasses([])
    setBankQuestions([]); setGenerating(false)
  }

  // Load question bank for the selected subject/grade when method is question_bank
  useEffect(() => {
    if (method === 'question_bank' && step >= 2 && subjectId && grade) {
      setBankLoading(true)
      api.get(`/api/question-bank?subjectId=${subjectId}&grade=${grade}`).then((r: any) => {
        setBankQuestions(r.questions || [])
      }).catch(() => setBankQuestions([])).finally(() => setBankLoading(false))
    }
  }, [method, step, subjectId, grade])

  const METHODS = [
    { id: 'ai_prompt' as CreationMethod, icon: Sparkles, title: 'AI Prompt', desc: 'Describe the quiz in natural language and let AI generate questions.' },
    { id: 'pasted_questions' as CreationMethod, icon: FileText, title: 'Paste Questions', desc: 'Paste past exam questions, revision questions, or textbook content. AI structures them.' },
    { id: 'question_bank' as CreationMethod, icon: Library, title: 'Question Bank', desc: 'Select questions from your existing question bank. Random or manual selection.' },
  ]

  async function generate() {
    setGenerating(true)
    setQuestions([])
    try {
      if (method === 'ai_prompt') {
        if (!aiPrompt.trim()) { toast.error('Enter an AI prompt'); setGenerating(false); return }
        const res = await api.post<any>('/api/ai/generate-quiz', {
          title: title || 'Generated Quiz',
          grade: Number(grade),
          subject: subjects.find((s) => s.id === subjectId)?.name || '',
          topic: topic || 'General',
          difficulty,
          numberOfQuestions: numQuestions,
          questionTypes,
          curriculum,
        })
        setQuestions(res.questions || [])
      } else if (method === 'pasted_questions') {
        if (!pastedText.trim()) { toast.error('Paste some questions'); setGenerating(false); return }
        const res = await fetch('/api/ai/parse-pasted-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pastedText, grade: Number(grade),
            subject: subjects.find((s) => s.id === subjectId)?.name || '',
            generateMissingOptions,
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error || 'Parse failed'); setGenerating(false); return }
        setQuestions(data.questions || [])
      } else if (method === 'question_bank') {
        // Use the from-question-bank endpoint
        const res = await api.post<any>('/api/quizzes/from-question-bank', {
          title: title || 'Question Bank Quiz',
          subjectId, grade: Number(grade), topic,
          difficulty, questionTypes,
          numberOfQuestions: numQuestions,
          selectionMode: selectionMode === 'random' ? 'random' : 'all',
          quizSettings: {
            timeLimit: isTimed ? timeLimit : 0,
            passingScore: 50,
            randomQuestionOrder: shuffleQuestions,
            randomAnswerOrder: shuffleOptions,
          },
        })
        toast.success(`Quiz created with ${res.selectedFromBank} questions from the bank`)
        onOpenChange(false)
        reset()
        navigate('teacher.quizzes')
        return
      }

      const count = method === 'ai_prompt' || method === 'pasted_questions' ? questions.length : 0
      toast.success(`Generated ${questions.length || 'questions'}`)
      setStep(4) // Go to preview step
    } catch (e: any) {
      toast.error(e?.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function regenerateOne(idx: number) {
    const q = questions[idx]
    if (!q) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/regenerate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: Number(grade),
          subject: subjects.find((s) => s.id === subjectId)?.name || '',
          topic: topic || 'General',
          difficulty,
          questionType: q.type,
          curriculum,
          existingQuestionText: q.questionText,
          avoidQuestions: questions.filter((_, i) => i !== idx).map((qq) => qq.questionText),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Regeneration failed'); return }
      const newQuestions = [...questions]
      newQuestions[idx] = data.question
      setQuestions(newQuestions)
      toast.success('Question regenerated')
    } catch (e: any) {
      toast.error(e?.message || 'Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft() {
    try {
      const quizBody: any = {
        title: title || 'Untitled Quiz',
        grade: Number(grade),
        subjectId,
        topic: topic || '',
        difficulty,
        curriculum,
        instructions,
        timeLimit: isTimed ? timeLimit : 0,
        passingScore: 50,
        maxAttempts: 1,
        randomQuestionOrder: shuffleQuestions,
        randomAnswerOrder: shuffleOptions,
        allowRetakes: true,
        showAnswers: 'AFTER_SUBMISSION',
        showExplanations: true,
        scorePolicy: 'HIGHEST',
        status: 'DRAFT',
        questions: questions.map((q, i) => ({
          type: q.type,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          acceptedAnswers: q.acceptedAnswers,
          markingGuide: q.markingGuide,
          markAllocation: q.markAllocation || 1,
          explanation: q.explanation,
          order: i,
        })),
      }
      const res = await api.post<any>('/api/quizzes', quizBody)
      toast.success('Quiz saved as draft')
      onOpenChange(false)
      reset()
      navigate('teacher.quizzes')
    } catch (e: any) {
      toast.error(e?.message || 'Save failed')
    }
  }

  async function publishQuiz() {
    // Save first, then publish
    try {
      const quizBody: any = {
        title: title || 'Untitled Quiz',
        grade: Number(grade),
        subjectId,
        topic: topic || '',
        difficulty,
        curriculum,
        instructions,
        timeLimit: isTimed ? timeLimit : 0,
        passingScore: 50,
        maxAttempts: 1,
        randomQuestionOrder: shuffleQuestions,
        randomAnswerOrder: shuffleOptions,
        allowRetakes: true,
        showAnswers: 'AFTER_SUBMISSION',
        showExplanations: true,
        scorePolicy: 'HIGHEST',
        status: 'PUBLISHED',
        questions: questions.map((q, i) => ({
          type: q.type,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          acceptedAnswers: q.acceptedAnswers,
          markingGuide: q.markingGuide,
          markAllocation: q.markAllocation || 1,
          explanation: q.explanation,
          order: i,
        })),
      }
      const res = await api.post<any>('/api/quizzes', quizBody)
      // Assign to classes
      if (selectedClasses.length > 0 && res?.id) {
        for (const cid of selectedClasses) {
          await api.post(`/api/quizzes/${res.id}/assign`, { classId: cid })
        }
      }
      toast.success('Quiz published')
      onOpenChange(false)
      reset()
      navigate('teacher.quizzes')
    } catch (e: any) {
      toast.error(e?.message || 'Publish failed')
    }
  }

  const STEPS = method === 'question_bank'
    ? ['Method', 'Settings', 'Create']
    : ['Method', 'Content', 'Settings', 'Preview', 'Publish']

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Create Quiz</DialogTitle>
          <DialogDescription>
            Step {step} of {STEPS.length}: {STEPS[step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                step > i + 1 ? 'bg-accent text-accent-foreground' :
                step === i + 1 ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > i + 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-1 w-12 rounded ${step > i + 1 ? 'bg-accent' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Method */}
        {step === 1 && (
          <div className="space-y-3">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  method === m.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                  method === m.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                </div>
                {method === m.id && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
              </button>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setStep(2)}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Content (AI prompt / Pasted questions / Question bank) */}
        {step === 2 && method !== 'question_bank' && (
          <div className="space-y-4">
            {method === 'ai_prompt' && (
              <div className="space-y-1.5">
                <Label>AI Prompt — describe the quiz you want</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={6}
                  placeholder="Create 30 challenging Grade 7 Mathematics questions covering fractions, percentages, decimals, algebra and geometry. Use Zambian ECZ examination standards. Include questions that test understanding, application and problem-solving."
                />
                <p className="text-xs text-muted-foreground">
                  The AI will use your quiz settings (grade, subject, topic, difficulty, question types) along with this prompt.
                </p>
              </div>
            )}
            {method === 'pasted_questions' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Paste your questions here</Label>
                  <Textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={10}
                    placeholder="1. What is the capital of Zambia?
A. Lusaka
B. Ndola
C. Kitwe
D. Kabwe
Answer: A

2. True or false: The Zambezi River flows into the Indian Ocean.
Answer: True

3. Calculate: 15% of 200 kwacha.
Answer: 30 kwacha"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste exam questions, revision questions, or textbook content. AI will identify each question, its options, and correct answers.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={generateMissingOptions}
                    onCheckedChange={(v) => setGenerateMissingOptions(!!v)}
                  />
                  Generate missing multiple-choice options using AI
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2 (question_bank): Settings + Bank selection */}
        {step === 2 && method === 'question_bank' && (
          <div className="space-y-4">
            <QuizSettingsForm
              title={title} setTitle={setTitle}
              subjectId={subjectId} setSubjectId={setSubjectId}
              subjects={subjects}
              grade={grade} setGrade={setGrade}
              topic={topic} setTopic={setTopic}
              difficulty={difficulty} setDifficulty={setDifficulty}
              numQuestions={numQuestions} setNumQuestions={setNumQuestions}
              isTimed={isTimed} setIsTimed={setIsTimed}
              timeLimit={timeLimit} setTimeLimit={setTimeLimit}
              shuffleQuestions={shuffleQuestions} setShuffleQuestions={setShuffleQuestions}
              shuffleOptions={shuffleOptions} setShuffleOptions={setShuffleOptions}
              classes={classes} selectedClasses={selectedClasses} setSelectedClasses={setSelectedClasses}
            />
            <div className="space-y-2">
              <Label>Selection mode</Label>
              <Select value={selectionMode} onValueChange={(v) => setSelectionMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random — pick {numQuestions} questions randomly</SelectItem>
                  <SelectItem value="manual">All — use all matching questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="font-medium">Question Bank: {bankQuestions.length} questions match your filters</p>
                {bankQuestions.length === 0 ? (
                  <p className="text-xs text-destructive mt-1">No questions found. Try different subject/grade filters, or add questions to the question bank first.</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectionMode === 'random'
                      ? `${Math.min(numQuestions, bankQuestions.length)} will be randomly selected.`
                      : `All ${bankQuestions.length} questions will be used.`}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={generate}
                disabled={generating || bankQuestions.length === 0}
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Library className="mr-2 h-4 w-4" />}
                {generating ? 'Creating...' : 'Create from Bank'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Settings (for AI prompt + pasted questions) */}
        {step === 3 && method !== 'question_bank' && (
          <div className="space-y-4">
            <QuizSettingsForm
              title={title} setTitle={setTitle}
              subjectId={subjectId} setSubjectId={setSubjectId}
              subjects={subjects}
              grade={grade} setGrade={setGrade}
              topic={topic} setTopic={setTopic}
              difficulty={difficulty} setDifficulty={setDifficulty}
              numQuestions={numQuestions} setNumQuestions={setNumQuestions}
              questionTypes={questionTypes} setQuestionTypes={setQuestionTypes}
              curriculum={curriculum} setCurriculum={setCurriculum}
              isTimed={isTimed} setIsTimed={setIsTimed}
              timeLimit={timeLimit} setTimeLimit={setTimeLimit}
              shuffleQuestions={shuffleQuestions} setShuffleQuestions={setShuffleQuestions}
              shuffleOptions={shuffleOptions} setShuffleOptions={setShuffleOptions}
              classes={classes} selectedClasses={selectedClasses} setSelectedClasses={setSelectedClasses}
              instructions={instructions} setInstructions={setInstructions}
              openingDate={openingDate} setOpeningDate={setOpeningDate}
              dueDate={dueDate} setDueDate={setDueDate}
              allowLate={allowLate} setAllowLate={setAllowLate}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {generating ? 'Generating...' : 'Generate Quiz'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Preview + Edit */}
        {step === 4 && questions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{questions.length} questions generated</p>
                {questions.some((q) => q.uncertain) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {questions.filter((q) => q.uncertain).length} questions have uncertain answers — review before publishing
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                <RefreshCw className="mr-1 h-3 w-3" /> Regenerate all
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-thin space-y-2">
              <AnimatePresence>
                {questions.map((q, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">Q{idx + 1}</Badge>
                          <Badge variant="outline" className="text-xs">{q.type.replace('_', ' ')}</Badge>
                          {q.uncertain && <Badge variant="destructive" className="text-xs">Uncertain</Badge>}
                        </div>
                        <p className="text-sm font-medium">{q.questionText}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {q.options.map((opt, i) => (
                              <p key={i} className={`text-xs ${opt.charAt(0) === q.correctAnswer ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                                {opt}{opt.charAt(0) === q.correctAnswer ? ' ✓' : ''}
                              </p>
                            ))}
                          </div>
                        )}
                        {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">{q.explanation}</p>}
                      </div>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => regenerateOne(idx)}
                        disabled={generating}
                        title="Regenerate this question"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={saveDraft}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
              </Button>
              <Button onClick={() => setStep(5)}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 5: Publish */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
              <p className="font-semibold">Quiz Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Title:</span> {title || 'Untitled'}</div>
                <div><span className="text-muted-foreground">Questions:</span> {questions.length}</div>
                <div><span className="text-muted-foreground">Subject:</span> {subjects.find((s) => s.id === subjectId)?.name || '—'}</div>
                <div><span className="text-muted-foreground">Grade:</span> {grade}</div>
                <div><span className="text-muted-foreground">Difficulty:</span> {difficulty}</div>
                <div><span className="text-muted-foreground">Timed:</span> {isTimed ? `${timeLimit} min` : 'No timer'}</div>
                <div><span className="text-muted-foreground">Shuffle Q:</span> {shuffleQuestions ? 'Yes' : 'No'}</div>
                <div><span className="text-muted-foreground">Classes:</span> {selectedClasses.length}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Publishing makes the quiz available to learners in the selected classes.
              {isTimed && ' The timer will start when each learner begins the quiz.'}
              {selectedClasses.length === 0 && ' No classes selected — you can assign later.'}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(4)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={saveDraft}>
                <Save className="mr-2 h-4 w-4" /> Save as Draft
              </Button>
              <Button onClick={publishQuiz} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Publish Quiz
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Shared quiz settings form component (used in steps 2 and 3)
function QuizSettingsForm(props: any) {
  const {
    title, setTitle, subjectId, setSubjectId, subjects, grade, setGrade,
    topic, setTopic, difficulty, setDifficulty, numQuestions, setNumQuestions,
    questionTypes, setQuestionTypes, curriculum, setCurriculum,
    isTimed, setIsTimed, timeLimit, setTimeLimit,
    shuffleQuestions, setShuffleQuestions, shuffleOptions, setShuffleOptions,
    classes, selectedClasses, setSelectedClasses,
    instructions, setInstructions, openingDate, setOpeningDate,
    dueDate, setDueDate, allowLate, setAllowLate,
  } = props

  const QTYPES: { id: QuestionType; label: string }[] = [
    { id: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
    { id: 'TRUE_FALSE', label: 'True / False' },
    { id: 'FILL_BLANK', label: 'Fill in the Blank' },
    { id: 'SHORT_ANSWER', label: 'Short Answer' },
    { id: 'NUMERICAL', label: 'Numerical' },
    { id: 'MATCHING', label: 'Matching' },
  ]

  function toggleType(t: QuestionType) {
    if (!setQuestionTypes) return
    const current = questionTypes || []
    if (current.includes(t)) setQuestionTypes(current.filter((x: string) => x !== t))
    else setQuestionTypes([...current, t])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Quiz title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grade 7 Mathematics Quiz" />
        </div>
        <div className="space-y-1.5">
          <Label>Subject *</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Grade *</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 4 }).map((_, i) => <SelectItem key={i + 4} value={String(i + 4)}>Grade {i + 4}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
              <SelectItem value="VERY_HARD">Very Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Number of questions</Label>
          <Input type="number" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value) || 1)} min={1} max={100} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Topic (optional)</Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Fractions, Algebra, States of Matter..." />
      </div>
      {setQuestionTypes && (
        <div className="space-y-1.5">
          <Label>Question types</Label>
          <div className="flex flex-wrap gap-2">
            {QTYPES.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={questionTypes?.includes(t.id) || false}
                  onCheckedChange={() => toggleType(t.id)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {setInstructions && (
        <div className="space-y-1.5">
          <Label>Instructions (optional)</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Answer all questions. Show your working where needed." />
        </div>
      )}
      {/* Timed settings */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="cursor-pointer">Timed quiz</Label>
          <p className="text-xs text-muted-foreground">Enable a countdown timer for learners</p>
        </div>
        <Switch checked={isTimed} onCheckedChange={setIsTimed} />
      </div>
      {isTimed && (
        <div className="space-y-1.5">
          <Label>Duration (minutes)</Label>
          <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value) || 30)} min={1} max={300} />
        </div>
      )}
      {/* Randomization */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer">
          <Checkbox checked={shuffleQuestions} onCheckedChange={(v) => setShuffleQuestions(!!v)} />
          Shuffle question order
        </label>
        <label className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer">
          <Checkbox checked={shuffleOptions} onCheckedChange={(v) => setShuffleOptions(!!v)} />
          Shuffle answer options
        </label>
      </div>
      {/* Class assignment */}
      {classes && classes.length > 0 && (
        <div className="space-y-1.5">
          <Label>Assign to classes (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {classes.map((c: any) => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={selectedClasses.includes(c.id)}
                  onCheckedChange={(v) => {
                    if (v) setSelectedClasses([...selectedClasses, c.id])
                    else setSelectedClasses(selectedClasses.filter((id: string) => id !== c.id))
                  }}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
