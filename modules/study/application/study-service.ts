/**
 * modules/study/application
 * Casos de uso de semeadura da taxonomia inicial do template, geração de cronograma e conclusão de itens.
 */
import {
  type ActorContext,
  type DomainEvent,
  type UUIDv7,
  assertAuthorized,
  createDomainEvent,
  DomainError,
} from '@estudos/core';
import type { GeneratorParams } from '@estudos/registries';
import type { TemplateSubjectSeed } from '@estudos/template-schema';
import {
  type Subject,
  type Topic,
  type StudyItem,
  createSubjectEntity,
  createTopicEntity,
  createStudyItemEntity,
  buildStudyScheduleFromGenerator,
} from '../domain/study-entities.ts';

export interface StudyRepositoryPort {
  saveSubjectsAndTopics(
    workspaceId: UUIDv7,
    subjects: readonly Subject[],
    topics: readonly Topic[]
  ): Promise<void>;
  listSubjects(workspaceId: UUIDv7): Promise<readonly Subject[]>;
  listTopics(workspaceId: UUIDv7): Promise<readonly Topic[]>;
  saveStudyItems(
    workspaceId: UUIDv7,
    items: readonly StudyItem[],
    outboxEvent?: DomainEvent
  ): Promise<void>;
  listStudyItems(workspaceId: UUIDv7): Promise<readonly StudyItem[]>;
  findStudyItemById(workspaceId: UUIDv7, itemId: UUIDv7): Promise<StudyItem | null>;
}

export class StudyService {
  private readonly repo: StudyRepositoryPort;

  constructor(repo: StudyRepositoryPort) {
    this.repo = repo;
  }

  public async seedTaxonomy(
    workspaceId: UUIDv7,
    taxonomy: readonly TemplateSubjectSeed[] = []
  ): Promise<{ subjects: readonly Subject[]; topics: readonly Topic[] }> {
    const subjects: Subject[] = [];
    const topics: Topic[] = [];

    for (const subSeed of taxonomy) {
      const subject = createSubjectEntity({
        workspace_id: workspaceId,
        key: subSeed.key,
        title: subSeed.title,
        color: subSeed.color,
      });
      subjects.push(subject);
      for (const topSeed of subSeed.topics) {
        topics.push(
          createTopicEntity({
            workspace_id: workspaceId,
            subject_id: subject.id,
            key: topSeed.key,
            title: topSeed.title,
            weight: topSeed.weight,
          })
        );
      }
    }

    await this.repo.saveSubjectsAndTopics(workspaceId, subjects, topics);
    return { subjects, topics };
  }

  public async runScheduleGenerator(
    actor: ActorContext,
    params: {
      generatorKind: string;
      generatorParams: GeneratorParams;
      created_by_rule_id?: string | null;
    }
  ): Promise<readonly StudyItem[]> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const topics = await this.repo.listTopics(actor.workspace_id);
    const items = buildStudyScheduleFromGenerator({
      workspace_id: actor.workspace_id,
      generatorKind: params.generatorKind,
      topics,
      generatorParams: params.generatorParams,
      created_by_rule_id: params.created_by_rule_id ?? null,
    });
    await this.repo.saveStudyItems(actor.workspace_id, items);
    return items;
  }

  public async createItem(
    actor: ActorContext,
    input: {
      item_type_key: string;
      topic_id?: UUIDv7 | null;
      title: string;
      scheduled_date: string;
      custom_fields?: Record<string, unknown>;
      created_by_rule_id?: string | null;
    }
  ): Promise<StudyItem> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const item = createStudyItemEntity({
      workspace_id: actor.workspace_id,
      ...input,
    });
    await this.repo.saveStudyItems(actor.workspace_id, [item]);
    return item;
  }

  public async toggleItemCompletion(
    actor: ActorContext,
    itemId: UUIDv7
  ): Promise<{ item: StudyItem; domainEvent?: DomainEvent }> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const existing = await this.repo.findStudyItemById(actor.workspace_id, itemId);
    if (!existing) {
      throw new DomainError('STUDY_ITEM_NOT_FOUND', 'Item de estudo não encontrado.');
    }

    const now = new Date().toISOString();
    const nextStatus = existing.status === 'done' ? 'pending' : 'done';
    const updated: StudyItem = {
      ...existing,
      status: nextStatus,
      completed_at: nextStatus === 'done' ? now : null,
      updated_at: now,
    };

    const domainEvent =
      nextStatus === 'done'
        ? createDomainEvent({
            type: 'StudyItemCompleted.v1',
            workspace_id: actor.workspace_id,
            payload: {
              itemId: updated.id,
              itemTypeKey: updated.item_type_key,
              topicId: updated.topic_id,
            },
          })
        : undefined;

    await this.repo.saveStudyItems(actor.workspace_id, [updated], domainEvent);
    return { item: updated, domainEvent };
  }

  public async getStudyOverview(actor: ActorContext): Promise<{
    subjects: readonly Subject[];
    topics: readonly Topic[];
    items: readonly StudyItem[];
  }> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    const [subjects, topics, items] = await Promise.all([
      this.repo.listSubjects(actor.workspace_id),
      this.repo.listTopics(actor.workspace_id),
      this.repo.listStudyItems(actor.workspace_id),
    ]);
    return { subjects, topics, items };
  }
}
