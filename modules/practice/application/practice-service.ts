/**
 * modules/practice/application
 * Casos de uso de registro de tentativas (emite AttemptRegistered.v1 — R-08, R-09) e revisão FSRS.
 */
import {
  type ActorContext,
  type DomainEvent,
  type UUIDv7,
  assertAuthorized,
  createBaseEntityFields,
  createDomainEvent,
  DomainError,
} from '@estudos/core';
import {
  type Attempt,
  type Card,
  type FsrsRating,
  type ReviewLog,
  createCardEntity,
  scheduleNextFsrsReview,
} from '../domain/practice-entities.ts';

export interface PracticeRepositoryPort {
  saveAttempt(workspaceId: UUIDv7, attempt: Attempt, outboxEvent: DomainEvent): Promise<void>;
  listAttempts(workspaceId: UUIDv7): Promise<readonly Attempt[]>;
  saveCard(workspaceId: UUIDv7, card: Card, reviewLog?: ReviewLog): Promise<void>;
  listCards(workspaceId: UUIDv7): Promise<readonly Card[]>;
  findCardById(workspaceId: UUIDv7, cardId: UUIDv7): Promise<Card | null>;
}

export class PracticeService {
  private readonly repo: PracticeRepositoryPort;

  constructor(repo: PracticeRepositoryPort) {
    this.repo = repo;
  }

  public async registerAttempt(
    actor: ActorContext,
    input: {
      question_id: UUIDv7;
      topic_id: UUIDv7;
      is_correct: boolean;
      time_spent_sec?: number;
    }
  ): Promise<{ attempt: Attempt; domainEvent: DomainEvent }> {
    assertAuthorized(actor, 'editor', actor.workspace_id);

    const attempt: Attempt = {
      ...createBaseEntityFields(actor.workspace_id),
      question_id: input.question_id,
      topic_id: input.topic_id,
      is_correct: input.is_correct,
      time_spent_sec: input.time_spent_sec ?? 60,
    };

    const allAttempts = await this.repo.listAttempts(actor.workspace_id);
    const topicAttempts = [...allAttempts.filter((a) => a.topic_id === input.topic_id), attempt];
    const correctCount = topicAttempts.filter((a) => a.is_correct).length;
    const accuracyRate = correctCount / topicAttempts.length;

    // R-08, R-09: Efeitos colaterais em outros módulos acontecem via evento versionado AttemptRegistered.v1
    const domainEvent = createDomainEvent({
      type: 'AttemptRegistered.v1',
      workspace_id: actor.workspace_id,
      payload: {
        attemptId: attempt.id,
        questionId: attempt.question_id,
        topicId: attempt.topic_id,
        isCorrect: attempt.is_correct,
        accuracyRate,
        totalTopicAttempts: topicAttempts.length,
      },
    });

    await this.repo.saveAttempt(actor.workspace_id, attempt, domainEvent);
    return { attempt, domainEvent };
  }

  public async createFlashcard(
    actor: ActorContext,
    input: { topic_id: UUIDv7; front: string; back: string }
  ): Promise<Card> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const card = createCardEntity({
      workspace_id: actor.workspace_id,
      ...input,
    });
    await this.repo.saveCard(actor.workspace_id, card);
    return card;
  }

  public async reviewFlashcard(
    actor: ActorContext,
    cardId: UUIDv7,
    rating: FsrsRating
  ): Promise<{ updatedCard: Card; reviewLog: ReviewLog }> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const card = await this.repo.findCardById(actor.workspace_id, cardId);
    if (!card) {
      throw new DomainError('CARD_NOT_FOUND', 'Cartão FSRS não encontrado.');
    }
    const result = scheduleNextFsrsReview(card, rating);
    await this.repo.saveCard(actor.workspace_id, result.updatedCard, result.reviewLog);
    return result;
  }

  public async listPracticeState(actor: ActorContext): Promise<{
    attempts: readonly Attempt[];
    cards: readonly Card[];
  }> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    const [attempts, cards] = await Promise.all([
      this.repo.listAttempts(actor.workspace_id),
      this.repo.listCards(actor.workspace_id),
    ]);
    return { attempts, cards };
  }
}
