// EduQuest LMS — Shared question serialization helpers.
// Prisma stores JSON fields as String; this gives the UI and API a consistent shape.

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'SHORT_ANSWER'
  | 'NUMERICAL'
  | 'MATCHING'

export interface ParsedQuestion {
  id?: string
  type: QuestionType
  questionText: string
  options?: string[]
  correctAnswer?: string | number | boolean | Record<string, string>
  acceptedAnswers?: string[]
  matchingPairs?: { left: string; right: string }[]
  markingGuide?: string
  numericalTolerance?: number
  markAllocation: number
  explanation?: string
  order?: number
  questionBankId?: string | null
}

function safeParse<T>(v: any, fallback: T): T {
  if (v == null) return fallback
  if (typeof v !== 'string') return v as T
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

// Convert a raw Prisma QuizQuestion row into the structured shape used by UI.
export function parseQuestion(q: any): ParsedQuestion {
  return {
    id: q.id,
    type: q.type as QuestionType,
    questionText: q.questionText ?? '',
    options: safeParse<string[]>(q.optionsJson, []),
    correctAnswer: safeParse<any>(q.correctAnswerJson, undefined),
    acceptedAnswers: safeParse<string[]>(q.acceptedAnswersJson, []),
    matchingPairs: safeParse<{ left: string; right: string }[]>(q.matchingPairsJson, []),
    markingGuide: q.markingGuide ?? undefined,
    numericalTolerance: q.numericalTolerance ?? undefined,
    markAllocation: q.markAllocation ?? 1,
    explanation: q.explanation ?? undefined,
    order: q.order ?? 0,
    questionBankId: q.questionBankId ?? null,
  }
}

// Strip answer keys for learner views (before sending to client).
export function stripAnswerKey(q: ParsedQuestion): ParsedQuestion {
  return {
    id: q.id,
    type: q.type,
    questionText: q.questionText,
    options: q.options,
    markAllocation: q.markAllocation,
    explanation: q.explanation,
    order: q.order,
    matchingPairs: q.matchingPairs?.map((p) => ({ left: p.left, right: p.right })),
  }
}

// Serialize a ParsedQuestion into the Prisma field shapes.
export function serializeQuestion(q: ParsedQuestion) {
  return {
    type: q.type,
    questionText: q.questionText,
    optionsJson: q.options && q.options.length ? JSON.stringify(q.options) : null,
    correctAnswerJson: q.correctAnswer !== undefined ? JSON.stringify(q.correctAnswer) : null,
    acceptedAnswersJson: q.acceptedAnswers && q.acceptedAnswers.length ? JSON.stringify(q.acceptedAnswers) : null,
    matchingPairsJson: q.matchingPairs && q.matchingPairs.length ? JSON.stringify(q.matchingPairs) : null,
    markingGuide: q.markingGuide ?? null,
    numericalTolerance: q.numericalTolerance ?? null,
    markAllocation: q.markAllocation ?? 1,
    explanation: q.explanation ?? null,
  }
}

// Format learner answer for display (handles primitives + maps).
export function formatAnswer(ans: any): string {
  if (ans === null || ans === undefined || ans === '') return '(no answer)'
  if (typeof ans === 'boolean') return ans ? 'True' : 'False'
  if (typeof ans === 'object') {
    return Object.entries(ans as Record<string, string>)
      .map(([k, v]) => `${k} → ${v}`)
      .join(', ')
  }
  return String(ans)
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in the Blank',
  SHORT_ANSWER: 'Short Answer',
  NUMERICAL: 'Numerical',
  MATCHING: 'Matching',
}

export const QUESTION_TYPES: QuestionType[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'NUMERICAL',
  'MATCHING',
]
