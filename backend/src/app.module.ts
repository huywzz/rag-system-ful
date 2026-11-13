import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';

@Module({ imports: [CoreModule, DocumentsModule, ChatModule] })
export class AppModule {}
