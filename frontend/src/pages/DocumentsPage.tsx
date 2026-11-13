import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, type Doc } from '@/lib/api'
import { authClient, canEditDocs } from '@/lib/auth'
import { BUSY, STATUS } from '@/lib/documents'

const ACCEPT = '.pdf,.docx,.md,.txt'

/** presign on the API -> PUT straight to storage -> tell the API to index it */
async function uploadFile(file: File) {
  const contentType = file.type || 'application/octet-stream'
  const { document, upload } = await api<{ document: Doc; upload: { url: string; headers: Record<string, string> } }>(
    '/documents',
    { method: 'POST', body: JSON.stringify({ name: file.name, contentType, size: file.size }) },
  )
  const put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: file })
  if (!put.ok) throw new Error(`Tải lên storage thất bại (${put.status})`)
  await api(`/documents/${document.id}/complete`, { method: 'POST' })
}

export function DocumentsPage() {
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const editable = canEditDocs(session?.user.role)
  const fileInput = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')

  const docs = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<Doc[]>('/documents'),
    // poll only while something is still being indexed
    refetchInterval: (q) => (q.state.data?.some((d) => BUSY.includes(d.status)) ? 3000 : false),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['documents'] })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const results = await Promise.allSettled(files.map(uploadFile))
      results.forEach((r, i) =>
        r.status === 'fulfilled'
          ? toast.success(`Đã tải lên ${files[i].name}, đang phân tích để duyệt`)
          : toast.error(`${files[i].name}: ${r.reason.message}`),
      )
    },
    onSettled: () => {
      refresh()
      if (fileInput.current) fileInput.current.value = ''
    },
  })
  const addUrl = useMutation({
    mutationFn: (u: string) => api('/documents/url', { method: 'POST', body: JSON.stringify({ url: u }) }),
    onSuccess: () => setUrl(''),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })
  const retry = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}/complete`, { method: 'POST' }),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  })

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 overflow-y-auto p-4">
      <h1 className="text-lg font-semibold">Tài liệu</h1>

      {editable && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => e.target.files?.length && upload.mutate([...e.target.files])}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? 'Đang tải lên...' : 'Tải tài liệu lên'}
            </Button>
          </div>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (url.trim()) addUrl.mutate(url.trim())
            }}
          >
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://... (trang web)" aria-label="URL trang web" />
            <Button type="submit" variant="outline" disabled={!url.trim() || addUrl.isPending}>Thêm URL</Button>
          </form>
        </div>
      )}
      {editable && (
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, MD, TXT, tối đa 50MB. Tài liệu chỉ được dùng để hỏi đáp sau khi quản trị viên duyệt.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Đoạn</TableHead>
            <TableHead>Người tải</TableHead>
            <TableHead>Người duyệt</TableHead>
            <TableHead>Ngày</TableHead>
            {editable && <TableHead className="w-36" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có tài liệu nào.</TableCell>
            </TableRow>
          )}
          {docs.data?.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="max-w-xs truncate" title={d.name}>
                {editable && d.status !== 'uploading' && d.status !== 'parsing' && d.status !== 'failed' ? (
                  <Link to="/documents/$id" params={{ id: d.id }} className="underline-offset-4 hover:underline">
                    {d.name}
                  </Link>
                ) : (
                  d.name
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS[d.status].variant} title={d.error ?? undefined}>{STATUS[d.status].label}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{d.chunks ?? '–'}</TableCell>
              <TableCell>{d.uploadedBy.name}</TableCell>
              <TableCell>{d.approvedBy?.name ?? '–'}</TableCell>
              <TableCell>{new Date(d.createdAt).toLocaleDateString('vi-VN')}</TableCell>
              {editable && (
                <TableCell className="text-right whitespace-nowrap">
                  {d.status === 'pending_review' && (
                    <Link to="/documents/$id" params={{ id: d.id }} className="mr-2 text-sm underline-offset-4 hover:underline">
                      Xem &amp; duyệt
                    </Link>
                  )}
                  {d.status === 'failed' && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Phân tích lại ${d.name}`} onClick={() => retry.mutate(d.id)}>
                      <RotateCw />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={BUSY.includes(d.status) && d.status !== 'uploading'}
                    aria-label={`Xóa ${d.name}`}
                    onClick={() => confirm(`Xóa "${d.name}"?`) && remove.mutate(d.id)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
