import { SUPPORTED_EXTENSIONS } from '../constants/document.constants.js';

/** Drop any directory part, so a storage key can't escape its "<id>/" prefix. */
export const baseName = (name: string) => name.trim().split(/[\\/]/).pop() ?? '';

export const hasSupportedExtension = (name: string) =>
  SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

/** id prefix: two uploads with the same file name never collide */
export const storageKey = (documentId: string, name: string) => `${documentId}/${name}`;
