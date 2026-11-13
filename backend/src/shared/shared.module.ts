import { Module } from '@nestjs/common';
import { RagService } from './rag/rag.service.js';
import { StorageService } from './storage/storage.service.js';

/** Reusable clients; feature modules import this to inject them. */
@Module({ providers: [RagService, StorageService], exports: [RagService, StorageService] })
export class SharedModule {}
