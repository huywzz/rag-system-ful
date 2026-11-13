import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module.js';
import { DocumentsController } from './controllers/documents.controller.js';
import { DocumentRepository } from './repositories/document.repository.js';
import { DocumentsService } from './services/documents.service.js';

@Module({
  imports: [SharedModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentRepository],
})
export class DocumentsModule {}
