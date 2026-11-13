import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, type Conversation, type Message } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ChatPage() {
  const { c: activeId } = useSearch({ from: '/app/' })
  const navigate = useNavigate({ from: '/' })
  const qc = useQueryClient()
  const [question, setQuestion] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const conversations = useQuery({ queryKey: ['conversations'], queryFn: () => api<Conversation[]>('/conversations') })
  const messages = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => api<Message[]>(`/conversations/${activeId}/messages`),
    enabled: !!activeId,
  })

  const ask = useMutation({
    mutationFn: (q: string) =>
      api<{ conversationId: string }>('/conversations/ask', {
        method: 'POST',
        body: JSON.stringify({ question: q, conversationId: activeId }),
      }),
    onSuccess: ({ conversationId }) => {
      setQuestion('')
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      navigate({ search: { c: conversationId } })
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      if (id === activeId) navigate({ search: {} })
    },
    onError: (e) => toast.error(e.message),
  })

  useEffect(() => {
    // braces matter: newer browsers make scrollIntoView return a Promise, and an effect may only return a cleanup fn
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.data, ask.isPending])

  function submit() {
    const q = question.trim()
    if (q && !ask.isPending) ask.mutate(q)
  }

  const shown = activeId ? (messages.data ?? []) : []

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r p-3 md:flex">
        <Button variant="outline" onClick={() => navigate({ search: {} })}>Cuộc trò chuyện mới</Button>
        {conversations.data?.map((c) => (
          <div
            key={c.id}
            className={cn('group flex items-center rounded-md text-sm hover:bg-muted', c.id === activeId && 'bg-muted font-medium')}
          >
            <button className="min-w-0 flex-1 truncate px-2 py-1.5 text-left" onClick={() => navigate({ search: { c: c.id } })}>
              {c.title}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Xóa "${c.title}"`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => remove.mutate(c.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {!activeId && !ask.isPending && (
              <p className="mt-16 text-center text-muted-foreground">Đặt câu hỏi về tài liệu nội bộ để bắt đầu.</p>
            )}
            {shown.map((m) => <Bubble key={m.id} role={m.role} content={m.content} sources={m.sources} />)}
            {ask.isPending && (
              <>
                <Bubble role="user" content={ask.variables} />
                <p className="text-sm text-muted-foreground" aria-live="polite">Đang tìm câu trả lời...</p>
              </>
            )}
            <div ref={bottom} />
          </div>
        </div>
        <form
          className="mx-auto flex w-full max-w-3xl gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Đặt câu hỏi về tài liệu... (Enter để gửi, Shift+Enter xuống dòng)"
            aria-label="Câu hỏi"
            rows={2}
            className="resize-none"
          />
          <Button type="submit" disabled={!question.trim() || ask.isPending}>Gửi</Button>
        </form>
      </section>
    </div>
  )
}

function Bubble({ role, content, sources = [] }: { role: Message['role']; content: string; sources?: string[] }) {
  return (
    <div className={cn('flex flex-col gap-2', role === 'user' && 'items-end')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
          role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {content}
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sources.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
        </div>
      )}
    </div>
  )
}
