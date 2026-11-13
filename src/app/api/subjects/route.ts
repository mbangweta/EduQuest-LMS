import { NextResponse } from 'next/server'
import { requireUser, supabaseService } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/auth-supabase'
import { auditLog } from '@/lib/audit'

// GET /api/subjects — list all subjects (any authenticated user)
export async function GET() {
  try {
    await requireUser()
    const sb = supabaseService()
    const { data, error } = await sb
      .from('subjects')
      .select('id, name, code, description, color, created_at')
      .order('name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const subjects = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      color: s.color,
      createdAt: s.created_at,
    }))
    return NextResponse.json({ subjects })
  } catch (e: any) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/subjects — create a new subject.
// SUPER_USER, SCHOOL_ADMIN, and TEACHER can all create subjects.
// Subjects are platform-wide (Zambian curriculum is shared across schools),
// but we audit-log the creation with the actor's school context.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden — only teachers and admins can create subjects' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, code, description, color } = body
    if (!name || !code) {
      return NextResponse.json({ error: 'name and code are required' }, { status: 400 })
    }

    const sb = supabaseService()
    // Check for duplicate code (case-insensitive)
    const { data: existing } = await sb.from('subjects').select('id').ilike('code', String(code)).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Subject code already exists' }, { status: 409 })

    const { data, error } = await sb.from('subjects').insert({
      name: String(name),
      code: String(code).toUpperCase(),
      description: description ? String(description) : null,
      color: color || '#2563eb',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditLog({
      user, action: 'SUBJECT_CREATE', entityType: 'subject', entityId: data.id,
      description: `Created subject "${data.name}" (${data.code})`,
      metadata: { name: data.name, code: data.code },
    })

    return NextResponse.json({ subject: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
