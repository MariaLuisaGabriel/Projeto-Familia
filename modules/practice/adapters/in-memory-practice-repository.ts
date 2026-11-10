/**
 * modules/practice/adapters
 */
import type { DomainEvent, UUIDv7 } from '@estudos/core';
import type { Attempt, Card, ReviewLog } from '../domain/practice-entities.ts';
import type { PracticeRepositoryPort } from '../application/practice-service.ts';

export class InMemoryPracticeRepository implements PracticeRepositoryPort {
  private readonly attempts = new Map<string, Attempt>();
  private readonly cards = new Map<string, Card>();
  private readonly logs = new Map<string, ReviewLog>();
  private readonly onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>;

  constructor(onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>) {
    this.onOutboxEvent = onOutboxEvent;
  }

  public async saveAttempt(
    workspaceId: UUIDv7,
    attempt: Attempt,
    outboxEvent: DomainEvent
  ): Promise<void> {
    if (attempt.workspace_id !== workspaceId) {
      throw new Error('Violação de isolamento em PracticeRepository (R-35).');
    }
    this.attempts.set(`${workspaceId}:${attempt.id}`, attempt);
    if (this.onOutboxEvent) {
      await this.onOutboxEvent(workspaceId, outboxEvent);
    }
  }

  public async listAttempts(workspaceId: UUIDv7): Promise<readonly Attempt[]> {
    return Array.from(this.attempts.values()).filter(
      (a) => a.workspace_id === workspaceId && a.deleted_at === null
    );
  }

  public async saveCard(workspaceId: UUIDv7, card: Card, reviewLog?: ReviewLog): Promise<void> {
    this.cards.set(`${workspaceId}:${card.id}`, card);
    if (reviewLog) {
      this.logs.set(`${workspaceId}:${reviewLog.id}`, reviewLog);
    }
  }

  public async listCards(workspaceId: UUIDv7): Promise<readonly Card[]> {
    return Array.from(this.cards.values()).filter(
      (c) => c.workspace_id === workspaceId && c.deleted_at === null
    );
  }

  public async findCardById(workspaceId: UUIDv7, cardId: UUIDv7): Promise<Card | null> {
    return this.cards.get(`${workspaceId}:${cardId}`) ?? null;
  }
}
