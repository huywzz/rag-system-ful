import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module.js';
import { ChatController } from './controllers/chat.controller.js';
import { ConversationRepository } from './repositories/conversation.repository.js';
import { ChatService } from './services/chat.service.js';

@Module({
  imports: [SharedModule],
  controllers: [ChatController],
  providers: [ChatService, ConversationRepository],
})
export class ChatModule {}
