'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Trophy, TrendingUp, Loader2, RotateCcw,
} from 'lucide-react'
import { useRouter } from '@/lib/router'
import { api } from '@/lib/api-client'
import { QUESTION_TYPE_LABELS, formatAnswer, type QuestionType } from '@/lib/quiz-utils'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/views/shared/empty-state'

export function LearnerQuizResultsView({ attemptId }: { attemptId?: string }) {
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId) return
    api.get(`/api/quizzes/attempts/${attemptId}`)
      .then(setData)
      .catch((e: any) => toast.error(e?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>
  if (!data) return <EmptyState title="Result not found" />

  const a = data.attempt
  const quiz = data.quiz
  const answers = data.answers ?? []
  const revealKeys = answers.some((ans: any) => ans.correctAnswer !== undefined)

  const gradeColors: Record<string, string> = {
    A: 'bg-accent text-accent-foreground',
    B: 'bg-accent text-accent-foreground',
    C: 'bg-primary text-primary-foreground',
    D: 'bg-amber-500 text-white',
    F: 'bg-destructive text-white',
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('learner.quizzes')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
      </Button>

      <Card>
        <CardContent className={`p-8 text-center ${a.passed ? 'bg-accent/10' : 'bg-destructive/5'}`}>
          <div className="flex justify-center mb-2">
            {a.passed ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Trophy className="h-8 w-8" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white">
                <XCircle className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="text-5xl font-bold">{a.percentage}%</div>
          <div className="text-lg font-semibold mt-1">{quiz.title}</div>
          <div className="text-sm text-muted-foreground mt-1">{quiz.subject?.name} · {quiz.topic}</div>
          <div className="mt-3 inline-flex gap-2">
            <Badge variant="default" className={gradeColors[a.grade ?? 'F']}>Grade {a.grade}</Badge>
            <Badge variant={a.passed ? 'default' : 'destructive'}>
              {a.passed ? 'Passed' : 'Failed'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <div className="text-xs text-muted-foreground">Score</div>
          <div className="text-xl font-bold">{a.score} / {a.maxScore}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-xs text-muted-foreground">Time Spent</div>
          <div className="text-xl font-bold">{formatTime(a.timeSpent ?? 0)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-xs text-muted-foreground">Submitted</div>
          <div className="text-sm font-medium">{a.submittedAt ? format(new Date(a.submittedAt), 'MMM d, yyyy') : '—'}</div>
        </CardContent></Card>
      </div>

      {!revealKeys && (
        <Card><CardContent className="p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Answer keys are hidden until the quiz deadline passes, or per your teacher's settings.
          </p>
        </CardContent></Card>
      )}

      {revealKeys && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Question Breakdown</h3>
          {answers.map((ans: any, i: number) => (
            <Card key={ans.answerId}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Q{i + 1}</span>
                    <Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[ans.type as QuestionType]}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {ans.isCorrect === true ? (
                      <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
                    ) : ans.isCorrect === false ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : null}
                    <span className="text-sm font-medium">{ans.marksAwarded ?? 0} / {ans.maxMarks ?? 1}</span>
                  </div>
                </div>
                <div className="text-sm mb-2">{ans.questionText}</div>
                <div className="text-xs text-muted-foreground mb-1">Your answer: <span className="text-foreground font-medium">{formatAnswer(ans.learnerAnswer)}</span></div>
                {ans.correctAnswer !== undefined && (
                  <div className="text-xs text-muted-foreground mb-1">Correct answer: <span className="text-accent-foreground font-medium">{formatAnswer(ans.correctAnswer)}</span></div>
                )}
                {ans.acceptedAnswers && ans.acceptedAnswers.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-1">Accepted: {ans.acceptedAnswers.join(' / ')}</div>
                )}
                {quiz.showExplanations && ans.explanation && (
                  <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                    <span className="font-medium">Explanation: </span>{ans.explanation}
                  </div>
                )}
                {ans.aiMarkingResult?.feedback && (
                  <div className="mt-2 rounded-md bg-primary/5 p-2 text-xs">
                    <span className="font-medium">AI feedback: </span>{ans.aiMarkingResult.feedback}
                  </div>
                )}
                {ans.teacherOverride && (
                  <Badge variant="secondary" className="mt-2 text-xs">Marked by teacher</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-2">
        {quiz.allowRetakes && (quiz.maxAttempts === 0 || (a.attemptNumber ?? 1) < quiz.maxAttempts) && (
          <Button variant="outline" onClick={() => navigate('learner.quiz-take', { quizId: quiz.id })}>
            <RotateCcw className="mr-2 h-4 w-4" /> Retake Quiz
          </Button>
        )}
        <Button onClick={() => navigate('learner.dashboard')}>
          <TrendingUp className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
