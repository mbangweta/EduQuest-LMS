import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { regenerateQuestion, type QuestionType } from '@/lib/ai'

// POST /api/ai/regenerate-question — AI regenerates a single question.
// Body: { prompt?, grade, subject, topic, difficulty, questionType, curriculum,
//         existingQuestionText?, avoidQuestions? }
// Returns: { question: {...} }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { prompt, grade, subject, topic, difficulty, questionType, curriculum,
            existingQuestionText, avoidQuestions } = body
    if (!grade || !subject || !topic || !questionType) {
      return NextResponse.json({ error: 'grade, subject, topic, questionType required' }, { status: 400 })
    }
    const question = await regenerateQuestion({
      prompt: prompt || undefined,
      grade: Number(grade),
      subject: String(subject),
      topic: String(topic),
      difficulty: (difficulty || 'MEDIUM') as any,
      questionType: questionType as QuestionType,
      curriculum: (curriculum || 'ZAMBIAN') as any,
      existingQuestionText: existingQuestionText || undefined,
      avoidQuestions: Array.isArray(avoidQuestions) ? avoidQuestions : undefined,
    })
    if (!question) {
      return NextResponse.json({ error: 'AI failed to generate a replacement question' }, { status: 500 })
    }
    return NextResponse.json({ question })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to regenerate question' }, { status: 500 })
  }
}
