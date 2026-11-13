import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-helpers'
import { generateLesson } from '@/lib/ai'

// POST /api/ai/generate-lesson — teacher/admin
export async function POST(req: Request) {
  try {
    await requireUser(['TEACHER', 'ADMIN'])
    const body = await req.json().catch(() => ({}))
    const { grade, subject, topic, curriculum, duration, learningObjectives, difficulty } = body
    if (!grade || !subject || !topic) {
      return NextResponse.json({ error: 'grade, subject, topic are required' }, { status: 400 })
    }
    const result = await generateLesson({
      grade: Number(grade),
      subject: String(subject),
      topic: String(topic),
      curriculum: (curriculum || 'ZAMBIAN') as any,
      duration: duration ? Number(duration) : 40,
      learningObjectives,
      difficulty,
    })
    return NextResponse.json({ lesson: result })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
