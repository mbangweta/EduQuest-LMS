import { requireUser, supabaseService } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

// GET /api/analytics/quiz/[id]/export — return CSV
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const sb = supabaseService()

    const { data: quiz, error: qErr } = await sb.from('quizzes').select('id, title, teacher_id').eq('id', id).maybeSingle()
    if (qErr) return new Response(qErr.message, { status: 500 })
    if (!quiz) return new Response('Not found', { status: 404 })
    if (user.role !== 'ADMIN' && quiz.teacher_id !== user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    const { data: attempts, error: aErr } = await sb.from('quiz_attempts').select(`
      id, attempt_number, score, max_score, percentage, grade, passed, time_spent, submitted_at,
      learner:profiles(name, email)
    `).eq('quiz_id', id).eq('status', 'SUBMITTED').order('submitted_at', { ascending: false, nullsFirst: false })
    if (aErr) return new Response(aErr.message, { status: 500 })

    const rows: string[][] = [['learnerName', 'email', 'attemptNumber', 'score', 'maxScore', 'percentage', 'grade', 'passed', 'timeSpent', 'submittedAt']]
    for (const a of (attempts || [])) {
      rows.push([
        a.learner?.name ?? '',
        a.learner?.email ?? '',
        String(a.attempt_number),
        String(a.score ?? ''),
        String(a.max_score ?? ''),
        String(a.percentage ?? ''),
        a.grade ?? '',
        String(a.passed ?? ''),
        String(a.time_spent ?? ''),
        a.submitted_at ? new Date(a.submitted_at).toISOString() : '',
      ])
    }
    const csv = rows.map((r) => r.map((cell) => {
      const c = String(cell ?? '')
      if (c.includes(',') || c.includes('"') || c.includes('\n')) {
        return `"${c.replace(/"/g, '""')}"`
      }
      return c
    }).join(',')).join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="quiz-${quiz.title.replace(/[^a-z0-9]+/gi, '_')}.csv"`,
      },
    })
  } catch (e: any) {
    // requireUser throws a NextResponse — pass it through
    if (e instanceof NextResponse) return e
    return new Response(e?.message || 'Internal server error', { status: 500 })
  }
}
