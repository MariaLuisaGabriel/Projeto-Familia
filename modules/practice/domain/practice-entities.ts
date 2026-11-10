/**
 * modules/practice/domain
 * Responsável por (§4.1): Questões (Question), tentativas (Attempt), cartões (Card),
 * histórico de revisão (ReviewLog) e agendamento FSRS (ADR-0007).
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import {
  type WorkspaceScopedEntity,
  type ISODateTimeUTC,
  type UUIDv7,
  createBaseEntityFields,
} from '@estudos/core';

export interface Question extends WorkspaceScopedEntity {
  readonly topic_id: UUIDv7;
  readonly prompt: string;
  readonly custom_fields: Readonly<Record<string, unknown>>;
}

export interface Attempt extends WorkspaceScopedEntity {
  readonly question_id: UUIDv7;
  readonly topic_id: UUIDv7;
  readonly is_correct: boolean;
  readonly time_spent_sec: number;
}

export type FsrsRating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export interface Card extends WorkspaceScopedEntity {
  readonly topic_id: UUIDv7;
  readonly front: string;
  readonly back: string;
  readonly stability: number; // S (dias)
  readonly difficulty: number; // D (1..10)
  readonly due_at: ISODateTimeUTC;
  readonly reps: number;
  readonly lapses: number;
}

export interface ReviewLog extends WorkspaceScopedEntity {
  readonly card_id: UUIDv7;
  readonly rating: FsrsRating;
  readonly elapsed_days: number;
  readonly scheduled_days: number;
}

/**
 * Algoritmo FSRS simplificado e determinístico (ADR-0007) para cálculo de estabilidade (S),
 * dificuldade (D) e próximo intervalo de revisão.
 */
export function scheduleNextFsrsReview(
  card: Card,
  rating: FsrsRating,
  nowISO: ISODateTimeUTC = new Date().toISOString()
): { updatedCard: Card; reviewLog: ReviewLog } {
  const nowMs = Date.parse(nowISO);
  const prevDueMs = Date.parse(card.due_at);
  const elapsedDays = Math.max(0, Math.round((nowMs - prevDueMs) / (1000 * 60 * 60 * 24)));

  // Atualização de dificuldade D entre 1.0 e 10.0
  const deltaD = (3 - rating) * 0.85;
  const nextDifficulty = Math.min(10, Math.max(1, Number((card.difficulty + deltaD).toFixed(2))));

  // Atualização de estabilidade S
  let nextStability: number;
  if (card.reps === 0) {
    const initialStabilities: Record<FsrsRating, number> = { 1: 0.5, 2: 1.5, 3: 3.0, 4: 7.0 };
    nextStability = initialStabilities[rating];
  } else if (rating === 1) {
    nextStability = Math.max(0.5, Number((card.stability * 0.35).toFixed(2)));
  } else {
    const multiplier = rating === 2 ? 1.25 : rating === 3 ? 2.1 : 3.1;
    nextStability = Number((card.stability * multiplier * (11 - nextDifficulty) / 6).toFixed(2));
  }

  const scheduledDays = Math.max(1, Math.round(nextStability));
  const nextDueISO = new Date(nowMs + scheduledDays * 24 * 60 * 60 * 1000).toISOString();

  const updatedCard: Card = {
    ...card,
    stability: nextStability,
    difficulty: nextDifficulty,
    due_at: nextDueISO,
    reps: card.reps + 1,
    lapses: rating === 1 ? card.lapses + 1 : card.lapses,
    updated_at: nowISO,
  };

  const reviewLog: ReviewLog = {
    ...createBaseEntityFields(card.workspace_id, { created_at: nowISO, updated_at: nowISO }),
    card_id: card.id,
    rating,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
  };

  return { updatedCard, reviewLog };
}

export function createCardEntity(params: {
  workspace_id: UUIDv7;
  topic_id: UUIDv7;
  front: string;
  back: string;
}): Card {
  const base = createBaseEntityFields(params.workspace_id);
  return {
    ...base,
    topic_id: params.topic_id,
    front: params.front.trim(),
    back: params.back.trim(),
    stability: 1.0,
    difficulty: 5.0,
    due_at: base.created_at,
    reps: 0,
    lapses: 0,
  };
}
