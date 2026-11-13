import type { DocumentStatus } from '../../../generated/prisma/client.js';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt']; // what the RAG service can parse
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_CHUNK_CHARS = 20_000;

/** A background job owns the document in these states; other actions must wait. */
export const BUSY_STATUSES: DocumentStatus[] = ['parsing', 'indexing'];
/** Parsing can (re)start only from here: right after the upload, or after a failed parse. */
export const PARSABLE_STATUSES: DocumentStatus[] = ['uploading', 'failed'];
