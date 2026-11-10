/**
 * modules/study/adapters
 */
import type { DomainEvent, UUIDv7 } from '@estudos/core';
import type { Subject, Topic, StudyItem } from '../domain/study-entities.ts';
import type { StudyRepositoryPort } from '../application/study-service.ts';

export class InMemoryStudyRepository implements StudyRepositoryPort {
  private readonly subjects = new Map<string, Subject>();
  private readonly topics = new Map<string, Topic>();
  private readonly items = new Map<string, StudyItem>();
  private readonly onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>;

  constructor(onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>) {
    this.onOutboxEvent = onOutboxEvent;
  }

  public async saveSubjectsAndTopics(
    workspaceId: UUIDv7,
    subjects: readonly Subject[],
    topics: readonly Topic[]
  ): Promise<void> {
    for (const s of subjects) {
      this.subjects.set(`${workspaceId}:${s.id}`, s);
    }
    for (const t of topics) {
      this.topics.set(`${workspaceId}:${t.id}`, t);
    }
  }

  public async listSubjects(workspaceId: UUIDv7): Promise<readonly Subject[]> {
    return Array.from(this.subjects.values()).filter(
      (s) => s.workspace_id === workspaceId && s.deleted_at === null
    );
  }

  public async listTopics(workspaceId: UUIDv7): Promise<readonly Topic[]> {
    return Array.from(this.topics.values()).filter(
      (t) => t.workspace_id === workspaceId && t.deleted_at === null
    );
  }

  public async saveStudyItems(
    workspaceId: UUIDv7,
    items: readonly StudyItem[],
    outboxEvent?: DomainEvent
  ): Promise<void> {
    for (const it of items) {
      if (it.workspace_id !== workspaceId) {
        throw new Error('Violação de isolamento de workspace em StudyRepository (R-35).');
      }
      this.items.set(`${workspaceId}:${it.id}`, it);
    }
    if (outboxEvent && this.onOutboxEvent) {
      await this.onOutboxEvent(workspaceId, outboxEvent);
    }
  }

  public async listStudyItems(workspaceId: UUIDv7): Promise<readonly StudyItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.workspace_id === workspaceId && i.deleted_at === null)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }

  public async findStudyItemById(workspaceId: UUIDv7, itemId: UUIDv7): Promise<StudyItem | null> {
    const found = this.items.get(`${workspaceId}:${itemId}`);
    return found && found.deleted_at === null ? found : null;
  }
}
