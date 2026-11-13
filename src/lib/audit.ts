import { supabaseService } from './supabase'
import type { CurrentUser } from './auth-supabase'

// Audit log helper — records an action to the audit_logs table.
// Best-effort: errors are logged but never thrown.
export async function auditLog(opts: {
  user: CurrentUser
  action: string
  entityType?: string
  entityId?: string
  description: string
  schoolId?: string | null
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}) {
  try {
    const sb = supabaseService()
    const { error } = await sb.from('audit_logs').insert({
      actor_id: opts.user.id,
      actor_email: opts.user.email,
      actor_role: opts.user.role,
      school_id: opts.schoolId ?? opts.user.schoolId ?? null,
      action: opts.action,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      description: opts.description,
      metadata: opts.metadata ?? null,
      ip_address: opts.ipAddress ?? null,
      user_agent: opts.userAgent ?? null,
    })
    if (error) console.error('[auditLog] failed:', error.message)
  } catch (e: any) {
    console.error('[auditLog] exception:', e?.message)
  }
}
