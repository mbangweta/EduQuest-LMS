import { db } from './db'

// EduQuest LMS — tiny notification helper used across API routes.
export async function notify(
  userId: string,
  payload: {
    type: string
    title: string
    message: string
    data?: Record<string, any> | null
  },
) {
  try {
    await db.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        dataJson: payload.data ? JSON.stringify(payload.data) : null,
      },
    })
  } catch (e) {
    // best-effort
  }
}
