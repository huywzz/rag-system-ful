import { Injectable } from '@nestjs/common';
import { PrismaClient, type Document, type Prisma } from '../../../generated/prisma/client.js';

const person = { select: { id: true, name: true, email: true } } as const;

export type DocumentPatch = Partial<Pick<Document, 'status' | 'chunks' | 'error' | 'approvedById' | 'approvedAt'>>;

@Injectable()
export class DocumentRepository {
  constructor(private readonly db: PrismaClient) {}

  list() {
    return this.db.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: person, approvedBy: person },
    });
  }

  findById(id: string) {
    return this.db.document.findUnique({ where: { id }, include: { uploadedBy: person, approvedBy: person } });
  }

  create(data: Prisma.DocumentUncheckedCreateInput) {
    return this.db.document.create({ data });
  }

  update(id: string, data: DocumentPatch) {
    return this.db.document.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.db.document.delete({ where: { id } }); // chunks cascade
  }

  chunks(documentId: string) {
    return this.db.documentChunk.findMany({ where: { documentId }, orderBy: { index: 'asc' } });
  }

  /** Parse result replaces any earlier one, together with the status change. */
  async saveParsed(documentId: string, contents: string[]) {
    await this.db.$transaction([
      this.db.documentChunk.deleteMany({ where: { documentId } }),
      this.db.documentChunk.createMany({ data: contents.map((content, index) => ({ documentId, index, content })) }),
      this.db.document.update({
        where: { id: documentId },
        data: { status: 'pending_review', chunks: contents.length, error: null },
      }),
    ]);
  }

  /** null when the chunk doesn't exist */
  updateChunk(documentId: string, index: number, content: string) {
    return this.db.documentChunk
      .update({ where: { documentId_index: { documentId, index } }, data: { content, edited: true } })
      .catch(() => null);
  }
}
