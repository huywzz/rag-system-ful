import { Injectable, NotFoundException } from '@nestjs/common';
import { HISTORY_TURNS, TITLE_MAX_LENGTH } from '../constants/chat.constants.js';
import { ConversationRepository } from '../repositories/conversation.repository.js';
import { RagService } from '../../../shared/rag/rag.service.js';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly rag: RagService,
  ) {}

  list(userId: string) {
    return this.conversations.listByUser(userId);
  }

  async messages(userId: string, id: string) {
    await this.own(userId, id);
    return this.conversations.messages(id);
  }

  async ask(userId: string, question: string, conversationId?: string) {
    const conv = conversationId
      ? await this.own(userId, conversationId)
      : await this.conversations.create(userId, question.slice(0, TITLE_MAX_LENGTH));

    const history = await this.conversations.recentTurns(conv.id, HISTORY_TURNS);
    const { answer, sources } = await this.rag.ask(question, history);
    // saved only after the answer arrives, so a failed question leaves no half turn behind
    await this.conversations.appendExchange(conv.id, question, answer, sources);
    return { conversationId: conv.id, answer, sources };
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.conversations.delete(id);
  }

  /** Conversations are private: someone else's id is reported as not found. */
  private async own(userId: string, id: string) {
    const conv = await this.conversations.findOwned(userId, id);
    if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    return conv;
  }
}
