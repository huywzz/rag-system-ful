import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client.js';
import type { ChatTurn } from '../../../shared/rag/rag.interface.js';

@Injectable()
export class ConversationRepository {
  constructor(private readonly db: PrismaClient) {}

  listByUser(userId: string) {
    return this.db.conversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  /** null when it doesn't exist or belongs to someone else */
  findOwned(userId: string, id: string) {
    return this.db.conversation.findFirst({ where: { id, userId } });
  }

  create(userId: string, title: string) {
    return this.db.conversation.create({ data: { userId, title } });
  }

  messages(conversationId: string) {
    return this.db.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  }

  /** last `limit` turns, oldest first */
  async recentTurns(conversationId: string, limit: number): Promise<ChatTurn[]> {
    const rows = await this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });
    return rows.reverse() as ChatTurn[]; // role column only ever holds 'user' | 'assistant'
  }

  /** question + answer saved together, or not at all */
  async appendExchange(conversationId: string, question: string, answer: string, sources: string[]) {
    await this.db.$transaction([
      this.db.message.create({ data: { conversationId, role: 'user', content: question } }),
      this.db.message.create({ data: { conversationId, role: 'assistant', content: answer, sources } }),
      this.db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
  }

  async delete(id: string) {
    await this.db.conversation.delete({ where: { id } });
  }
}
