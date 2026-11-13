import type { DocumentStatus } from '@/lib/api'

export const STATUS: Record<DocumentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  uploading: { label: 'Đang tải lên', variant: 'outline' },
  parsing: { label: 'Đang phân tích', variant: 'secondary' },
  pending_review: { label: 'Chờ duyệt', variant: 'outline' },
  indexing: { label: 'Đang embedding', variant: 'secondary' },
  ready: { label: 'Đã duyệt', variant: 'default' },
  failed: { label: 'Phân tích lỗi', variant: 'destructive' },
}
export const BUSY: DocumentStatus[] = ['uploading', 'parsing', 'indexing']
