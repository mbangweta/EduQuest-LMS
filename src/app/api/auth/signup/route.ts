import { NextResponse } from 'next/server'
import { supabaseServer, supabaseService } from '@/lib/supabase'

// ============================================================================
// POST /api/auth/signup — self-signup for SCHOOL or PERSONAL teacher accounts
// ----------------------------------------------------------------------------
// Body for SCHOOL account:
//   {
//     institutionType: 'SCHOOL',
//     name: 'Springfield Primary School',
//     email: 'admin@springfield.edu.zm',
//     password: '...',
//     primaryPhone: '+260...',
//     secondaryPhone: '+260...',           // optional
//     address: '123 Main St, Lusaka',
//     logoDataUrl: 'data:image/png;base64,...',  // optional, ≤100KB
//     motto: 'Knowledge is power',         // optional
//   }
//
// Body for PERSONAL account:
//   {
//     institutionType: 'PERSONAL',
//     name: 'Mr. Bwalya',                  // teacher's name
//     email: 'bwalya@example.com',
//     password: '...',
//     primaryPhone: '+260...',
//     secondaryPhone: '+260...',           // optional
//     address: '...',                       // optional
//     logoDataUrl: 'data:image/png;base64,...',  // optional, ≤100KB
//   }
//
// Behaviour:
//   - SCHOOL: creates a `schools` row + a `profiles` row (role=SCHOOL_ADMIN,
//     institution_type='SCHOOL') linked to the new school.
//   - PERSONAL: creates only a `profiles` row (role=TEACHER,
//     institution_type='PERSONAL'). Personal accounts are restricted:
//       * max 3 classes total
//       * max 10 learners total
//       * no Mark Schedule access
//       * no Report Card access
//
// Logo: accepted as a data URL (base64). Max 100KB. Stored in
// `schools.logo_url` (school) or `profiles.logo_url` (personal).
// ============================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      institutionType, name, email, password,
      primaryPhone, secondaryPhone, address, logoDataUrl, motto,
    } = body

    // ---- Validation ----
    if (!institutionType || !['SCHOOL', 'PERSONAL'].includes(institutionType)) {
      return NextResponse.json(
        { error: 'institutionType must be "SCHOOL" or "PERSONAL"' },
        { status: 400 },
      )
    }
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'email, password and name are required' },
        { status: 400 },
      )
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 },
      )
    }
    if (!primaryPhone || typeof primaryPhone !== 'string') {
      return NextResponse.json(
        { error: 'Primary contact number is required' },
        { status: 400 },
      )
    }
    // Logo size validation — data URL must be ≤100KB
    if (logoDataUrl && typeof logoDataUrl === 'string') {
      // Rough size check: base64 length × 0.75 ≈ byte count
      const base64Part = logoDataUrl.split(',')[1] || ''
      const approxBytes = Math.ceil(base64Part.length * 0.75)
      if (approxBytes > 100 * 1024) {
        return NextResponse.json(
          { error: `Logo file is too large (${Math.round(approxBytes / 1024)} KB). Maximum is 100 KB.` },
          { status: 400 },
        )
      }
    }

    const sb = await supabaseServer()
    const sbService = supabaseService()

    // ---- Create auth user (Supabase Auth) ----
    // Role is set via `user_metadata` so the profiles trigger can pick it up.
    const role = institutionType === 'SCHOOL' ? 'SCHOOL_ADMIN' : 'TEACHER'
    const { data: authData, error: authErr } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          institution_type: institutionType,
        },
      },
    })
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }
    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Signup failed — no user id returned' }, { status: 500 })
    }

    // ---- Create the school row (for SCHOOL accounts) ----
    let schoolId: string | null = null
    if (institutionType === 'SCHOOL') {
      // Generate a short code from the school name
      const codeBase = (name as string)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6)
      const codeSuffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      const schoolCode = `${codeBase}-${codeSuffix}`

      const { data: schoolRow, error: schoolErr } = await sbService
        .from('schools')
        .insert({
          name,
          code: schoolCode,
          address: address || null,
          phone: primaryPhone || null,
          email,
          logo_url: logoDataUrl || null,
          motto: motto || null,
          status: 'ACTIVE',
        })
        .select('id')
        .single()

      if (schoolErr || !schoolRow) {
        // Best-effort cleanup: delete the auth user if school creation fails
        // (we can't actually delete auth users from the service client here)
        return NextResponse.json(
          { error: `Failed to create school record: ${schoolErr?.message || 'unknown error'}` },
          { status: 500 },
        )
      }
      schoolId = schoolRow.id
    }

    // ---- Update the profile row (created by the auth trigger) with extras ----
    // The auth trigger creates a minimal profiles row; we patch it with our
    // institution_type, contact info, address, logo, and school_id.
    const profilePatch: Record<string, any> = {
      institution_type: institutionType,
      phone: primaryPhone || null,
      secondary_phone: secondaryPhone || null,
      address: address || null,
      logo_url: logoDataUrl || null,
    }
    if (schoolId) profilePatch.school_id = schoolId

    const { error: profileErr } = await sbService
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId)

    if (profileErr) {
      // Log but don't fail — the user can still sign in, the profile just
      // won't have the extra contact fields.
      console.error('[signup] failed to patch profile:', profileErr.message)
    }

    return NextResponse.json({
      user: { id: userId, email, name, role, institutionType },
      schoolId,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[signup]', e)
    return NextResponse.json({ error: e?.message || 'Signup failed' }, { status: 500 })
  }
}
