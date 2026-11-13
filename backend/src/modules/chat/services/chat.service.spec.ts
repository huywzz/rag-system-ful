import { NotFoundException } from '@nestjs/common';
import type { ConversationRepository } from '../repositories/conversation.repository.js';
import { ChatService } from './chat.service.js';
import type { RagService } from '../../../shared/rag/rag.service.js';

const conv = { id: 'c1', title: 't', userId: 'u1', createdAt: new Date(), updatedAt: new Date() };

function setup(owned: typeof conv | null = conv) {
  const repo = {
    findOwned: vi.fn().mockResolvedValue(owned),
    create: vi.fn().mockResolvedValue({ ...conv, id: 'new' }),
    messages: vi.fn().mockResolvedValue([]),
    recentTurns: vi.fn().mockResolvedValue([{ role: 'user', content: 'trước' }]),
    appendExchange: vi.fn(),
    delete: vi.fn(),
  };
  const rag = { ask: vi.fn().mockResolvedValue({ answer: 'đáp', sources: ['a.pdf'] }) };
  const svc = new ChatService(repo as unknown as ConversationRepository, rag as unknown as RagService);
  return { repo, rag, svc };
}

describe('ChatService', () => {
  it('starts a conversation titled by the question and saves the exchange', async () => {
    const { repo, rag, svc } = setup();
    const out = await svc.ask('u1', 'Nghỉ phép bao nhiêu ngày?');
    expect(repo.create).toHaveBeenCalledWith('u1', 'Nghỉ phép bao nhiêu ngày?');
    expect(rag.ask).toHaveBeenCalledWith('Nghỉ phép bao nhiêu ngày?', [{ role: 'user', content: 'trước' }]);
    expect(repo.appendExchange).toHaveBeenCalledWith('new', 'Nghỉ phép bao nhiêu ngày?', 'đáp', ['a.pdf']);
    expect(out).toEqual({ conversationId: 'new', answer: 'đáp', sources: ['a.pdf'] });
  });

  it('saves nothing when the RAG service fails', async () => {
    const { repo, rag, svc } = setup();
    rag.ask.mockRejectedValue(new Error('down'));
    await expect(svc.ask('u1', 'q', 'c1')).rejects.toThrow('down');
    expect(repo.appendExchange).not.toHaveBeenCalled();
  });

  it("hides someone else's conversation as not found", async () => {
    const { repo, rag, svc } = setup(null);
    await expect(svc.ask('u2', 'q', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.messages('u2', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.remove('u2', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    expect(rag.ask).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
