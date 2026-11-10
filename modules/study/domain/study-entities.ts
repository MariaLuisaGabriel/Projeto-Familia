/**
 * modules/study/domain
 * Responsável por (§4.1): Disciplinas (Subject), tópicos (Topic), itens de estudo (StudyItem),
 * metas (Goal) e execução determinística de geradores de cronograma.
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import {
  type WorkspaceScopedEntity,
  type ISODateTimeUTC,
  type UUIDv7,
  createBaseEntityFields,
  DomainError,
} from '@estudos/core';
import { GeneratorRegistry, type GeneratorParams } from '@estudos/registries';

export interface Subject extends WorkspaceScopedEntity {
  readonly key: string;
  readonly title: string;
  readonly color: string;
  readonly custom_fields: Readonly<Record<string, unknown>>;
}

export interface Topic extends WorkspaceScopedEntity {
  readonly subject_id: UUIDv7;
  readonly key: string;
  readonly title: string;
  readonly weight: number;
  readonly custom_fields: Readonly<Record<string, unknown>>;
}

export type StudyItemStatus = 'pending' | 'done';

export interface StudyItem extends WorkspaceScopedEntity {
  readonly item_type_key: string;
  readonly topic_id: UUIDv7 | null;
  readonly title: string;
  readonly scheduled_date: string; // YYYY-MM-DD
  readonly status: StudyItemStatus;
  readonly completed_at: ISODateTimeUTC | null;
  readonly custom_fields: Readonly<Record<string, unknown>>;
}

export interface Goal extends WorkspaceScopedEntity {
  readonly title: string;
  readonly metric: 'hours' | 'questions' | 'items_completed';
  readonly target_value: number;
  readonly period_end_at: ISODateTimeUTC | null;
}

export function createSubjectEntity(params: {
  workspace_id: UUIDv7;
  key: string;
  title: string;
  color?: string;
}): Subject {
  const base = createBaseEntityFields(params.workspace_id);
  return {
    ...base,
    key: params.key,
    title: params.title.trim(),
    color: params.color ?? '#3B5249',
    custom_fields: Object.freeze({}),
  };
}

export function createTopicEntity(params: {
  workspace_id: UUIDv7;
  subject_id: UUIDv7;
  key: string;
  title: string;
  weight?: number;
}): Topic {
  const base = createBaseEntityFields(params.workspace_id);
  return {
    ...base,
    subject_id: params.subject_id,
    key: params.key,
    title: params.title.trim(),
    weight: params.weight ?? 1,
    custom_fields: Object.freeze({}),
  };
}

export function createStudyItemEntity(params: {
  workspace_id: UUIDv7;
  item_type_key: string;
  topic_id?: UUIDv7 | null;
  title: string;
  scheduled_date: string;
  status?: StudyItemStatus;
  custom_fields?: Record<string, unknown>;
  created_by_rule_id?: string | null;
}): StudyItem {
  if (!params.title.trim()) {
    throw new DomainError('STUDY_ITEM_TITLE_REQUIRED', 'Item de estudo exige título.');
  }
  const base = createBaseEntityFields(params.workspace_id, {
    created_by_rule_id: params.created_by_rule_id ?? null,
  });
  const status = params.status ?? 'pending';
  return {
    ...base,
    item_type_key: params.item_type_key,
    topic_id: params.topic_id ?? null,
    title: params.title.trim(),
    scheduled_date: params.scheduled_date,
    status,
    completed_at: status === 'done' ? base.created_at : null,
    custom_fields: Object.freeze({ ...(params.custom_fields ?? {}) }),
  };
}

/**
 * R-24: Execução determinística de um gerador do catálogo sobre a árvore de tópicos.
 */
export function buildStudyScheduleFromGenerator(params: {
  workspace_id: UUIDv7;
  generatorKind: string;
  topics: readonly Topic[];
  generatorParams: GeneratorParams;
  created_by_rule_id?: string | null;
}): readonly StudyItem[] {
  const generator = GeneratorRegistry.getOrThrow(params.generatorKind);
  const slots = generator.generate(
    params.topics.map((t) => ({
      id: t.id,
      subjectId: t.subject_id,
      title: t.title,
      weight: t.weight,
    })),
    params.generatorParams
  );

  return slots.map((slot) =>
    createStudyItemEntity({
      workspace_id: params.workspace_id,
      item_type_key: slot.itemTypeKey,
      topic_id: slot.topicId,
      title: slot.topicTitle,
      scheduled_date: slot.scheduledDateISO,
      created_by_rule_id: params.created_by_rule_id ?? null,
    })
  );
}
