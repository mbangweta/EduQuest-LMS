import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { parsePastedQuestions } from '@/lib/ai'
import { auditLog } from '@/lib/audit'

// POST /api/ai/parse-pasted-questions — AI parses pasted exam/revision questions.
// Body: { pastedText, grade, subject, generateMissingOptions? }
// Returns: { questions: [...] }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden — teachers and admins only' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const { pastedText, grade, subject, generateMissingOptions } = body
    if (!pastedText || typeof pastedText !== 'string' || pastedText.trim().length < 10) {
      return NextResponse.json({ error: 'pastedText is required (at least 10 characters)' }, { status: 400 })
    }
    if (!grade || !subject) {
      return NextResponse.json({ error: 'grade and subject are required' }, { status: 400 })
    }
    const result = await parsePastedQuestions({
      pastedText: String(pastedText),
      grade: Number(grade),
      subject: String(subject),
      generateMissingOptions: !!generateMissingOptions,
    })

    await auditLog({
      user, action: 'AI_PARSE_QUESTIONS', entityType: 'quiz_question',
      description: `Parsed ${result.questions.length} questions from pasted text (${pastedText.length} chars)`,
      metadata: { questionCount: result.questions.length, textLength: pastedText.length },
    })

    return NextResponse.json({ questions: result.questions })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to parse questions' }, { status: 500 })
  }
}
