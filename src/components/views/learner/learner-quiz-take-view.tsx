'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Clock, Loader2, ChevronLeft, ChevronRight, AlertCircle, Send,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import {
  QUESTION_TYPE_LABELS, type QuestionType,
} from '@/lib/quiz-utils'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function LearnerQuizTakeView({ quizId }: { quizId?: string }) {
  const { navigate } = useRouter()
  const [starting, setStarting] = useState(true)
  const [startingError, setStartingError] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!quizId) return
    setStarting(true)
    api.post<{ attempt: any; questions: any[]; quiz: any }>(`/api/quizzes/${quizId}/start`, {})
      .then((r) => {
        setQuiz(r.quiz)
        setAttemptId(r.attempt.id)
        setQuestions(r.questions ?? [])
        if (r.quiz.timeLimit > 0) {
          setRemaining(r.quiz.timeLimit * 60)
        }
      })
      .catch((e: any) => {
        setStartingError(e?.body?.error || e?.message || 'Cannot start quiz')
      })
      .finally(() => setStarting(false))
  }, [quizId])

  // Countdown timer
  useEffect(() => {
    if (remaining == null) return
    if (remaining <= 0) {
      submitQuiz(true)
      return
    }
    const id = setTimeout(() => setRemaining((r) => (r ?? 0) - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v !== '' && v !== undefined && v !== null).length, [answers])
  const allAnswered = answeredCount === questions.length

  function setAnswer(qid: string, value: any) {
    setAnswers((a) => ({ ...a, [qid]: value }))
  }

  async function submitQuiz(auto = false) {
    if (!attemptId) return
    if (!auto) setSubmitOpen(false)
    setSubmitting(true)
    try {
      const payload = {
        attemptId,
        answers: questions.map((q) => ({ questionId: q.id, learnerAnswer: answers[q.id] ?? null })),
      }
      const { attempt } = await api.post<{ attempt: any }>(`/api/quizzes/${quizId}/submit`, payload)
      toast.success('Quiz submitted!')
      navigate('learner.quiz-results', { attemptId: attempt.id })
    } catch (e: any) {
      toast.error(e?.message || 'Submit failed')
    } finally { setSubmitting(false) }
  }

  if (starting) return <div className="p-6"><Skeleton className="h-64" /></div>
  if (startingError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <h3 className="text-lg font-semibold">Cannot start quiz</h3>
            <p className="text-sm text-muted-foreground mt-1">{startingError}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('learner.quizzes')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to quizzes
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quiz || questions.length === 0) return null
  const current = questions[currentIdx]

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{quiz.title}</div>
            <div className="text-xs text-muted-foreground">Question {currentIdx + 1} of {questions.length} · {answeredCount} answered</div>
          </div>
          {remaining != null && (
            <Badge variant={remaining < 60 ? 'destructive' : 'secondary'} className="font-mono">
              <Clock className="mr-1 h-3 w-3" /> {formatTime(remaining)}
            </Badge>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <Badge variant="outline" className="mb-3">{QUESTION_TYPE_LABELS[current.type as QuestionType]}</Badge>
          <div className="text-base font-medium mb-4">{current.questionText}</div>

          {current.type === 'MULTIPLE_CHOICE' && (
            <RadioGroup
              value={String(answers[current.id] ?? '')}
              onValueChange={(v) => setAnswer(current.id, v)}
            >
              <div className="space-y-2">
                {(current.options ?? []).map((opt: string, i: number) => (
                  <label key={i} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/10">
                    <RadioGroupItem value={opt.slice(0, 1).toUpperCase()} id={`opt-${i}`} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          )}

          {current.type === 'TRUE_FALSE' && (
            <RadioGroup
              value={String(answers[current.id] ?? '')}
              onValueChange={(v) => setAnswer(current.id, v === 'true')}
            >
              <div className="space-y-2 flex gap-3">
                <label className="flex items-center gap-3 rounded-md border p-3 flex-1 cursor-pointer hover:bg-accent/10 justify-center">
                  <RadioGroupItem value="true" id="tf-true" />
                  <span>True</span>
                </label>
                <label className="flex items-center gap-3 rounded-md border p-3 flex-1 cursor-pointer hover:bg-accent/10 justify-center">
                  <RadioGroupItem value="false" id="tf-false" />
                  <span>False</span>
                </label>
              </div>
            </RadioGroup>
          )}

          {current.type === 'FILL_BLANK' && (
            <Input
              value={String(answers[current.id] ?? '')}
              onChange={(e) => setAnswer(current.id, e.target.value)}
              placeholder="Type your answer…"
              className="max-w-md"
            />
          )}

          {current.type === 'SHORT_ANSWER' && (
            <div className="space-y-2">
              <Textarea
                rows={5}
                value={String(answers[current.id] ?? '')}
                onChange={(e) => setAnswer(current.id, e.target.value)}
                placeholder="Write your answer…"
              />
              <p className="text-xs text-muted-foreground">Your answer will be marked using the teacher's marking guide and AI assistance.</p>
            </div>
          )}

          {current.type === 'NUMERICAL' && (
            <Input
              type="number"
              step="any"
              value={String(answers[current.id] ?? '')}
              onChange={(e) => setAnswer(current.id, e.target.value)}
              placeholder="Enter a number…"
              className="max-w-md"
            />
          )}

          {current.type === 'MATCHING' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Match each item on the left with the correct option on the right.</p>
              {(current.matchingPairs ?? []).map((pair: any, i: number) => (
                <div key={i} className="grid grid-cols-2 gap-3 items-center">
                  <div className="rounded-md border p-2 text-sm bg-muted/30">{pair.left}</div>
                  <Select
                    value={(answers[current.id] as any)?.[pair.left] ?? ''}
                    onValueChange={(v) => setAnswer(current.id, { ...(answers[current.id] as any), [pair.left]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select match…" /></SelectTrigger>
                    <SelectContent>
                      {(current.matchingPairs ?? []).map((m: any, j: number) => (
                        <SelectItem key={j} value={m.right}>{m.right}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        {currentIdx < questions.length - 1 ? (
          <Button onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}>
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => setSubmitOpen(true)} disabled={submitting}>
            <Send className="mr-2 h-4 w-4" /> Submit Quiz
          </Button>
        )}
      </div>

      {/* Question grid for navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Jump to question:</div>
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                className={`h-9 w-9 rounded-md text-sm font-medium transition-colors ${
                  i === currentIdx ? 'bg-primary text-primary-foreground' :
                  answers[q.id] !== undefined && answers[q.id] !== '' ? 'bg-accent/20 text-accent-foreground' :
                  'bg-muted hover:bg-muted/70'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {answeredCount} of {questions.length} questions.
              {!allAnswered && ' Unanswered questions will receive 0 marks.'} This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => { e.preventDefault(); submitQuiz() }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
