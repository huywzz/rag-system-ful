import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { env } from '../../core/config/env.js';
import type { ChatTurn, IngestInput, ParseInput, RagAnswer } from './rag.interface.js';

/** Client for the internal Python RAG service. It trusts us, so permissions are checked before these calls. */
@Injectable()
export class RagService {
  // shortcut: undici's default 300s headers timeout caps one parse/ingest call; move ingest to a queue (@nestjs/bullmq) for huge files.
  private async call<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(env.RAG_URL + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-internal-token': env.RAG_INTERNAL_TOKEN },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = `RAG ${res.status}: ${await res.text()}`;
      // 400 = the document itself is bad (format, empty...), not an outage
      throw res.status === 400 ? new BadRequestException(detail) : new BadGatewayException(detail);
    }
    return (await res.json()) as T;
  }

  /** Extract + chunk a file without embedding it. */
  parse(input: ParseInput) {
    return this.call<{ chunks: string[] }>('/parse', 'POST', input);
  }

  /** Embed exactly these chunks, replacing any earlier vectors of the document. */
  ingest({ docId, name, chunks }: IngestInput) {
    return this.call<{ chunks: number }>('/ingest', 'POST', { doc_id: docId, name, chunks });
  }

  async delete(docId: string) {
    await this.call(`/documents/${encodeURIComponent(docId)}`, 'DELETE');
  }

  ask(question: string, history: ChatTurn[]) {
    return this.call<RagAnswer>('/ask', 'POST', { question, history });
  }
}
