import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Document } from '../../../generated/prisma/client.js';
import type { RagService } from '../../../shared/rag/rag.service.js';
import type { StorageService } from '../../../shared/storage/storage.service.js';
import type { DocumentRepository } from '../repositories/document.repository.js';
import { DocumentsService } from './documents.service.js';

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'd1',
  name: 'a.pdf',
  key: 'd1/a.pdf',
  url: null,
  size: 10,
  status: 'uploading',
  chunks: null,
  error: null,
  uploadedById: 'u1',
  approvedById: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function setup(current: Document | null = doc()) {
  const repo = {
    findById: vi.fn().mockResolvedValue(current),
    create: vi.fn(async (d: Partial<Document>) => doc(d)),
    update: vi.fn(async (id: string, patch: Partial<Document>) => doc({ id, ...patch })),
    delete: vi.fn(),
    chunks: vi.fn().mockResolvedValue([{ content: 'đoạn 1' }, { content: 'đoạn 2 đã sửa' }]),
    saveParsed: vi.fn(),
    updateChunk: vi.fn().mockResolvedValue({ index: 0, content: 'x', edited: true }),
  };
  const storage = {
    presignPut: vi.fn().mockResolvedValue({ url: 'https://put', headers: {} }),
    presignGet: vi.fn().mockResolvedValue('https://get'),
    delete: vi.fn(),
  };
  const rag = {
    parse: vi.fn().mockResolvedValue({ chunks: ['c1', 'c2'] }),
    ingest: vi.fn().mockResolvedValue({ chunks: 2 }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const svc = new DocumentsService(
    repo as unknown as DocumentRepository,
    storage as unknown as StorageService,
    rag as unknown as RagService,
  );
  return { repo, storage, rag, svc };
}

describe('DocumentsService', () => {
  it('stores the upload under "<id>/<name>" and presigns that exact key', async () => {
    const { repo, storage, svc } = setup();
    await svc.createUpload('u1', 'a.pdf', 'application/pdf', 10);
    const { id, key } = repo.create.mock.calls[0][0];
    expect(key).toBe(`${id}/a.pdf`);
    expect(storage.presignPut).toHaveBeenCalledWith(key, 'application/pdf', 10);
  });

  describe('fileUrl', () => {
    it('presigns a view URL for the stored file', async () => {
      const { storage, svc } = setup();
      await expect(svc.fileUrl('d1')).resolves.toEqual({ url: 'https://get' });
      expect(storage.presignGet).toHaveBeenCalledWith('d1/a.pdf');
    });

    it('404s for a URL document, which has no stored file', async () => {
      const { svc } = setup(doc({ key: null, url: 'https://x' }));
      await expect(svc.fileUrl('d1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('parse (after upload)', () => {
    it('parses into chunks for review without embedding anything', async () => {
      const { repo, rag, svc } = setup();
      expect((await svc.complete('d1')).status).toBe('parsing');
      expect(rag.parse).toHaveBeenCalledWith({ name: 'a.pdf', key: 'd1/a.pdf' });
      await vi.waitFor(() => expect(repo.saveParsed).toHaveBeenCalledWith('d1', ['c1', 'c2']));
      expect(rag.ingest).not.toHaveBeenCalled();
    });

    it('fails when nothing readable comes out', async () => {
      const { repo, rag, svc } = setup();
      rag.parse.mockResolvedValue({ chunks: [] });
      await svc.complete('d1');
      await vi.waitFor(() =>
        expect(repo.update).toHaveBeenCalledWith('d1', expect.objectContaining({ status: 'failed' })),
      );
      expect(repo.saveParsed).not.toHaveBeenCalled();
    });

    it('can retry a failed parse but not re-parse a reviewed document', async () => {
      await expect(setup(doc({ status: 'failed' })).svc.complete('d1')).resolves.toBeDefined();
      await expect(setup(doc({ status: 'pending_review' })).svc.complete('d1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('review', () => {
    it('edits a chunk only while pending review', async () => {
      const { repo, svc } = setup(doc({ status: 'pending_review' }));
      await svc.updateChunk('d1', 0, 'sửa lại');
      expect(repo.updateChunk).toHaveBeenCalledWith('d1', 0, 'sửa lại');
      await expect(setup(doc({ status: 'ready' })).svc.updateChunk('d1', 0, 'x')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('reports a missing chunk as not found', async () => {
      const { repo, svc } = setup(doc({ status: 'pending_review' }));
      repo.updateChunk.mockResolvedValue(null);
      await expect(svc.updateChunk('d1', 99, 'x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approve', () => {
    it('embeds exactly the reviewed chunks, records the approver, then marks ready', async () => {
      const { repo, rag, svc } = setup(doc({ status: 'pending_review' }));
      const res = await svc.approve('d1', 'admin1');
      expect(res.status).toBe('indexing');
      expect(repo.update).toHaveBeenCalledWith('d1', expect.objectContaining({ approvedById: 'admin1' }));
      expect(rag.ingest).toHaveBeenCalledWith({ docId: 'd1', name: 'a.pdf', chunks: ['đoạn 1', 'đoạn 2 đã sửa'] });
      await vi.waitFor(() => expect(repo.update).toHaveBeenCalledWith('d1', { status: 'ready', chunks: 2 }));
    });

    it('on embedding failure removes partial vectors and goes back to review', async () => {
      const { repo, rag, svc } = setup(doc({ status: 'pending_review' }));
      rag.ingest.mockRejectedValue(new Error('qdrant down'));
      await svc.approve('d1', 'admin1');
      await vi.waitFor(() =>
        expect(repo.update).toHaveBeenCalledWith('d1', {
          status: 'pending_review',
          error: 'qdrant down',
          approvedById: null,
          approvedAt: null,
        }),
      );
      expect(rag.delete).toHaveBeenCalledWith('d1');
    });

    it('only approves documents waiting for review', async () => {
      const { rag, svc } = setup(doc({ status: 'parsing' }));
      await expect(svc.approve('d1', 'admin1')).rejects.toBeInstanceOf(ConflictException);
      expect(rag.ingest).not.toHaveBeenCalled();
    });
  });

  describe('remove / reject', () => {
    it('removes vectors, the stored file and the record', async () => {
      const { repo, storage, rag, svc } = setup(doc({ status: 'pending_review' }));
      await svc.remove('d1');
      expect(rag.delete).toHaveBeenCalledWith('d1');
      expect(storage.delete).toHaveBeenCalledWith('d1/a.pdf');
      expect(repo.delete).toHaveBeenCalledWith('d1');
    });

    it('waits while a background job owns the document', async () => {
      const { repo, svc } = setup(doc({ status: 'indexing' }));
      await expect(svc.remove('d1')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('reports a missing document as not found', async () => {
      await expect(setup(null).svc.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
