export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ParseInput {
  name: string; // file name; its extension picks the parser
  key?: string; // object key in storage, or
  url?: string; // a web page
}

export interface IngestInput {
  docId: string;
  name: string; // citation source shown with answers
  chunks: string[]; // embedded as-is; blank ones are dropped
}

export interface RagAnswer {
  answer: string;
  sources: string[];
}
