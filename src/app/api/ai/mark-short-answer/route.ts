import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-helpers'
import { markShortAnswer } from '@/lib/ai'

// POST /api/ai/mark-short-answer — teacher/admin only (for manual preview)
export async function POST(req: Request) {
  try {
    await requireUser(['TEACHER', 'ADMIN'])
    const body = await req.json().catch(() => ({}))
    const { questionText, markingGuide, learnerAnswer, maxMarks } = body
    if (!questionText || !learnerAnswer || !maxMarks) {
      return NextResponse.json({ error: 'questionText, learnerAnswer, maxMarks required' }, { status: 400 })
    }
    const result = await markShortAnswer(
      String(questionText),
      String(markingGuide ?? ''),
      String(learnerAnswer),
      Number(maxMarks),
    )
    return NextResponse.json({ result })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
