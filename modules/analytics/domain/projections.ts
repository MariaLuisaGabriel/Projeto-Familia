/**
 * modules/analytics/domain
 * Responsável por (§4.1, §4.3): Projeções e agregações para widgets e relatórios.
 * Consome apenas eventos de domínio dos demais módulos, nunca suas interfaces de escrita.
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import type { DomainEvent, UUIDv7 } from '@estudos/core';

export interface WorkspaceAnalyticsProjection {
  readonly workspace_id: UUIDv7;
  readonly completed_items_count: number;
  readonly events_by_type: Readonly<Record<string, number>>;
  readonly attempts_by_topic: Readonly<
    Record<string, { readonly total: number; readonly correct: number; readonly accuracy: number }>
  >;
  readonly processed_event_ids: readonly UUIDv7[]; // R-28: garante idempotência
}

export function createInitialProjection(workspaceId: UUIDv7): WorkspaceAnalyticsProjection {
  return {
    workspace_id: workspaceId,
    completed_items_count: 0,
    events_by_type: Object.freeze({}),
    attempts_by_topic: Object.freeze({}),
    processed_event_ids: [],
  };
}

/**
 * R-28: Handler idempotente — aplicar o mesmo DomainEvent duas vezes não altera a projeção.
 */
export function applyDomainEventToProjection(
  projection: WorkspaceAnalyticsProjection,
  event: DomainEvent
): WorkspaceAnalyticsProjection {
  if (event.workspace_id !== projection.workspace_id) {
    return projection;
  }
  if (projection.processed_event_ids.includes(event.id)) {
    return projection;
  }

  const nextProcessed = [...projection.processed_event_ids, event.id];

  if (event.type === 'EventCreated.v1') {
    const typeKey = String(event.payload.eventTypeKey ?? 'default');
    const prevCount = projection.events_by_type[typeKey] ?? 0;
    return {
      ...projection,
      events_by_type: Object.freeze({
        ...projection.events_by_type,
        [typeKey]: prevCount + 1,
      }),
      processed_event_ids: nextProcessed,
    };
  }

  if (event.type === 'StudyItemCompleted.v1') {
    return {
      ...projection,
      completed_items_count: projection.completed_items_count + 1,
      processed_event_ids: nextProcessed,
    };
  }

  if (event.type === 'AttemptRegistered.v1') {
    const topicId = String(event.payload.topicId ?? 'geral');
    const isCorrect = Boolean(event.payload.isCorrect);
    const prev = projection.attempts_by_topic[topicId] ?? { total: 0, correct: 0, accuracy: 0 };
    const total = prev.total + 1;
    const correct = prev.correct + (isCorrect ? 1 : 0);
    return {
      ...projection,
      attempts_by_topic: Object.freeze({
        ...projection.attempts_by_topic,
        [topicId]: {
          total,
          correct,
          accuracy: Number((correct / total).toFixed(2)),
        },
      }),
      processed_event_ids: nextProcessed,
    };
  }

  return {
    ...projection,
    processed_event_ids: nextProcessed,
  };
}
