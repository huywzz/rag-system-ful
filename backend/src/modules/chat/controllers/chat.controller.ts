import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AskDto } from '../dto/ask.dto.js';
import { ChatService } from '../services/chat.service.js';

@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Session() s: UserSession) {
    return this.chat.list(s.user.id);
  }

  @Get(':id/messages')
  messages(@Session() s: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.messages(s.user.id, id);
  }

  @Post('ask')
  @HttpCode(200)
  ask(@Session() s: UserSession, @Body() dto: AskDto) {
    return this.chat.ask(s.user.id, dto.question, dto.conversationId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Session() s: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.remove(s.user.id, id);
  }
}
