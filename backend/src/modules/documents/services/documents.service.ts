import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Document } from '../../../generated/prisma/client.js';
import { RagService } from '../../../shared/rag/rag.service.js';
import { StorageService } from '../../../shared/storage/storage.service.js';
import { BUSY_STATUSES, PARSABLE_STATUSES } from '../constants/document.constants.js';
import { DocumentRepository } from '../repositories/document.repository.js';
import { storageKey } from '../utils/file-name.util.js';

/**
 * uploading -> parsing -> pending_review -> (admin approves) -> indexing -> ready
 *                    \-> failed (retry re-parses)        indexing error -> back to pending_review
 * Reject = delete. Parse and index run in the background.
 */
@Injectable()
export class DocumentsService {
  private readonly log = new Logger(DocumentsService.name);

  constructor(
    private readonly docs: DocumentRepository,
    private readonly storage: StorageService,
    private readonly rag: RagService,
  ) {}

  list() {
    return this.docs.list();
  }

  get(id: string) {
    return this.find(id);
  }

  /** Step 1 of a file upload: record the document and hand the browser a presigned PUT URL. */
  async createUpload(userId: string, name: string, contentType: string, size: number) {
    const id = randomUUID();
    const key = storageKey(id, name);
    const document = await this.docs.create({ id, key, name, size, uploadedById: userId });
    return { document, upload: await this.storage.presignPut(key, contentType, size) };
  }

  /** Step 2: the browser finished the PUT; parse it for review. Also retries a failed parse. */
  async complete(id: string) {
    const doc = await this.find(id);
    if (!PARSABLE_STATUSES.includes(doc.status)) throw new ConflictException('Tài liệu đã được phân tích');
    return this.startParse(doc);
  }

  async createFromUrl(userId: string, url: string) {
    const doc = await this.docs.create({ name: url, url, uploadedById: userId });
    return this.startParse(doc);
  }

  async chunks(id: string) {
    await this.find(id);
    return this.docs.chunks(id);
  }

  /** Original uploaded file, to compare with the parsed chunks. URL documents have none. */
  async fileUrl(id: string) {
    const doc = await this.find(id);
    if (!doc.key) throw new NotFoundException('Tài liệu không có file gốc');
    return { url: await this.storage.presignGet(doc.key) };
  }

  /** Fix a chunk the parser mangled; only while it's waiting for review. */
  async updateChunk(id: string, index: number, content: string) {
    this.assertReviewable(await this.find(id));
    const chunk = await this.docs.updateChunk(id, index, content);
    if (!chunk) throw new NotFoundException('Không tìm thấy đoạn');
    return chunk;
  }

  /** Admin approval: embed exactly the reviewed chunks. */
  async approve(id: string, adminId: string) {
    const doc = await this.find(id);
    this.assertReviewable(doc);
    const chunks = (await this.docs.chunks(id)).map((c) => c.content);
    const indexing = await this.docs.update(id, {
      status: 'indexing',
      error: null,
      approvedById: adminId,
      approvedAt: new Date(),
    });
    this.background(id, async () => {
      try {
        const { chunks: count } = await this.rag.ingest({ docId: id, name: doc.name, chunks });
        await this.docs.update(id, { status: 'ready', chunks: count });
      } catch (e) {
        // a batch may already be in Qdrant: unapproved text must not become searchable
        await this.rag.delete(id).catch(() => undefined);
        throw e;
      }
    }, (error) => ({ status: 'pending_review', error, approvedById: null, approvedAt: null })); // fix and approve again
    return indexing;
  }

  /** Delete, also used as reject. Not while a background job is running, or its result would be orphaned. */
  async remove(id: string) {
    const doc = await this.find(id);
    if (BUSY_STATUSES.includes(doc.status)) throw new ConflictException('Tài liệu đang được xử lý, thử lại sau');
    await this.rag.delete(id); // idempotent; also clears leftovers of a failed indexing
    if (doc.key) await this.storage.delete(doc.key);
    await this.docs.delete(id);
  }

  private async find(id: string) {
    const doc = await this.docs.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    return doc;
  }

  private assertReviewable(doc: Document) {
    if (doc.status !== 'pending_review') throw new ConflictException('Tài liệu không ở trạng thái chờ duyệt');
  }

  private async startParse(doc: Document) {
    const parsing = await this.docs.update(doc.id, { status: 'parsing', error: null });
    this.background(doc.id, async () => {
      const { chunks } = await this.rag.parse({ name: doc.name, ...(doc.key ? { key: doc.key } : { url: doc.url! }) });
      if (!chunks.length) throw new Error('Không đọc được nội dung (file scan/ảnh cần OCR)');
      await this.docs.saveParsed(doc.id, chunks);
    }, (error) => ({ status: 'failed', error }));
    return parsing;
  }

  // shortcut: fire-and-forget in this process; a restart mid-job leaves the document parsing/indexing for good.
  // Move to @nestjs/bullmq when volume grows.
  private background(id: string, job: () => Promise<void>, onError: (msg: string) => Parameters<DocumentRepository['update']>[1]) {
    void job().catch(async (e: Error) => {
      this.log.warn(`document ${id}: ${e.message}`);
      await this.docs.update(id, onError(e.message.slice(0, 1000))).catch(() => undefined); // deleted meanwhile
    });
  }
}
