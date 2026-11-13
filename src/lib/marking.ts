// EduQuest LMS — Deterministic marking logic for objective questions
// IMPORTANT: AI is ONLY used for SHORT_ANSWER questions. All other question types
// use deterministic, server-side comparison against the saved answer key.

import { markShortAnswer } from './ai'

export interface QuestionData {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'NUMERICAL' | 'MATCHING'
  options?: string[]
  correctAnswer?: string | number | boolean | Record<string, string>
  acceptedAnswers?: string[]
  matchingPairs?: { left: string; right: string }[]
  markingGuide?: string
  numericalTolerance?: number
  markAllocation: number
  explanation?: string
}

export interface MarkResult {
  isCorrect: boolean
  marksAwarded: number
  maxMarks: number
  feedback?: string
  aiResult?: any
}

// ---------------------------------------------------------------------------
// STRING NORMALIZATION
// ---------------------------------------------------------------------------
function normalizeString(s: string): string {
  if (s == null) return ''
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"\-_/\\()]/g, '')
    .replace(/\s+/g, ' ')
}

// ---------------------------------------------------------------------------
// DETERMINISTIC MARKING (objective questions)
// ---------------------------------------------------------------------------
export function markObjective(question: QuestionData, learnerAnswer: any): MarkResult {
  const maxMarks = question.markAllocation || 1

  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const correct = String(question.correctAnswer ?? '').trim().toUpperCase()
      const given = String(learnerAnswer ?? '').trim().toUpperCase()
      const isCorrect = correct !== '' && given === correct
      return { isCorrect, marksAwarded: isCorrect ? maxMarks : 0, maxMarks }
    }

    case 'TRUE_FALSE': {
      const correct = parseBool(question.correctAnswer)
      const given = parseBool(learnerAnswer)
      if (given === null) return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'No answer provided.' }
      const isCorrect = correct === given
      return { isCorrect, marksAwarded: isCorrect ? maxMarks : 0, maxMarks }
    }

    case 'NUMERICAL': {
      if (learnerAnswer === null || learnerAnswer === undefined || learnerAnswer === '') {
        return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'No answer provided.' }
      }
      const correct = Number(question.correctAnswer)
      const given = Number(learnerAnswer)
      if (Number.isNaN(correct) || Number.isNaN(given)) {
        return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'Answer must be a number.' }
      }
      const tolerance = question.numericalTolerance ?? 0.01
      const isCorrect = Math.abs(correct - given) <= Math.abs(tolerance)
      return { isCorrect, marksAwarded: isCorrect ? maxMarks : 0, maxMarks }
    }

    case 'FILL_BLANK': {
      const accepted = (question.acceptedAnswers ?? (Array.isArray(question.correctAnswer) ? (question.correctAnswer as any) : [question.correctAnswer]))
        .map((a: any) => normalizeString(String(a)))
        .filter(Boolean)
      if (accepted.length === 0) accepted.push(normalizeString(String(question.correctAnswer ?? '')))
      const given = normalizeString(String(learnerAnswer ?? ''))
      if (!given) return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'No answer provided.' }
      const isCorrect = accepted.includes(given)
      return { isCorrect, marksAwarded: isCorrect ? maxMarks : 0, maxMarks }
    }

    case 'MATCHING': {
      // correctAnswer is a map { left1: right1, left2: right2, ... }
      // learnerAnswer is a map of the same shape
      const correctMap = (question.correctAnswer ?? {}) as Record<string, string>
      const givenMap = (learnerAnswer ?? {}) as Record<string, string>
      const keys = Object.keys(correctMap)
      if (keys.length === 0) return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'No answer key set.' }
      let correctCount = 0
      for (const k of keys) {
        const c = normalizeString(String(correctMap[k]))
        const g = normalizeString(String(givenMap[k] ?? ''))
        if (c && g === c) correctCount++
      }
      // Proportional marking for matching questions
      const marksAwarded = (correctCount / keys.length) * maxMarks
      const isCorrect = correctCount === keys.length
      return {
        isCorrect,
        marksAwarded: Math.round(marksAwarded * 100) / 100,
        maxMarks,
        feedback: `${correctCount} of ${keys.length} matched correctly.`,
      }
    }

    case 'SHORT_ANSWER': {
      // AI-assisted marking — handled asynchronously in markAnswer below
      // This stub should never be reached directly.
      return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'Short answer requires AI marking.' }
    }

    default:
      return { isCorrect: false, marksAwarded: 0, maxMarks, feedback: 'Unknown question type.' }
  }
}

function parseBool(v: any): boolean | null {
  if (v === true || v === 'true' || v === 'True' || v === 'TRUE' || v === 1 || v === '1' || v === 'T' || v === 't') return true
  if (v === false || v === 'false' || v === 'False' || v === 'FALSE' || v === 0 || v === '0' || v === 'F' || v === 'f') return false
  return null
}

// ---------------------------------------------------------------------------
// AI MARKING (short answer only)
// ---------------------------------------------------------------------------
export async function markShortAnswerQuestion(
  questionText: string,
  markingGuide: string,
  learnerAnswer: string,
  maxMarks: number,
) {
  const r = await markShortAnswer(questionText, markingGuide, String(learnerAnswer ?? ''), maxMarks)
  return {
    isCorrect: r.isCorrect,
    marksAwarded: r.marksAwarded,
    maxMarks,
    feedback: r.feedback,
    aiResult: r,
  }
}

// ---------------------------------------------------------------------------
// GRADE COMPUTATION — Zambian scale
// ---------------------------------------------------------------------------
export function computeGrade(percentage: number): string {
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B'
  if (percentage >= 60) return 'C'
  if (percentage >= 50) return 'D'
  return 'F'
}

export function computePercentage(score: number, maxScore: number): number {
  if (!maxScore || maxScore <= 0) return 0
  return Math.round((score / maxScore) * 1000) / 10
}

export function isPassed(percentage: number, passingScore: number): boolean {
  return percentage >= passingScore
}
