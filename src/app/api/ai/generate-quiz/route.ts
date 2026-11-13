import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-helpers'
import { generateQuiz, type QuestionType } from '@/lib/ai'

// POST /api/ai/generate-quiz — teacher/admin
export async function POST(req: Request) {
  try {
    await requireUser(['TEACHER', 'ADMIN'])
    const body = await req.json().catch(() => ({}))
    const {
      title, grade, subject, topic, difficulty, numberOfQuestions, questionTypes, curriculum,
    } = body
    if (!title || !grade || !subject || !topic) {
      return NextResponse.json({ error: 'title, grade, subject, topic are required' }, { status: 400 })
    }
    const types = (Array.isArray(questionTypes) ? questionTypes : ['MULTIPLE_CHOICE']) as QuestionType[]
    if (types.length === 0) return NextResponse.json({ error: 'questionTypes required' }, { status: 400 })

    const result = await generateQuiz({
      title: String(title),
      grade: Number(grade),
      subject: String(subject),
      topic: String(topic),
      difficulty: (difficulty || 'MEDIUM') as any,
      numberOfQuestions: Number(numberOfQuestions) || 5,
      questionTypes: types,
      curriculum: (curriculum || 'ZAMBIAN') as any,
    })
    return NextResponse.json({ questions: result.questions })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
