/**
 * modules/calendar/adapters
 */
import type { DomainEvent, UUIDv7 } from '@estudos/core';
import type { CalendarEvent } from '../domain/event.ts';
import type { CalendarRepositoryPort } from '../application/calendar-service.ts';

export class InMemoryCalendarRepository implements CalendarRepositoryPort {
  private readonly store = new Map<string, CalendarEvent>();
  private readonly onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>;

  constructor(onOutboxEvent?: (workspaceId: UUIDv7, evt: DomainEvent) => Promise<void>) {
    this.onOutboxEvent = onOutboxEvent;
  }

  public async saveEvent(
    workspaceId: UUIDv7,
    event: CalendarEvent,
    outboxEvent?: DomainEvent
  ): Promise<void> {
    if (event.workspace_id !== workspaceId) {
      throw new Error('Violação de isolamento de workspace em CalendarRepository (R-35).');
    }
    this.store.set(`${workspaceId}:${event.id}`, event);
    if (outboxEvent && this.onOutboxEvent) {
      await this.onOutboxEvent(workspaceId, outboxEvent);
    }
  }

  public async listEvents(workspaceId: UUIDv7): Promise<readonly CalendarEvent[]> {
    const items: CalendarEvent[] = [];
    for (const ev of this.store.values()) {
      if (ev.workspace_id === workspaceId && ev.deleted_at === null) {
        items.push(ev);
      }
    }
    return items.sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  public async softDeleteEvent(
    workspaceId: UUIDv7,
    eventId: UUIDv7,
    deletedAtISO: string
  ): Promise<void> {
    const key = `${workspaceId}:${eventId}`;
    const existing = this.store.get(key);
    if (existing && existing.workspace_id === workspaceId) {
      this.store.set(key, {
        ...existing,
        deleted_at: deletedAtISO,
        updated_at: deletedAtISO,
      });
    }
  }
}
