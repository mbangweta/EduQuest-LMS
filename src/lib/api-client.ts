// EduQuest LMS — Thin fetch wrapper for the frontend.
// All paths are relative so the NextAuth cookie flows. Throws on non-2xx.

export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body?: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  let res: Response
  try {
    res = await fetch(path, opts)
  } catch (e: any) {
    throw new ApiError(e?.message || 'Network error', 0)
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null)
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`
    throw new ApiError(message, res.status, data)
  }
  return data as T
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body),
  patch: <T = any>(path: string, body?: any) => request<T>('PATCH', path, body),
  put: <T = any>(path: string, body?: any) => request<T>('PUT', path, body),
  del: <T = any>(path: string) => request<T>('DELETE', path),
}
