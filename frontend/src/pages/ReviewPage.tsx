import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, type Chunk, type Doc } from '@/lib/api'
import { authClient, canEditDocs } from '@/lib/auth'
import { BUSY, STATUS } from '@/lib/documents'
import { cn } from '@/lib/utils'

/** Review parsed chunks before they get embedded: editors fix unreadable ones, admins approve or reject. */
export function ReviewPage() {
  const { id } = useParams({ from: '/app/documents/$id' })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user.role === 'admin'

  const doc = useQuery({
    queryKey: ['documents', id],
    queryFn: () => api<Doc>(`/documents/${id}`),
    refetchInterval: (q) => (q.state.data && BUSY.includes(q.state.data.status) ? 3000 : false),
  })
  const status = doc.data?.status
  const chunks = useQuery({
    queryKey: ['documents', id, 'chunks'],
    queryFn: () => api<Chunk[]>(`/documents/${id}/chunks`),
    enabled: status === 'pending_review' || status === 'indexing' || status === 'ready',
  })
  // browsers render PDFs natively; other formats (docx, md, txt) would just download
  const isPdf = !!doc.data?.name.toLowerCase().endsWith('.pdf') && !doc.data.url
  const file = useQuery({
    queryKey: ['documents', id, 'file'],
    queryFn: () => api<{ url: string }>(`/documents/${id}/file`),
    enabled: isPdf,
    staleTime: Infinity, // a new presigned URL would reload the iframe and lose the reader's page
    refetchOnWindowFocus: false,
  })
  const reviewing = status === 'pending_review'
  const canEdit = reviewing && canEditDocs(session?.user.role)
  const kept = chunks.data?.filter((c) => c.content.trim()).length ?? 0

  const approve = useMutation({
    mutationFn: () => api(`/documents/${id}/approve`, { method: 'POST' }),
    onSuccess: () => toast.success('Đã duyệt, đang embedding'),
    onError: (e) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
  const reject = useMutation({
    mutationFn: () => api(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Đã từ chối và xóa tài liệu')
      qc.invalidateQueries({ queryKey: ['documents'] })
      navigate({ to: '/documents' })
    },
    onError: (e) => toast.error(e.message),
  })

  if (doc.isError) return <p className="p-4 text-destructive">{doc.error.message}</p>
  if (!doc.data) return <p className="p-4 text-muted-foreground">Đang tải...</p>

  return (
    <div className={cn('mx-auto flex h-full flex-col gap-4 p-4', file.data ? 'max-w-6xl' : 'max-w-4xl')}>
      <Link to="/documents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tài liệu
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-lg font-semibold" title={doc.data.name}>{doc.data.name}</h1>
        <Badge variant={STATUS[doc.data.status].variant}>{STATUS[doc.data.status].label}</Badge>
        {file.data && (
          <a href={file.data.url} target="_blank" rel="noreferrer" className="text-sm underline lg:hidden">Mở file gốc</a>
        )}
        {isAdmin && reviewing && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="destructive"
              disabled={reject.isPending}
              onClick={() => confirm(`Từ chối sẽ xóa luôn "${doc.data.name}" và file gốc. Tiếp tục?`) && reject.mutate()}
            >
              Từ chối
            </Button>
            <Button disabled={approve.isPending || kept === 0} onClick={() => approve.mutate()}>
              Duyệt &amp; embedding ({kept} đoạn)
            </Button>
          </div>
        )}
      </div>

      {doc.data.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Lần embedding trước lỗi: {doc.data.error}
        </p>
      )}
      {reviewing && (
        <p className="text-sm text-muted-foreground">
          Kiểm tra từng đoạn trước khi duyệt. Đoạn nào đọc không ra thì sửa lại; xóa trắng một đoạn để bỏ nó khỏi embedding.
          {!isAdmin && ' Chỉ quản trị viên mới duyệt được.'}
        </p>
      )}

      <div className={cn('min-h-0 flex-1 gap-4', file.data && 'lg:grid lg:grid-cols-2')}>
        {file.data && (
          <iframe
            src={file.data.url}
            title={`File gốc: ${doc.data.name}`}
            className="hidden size-full rounded-lg border lg:block"
          />
        )}
        <ol className="flex h-full flex-col gap-3 overflow-y-auto">
          {chunks.data?.map((c) => <ChunkItem key={c.id} docId={id} chunk={c} editable={canEdit} />)}
        </ol>
      </div>
    </div>
  )
}

function ChunkItem({ docId, chunk, editable }: { docId: string; chunk: Chunk; editable: boolean }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null) // null = not editing
  const save = useMutation({
    mutationFn: (content: string) =>
      api(`/documents/${docId}/chunks/${chunk.index}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    onSuccess: () => {
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['documents', docId, 'chunks'] })
    },
    onError: (e) => toast.error(e.message),
  })
  const dropped = !chunk.content.trim()

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Đoạn {chunk.index + 1}</span>
        <span>{chunk.content.length} ký tự</span>
        {chunk.edited && <Badge variant="secondary">Đã sửa</Badge>}
        {dropped && <Badge variant="outline">Bỏ qua</Badge>}
        {editable && draft === null && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft(chunk.content)}>Sửa</Button>
        )}
      </div>
      {draft === null ? (
        <p className="whitespace-pre-wrap text-sm">{chunk.content}</p>
      ) : (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            aria-label={`Nội dung đoạn ${chunk.index + 1}`}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Hủy</Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(draft)}>Lưu</Button>
          </div>
        </>
      )}
    </li>
  )
}
