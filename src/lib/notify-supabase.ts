import { supabaseService } from './supabase'

// EduQuest LMS — Supabase notification helper
export async function notifySupabase(
  userId: string,
  payload: {
    type: string
    title: string
    message: string
    data?: Record<string, any> | null
  },
) {
  try {
    await supabaseService().from('notifications').insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data ?? null,
    })
  } catch (e) {
    console.error('[notifySupabase]', e)
  }
}
