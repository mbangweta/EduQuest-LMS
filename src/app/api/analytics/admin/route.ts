import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-supabase'
import { supabaseService } from '@/lib/supabase'

// GET /api/analytics/admin — school-scoped analytics for SUPER_USER (across all schools)
// and SCHOOL_ADMIN (own school only). Replaces the old "ADMIN" role check.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['SUPER_USER', 'SCHOOL_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const sb = supabaseService()

    // For SCHOOL_ADMIN, scope all counts to their school. For SUPER_USER, all schools.
    const isSuper = user.role === 'SUPER_USER'
    const schoolFilter = isSuper ? null : user.schoolId
    if (!isSuper && !schoolFilter) return NextResponse.json({ error: 'No school assigned' }, { status: 403 })

    const applyScope = (q: any, column = 'school_id') => (schoolFilter ? q.eq(column, schoolFilter) : q)

    const [
      totalUsers, teachers, learners, schoolAdmins, superUsers, classes, subjects,
      lessonsPublished, lessonsDraft, quizzesPublished, quizzesDraft,
      quizAttempts, quizAttempts7d, libraryResources, recentNotifications,
    ] = await Promise.all([
      applyScope(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE')),
      applyScope(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'TEACHER').eq('status', 'ACTIVE')),
      applyScope(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'LEARNER').eq('status', 'ACTIVE')),
      applyScope(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SCHOOL_ADMIN').eq('status', 'ACTIVE')),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SUPER_USER').eq('status', 'ACTIVE'),
      applyScope(sb.from('classes').select('id', { count: 'exact', head: true })),
      sb.from('subjects').select('id', { count: 'exact', head: true }),
      applyScope(sb.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED')),
      applyScope(sb.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'DRAFT')),
      applyScope(sb.from('quizzes').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED')),
      applyScope(sb.from('quizzes').select('id', { count: 'exact', head: true }).eq('status', 'DRAFT')),
      applyScope(sb.from('quiz_attempts').select('id', { count: 'exact', head: true })),
      applyScope(sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).gte('submitted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())),
      applyScope(sb.from('library_resources').select('id', { count: 'exact', head: true })),
      applyScope(sb.from('notifications').select(`
        id, user_id, type, title, message, data, read, created_at,
        user:profiles(id, name, avatar_color)
      `), 'school_id').order('created_at', { ascending: false }).limit(10),
    ])

    // Learners per grade (4..7)
    const gradeBuckets: { grade: number; count: number }[] = []
    for (let g = 4; g <= 7; g++) {
      let q = sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'LEARNER').eq('grade', g)
      if (schoolFilter) q = q.eq('school_id', schoolFilter)
      const { count } = await q
      gradeBuckets.push({ grade: g, count: count ?? 0 })
    }

    // For super user: also return per-school summary
    let schoolsOverview: any[] = []
    if (isSuper) {
      const { data: schoolsList } = await sb.from('schools').select('id, name, code, status').order('name')
      schoolsOverview = await Promise.all((schoolsList || []).map(async (s: any) => {
        const [u, c, t, l] = await Promise.all([
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id),
          sb.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', s.id),
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id).eq('role', 'TEACHER'),
          sb.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', s.id).eq('role', 'LEARNER'),
        ])
        return {
          id: s.id, name: s.name, code: s.code, status: s.status,
          users: u.count ?? 0, classes: c.count ?? 0,
          teachers: t.count ?? 0, learners: l.count ?? 0,
        }
      }))
    }

    return NextResponse.json({
      counts: {
        totalUsers: totalUsers.count ?? 0,
        teachers: teachers.count ?? 0,
        learners: learners.count ?? 0,
        schoolAdmins: schoolAdmins.count ?? 0,
        superUsers: superUsers.count ?? 0,
        classes: classes.count ?? 0,
        subjects: subjects.count ?? 0,
        lessonsPublished: lessonsPublished.count ?? 0,
        lessonsDraft: lessonsDraft.count ?? 0,
        quizzesPublished: quizzesPublished.count ?? 0,
        quizzesDraft: quizzesDraft.count ?? 0,
        quizAttempts: quizAttempts.count ?? 0,
        quizAttempts7d: quizAttempts7d.count ?? 0,
        libraryResources: libraryResources.count ?? 0,
        schools: isSuper ? (schoolsOverview.length) : 1,
      },
      gradeBuckets,
      roleDistribution: [
        { name: 'Super User', value: superUsers.count ?? 0 },
        { name: 'School Admin', value: schoolAdmins.count ?? 0 },
        { name: 'Teacher', value: teachers.count ?? 0 },
        { name: 'Learner', value: learners.count ?? 0 },
      ],
      schoolsOverview: schoolsOverview,
      school: user.role === 'SCHOOL_ADMIN' ? { id: user.schoolId, name: user.schoolName, code: user.schoolCode } : null,
      recentNotifications: (recentNotifications.data || []).map((n: any) => ({
        id: n.id, userId: n.user_id, type: n.type, title: n.title, message: n.message,
        data: n.data, read: n.read, createdAt: n.created_at, user: n.user,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}
