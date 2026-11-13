import { IsString, MaxLength } from 'class-validator';
import { MAX_CHUNK_CHARS } from '../constants/document.constants.js';

export class UpdateChunkDto {
  /** empty = drop this chunk from the embedding */
  @IsString()
  @MaxLength(MAX_CHUNK_CHARS)
  content!: string;
}
