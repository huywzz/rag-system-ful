/** fetch for the NestJS API: same-origin cookies, JSON in/out, error message from the body. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  })
  if (res.status === 401) {
    window.location.assign('/login')
    throw new Error('Phiên đăng nhập đã hết hạn')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.message ?? res.statusText
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export type DocumentStatus = 'uploading' | 'parsing' | 'pending_review' | 'indexing' | 'ready' | 'failed'
type Person = { id: string; name: string; email: string }
export type Doc = {
  id: string
  name: string
  url: string | null
  size: number | null
  status: DocumentStatus
  chunks: number | null
  error: string | null
  createdAt: string
  approvedAt: string | null
  uploadedBy: Person
  approvedBy: Person | null
}
export type Chunk = { id: string; index: number; content: string; edited: boolean }
export type Conversation = { id: string; title: string; updatedAt: string }
export type Message = { id: string; role: 'user' | 'assistant'; content: string; sources: string[] }
