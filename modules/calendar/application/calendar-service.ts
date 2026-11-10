/**
 * modules/calendar/application
 * Casos de uso de criação de eventos, bloqueio de períodos por regras e exportação .ics.
 */
import {
  type ActorContext,
  type DomainEvent,
  type UUIDv7,
  assertAuthorized,
  createDomainEvent,
  DomainError,
} from '@estudos/core';
import type { Workspace } from '@estudos/workspaces';
import {
  type CalendarEvent,
  createCalendarEventEntity,
  validateEventCustomFields,
  exportEventsToIcs,
} from '../domain/event.ts';

export interface CalendarRepositoryPort {
  saveEvent(workspaceId: UUIDv7, event: CalendarEvent, outboxEvent?: DomainEvent): Promise<void>;
  listEvents(workspaceId: UUIDv7): Promise<readonly CalendarEvent[]>;
  softDeleteEvent(workspaceId: UUIDv7, eventId: UUIDv7, deletedAtISO: string): Promise<void>;
}

export class CalendarService {
  private readonly repo: CalendarRepositoryPort;

  constructor(repo: CalendarRepositoryPort) {
    this.repo = repo;
  }

  public async scheduleEvent(
    actor: ActorContext,
    workspace: Workspace,
    input: {
      event_type_key: string;
      title: string;
      start_at: string;
      end_at?: string;
      rrule?: string | null;
      custom_fields?: Record<string, unknown>;
      created_by_rule_id?: string | null;
      causation_id?: UUIDv7;
      correlation_id?: UUIDv7;
      depth?: number;
    }
  ): Promise<{ event: CalendarEvent; domainEvent: DomainEvent }> {
    assertAuthorized(actor, 'editor', workspace.id);

    const eventTypeDef = workspace.metadata.eventTypes.find(
      (et) => et.key === input.event_type_key && !et.archived_at
    );
    if (!eventTypeDef) {
      throw new DomainError(
        'UNKNOWN_EVENT_TYPE',
        `Tipo de evento "${input.event_type_key}" não existe ou está arquivado no workspace.`
      );
    }

    const customFields = input.custom_fields ?? {};
    validateEventCustomFields(eventTypeDef, customFields);

    const event = createCalendarEventEntity({
      workspace_id: workspace.id,
      event_type_key: input.event_type_key,
      title: input.title,
      start_at: input.start_at,
      end_at: input.end_at,
      defaultDurationMin: eventTypeDef.defaultDurationMin,
      rrule: input.rrule,
      custom_fields: customFields,
      created_by_rule_id: input.created_by_rule_id ?? null,
    });

    const domainEvent = createDomainEvent({
      type: 'EventCreated.v1',
      workspace_id: workspace.id,
      causation_id: input.causation_id,
      correlation_id: input.correlation_id,
      depth: input.depth ?? 0,
      payload: {
        eventId: event.id,
        eventTypeKey: event.event_type_key,
        startAt: event.start_at,
        endAt: event.end_at,
        customFields: event.custom_fields,
      },
    });

    await this.repo.saveEvent(workspace.id, event, domainEvent);
    return { event, domainEvent };
  }

  /**
   * Usado pela ação de regra `block-period` (R-07, R-31).
   */
  public async createBlockedPeriodFromRule(params: {
    workspace_id: UUIDv7;
    title: string;
    start_at: string;
    durationHours: number;
    rule_id: string;
    causation_id: UUIDv7;
    correlation_id: UUIDv7;
    depth: number;
  }): Promise<CalendarEvent> {
    const event = createCalendarEventEntity({
      workspace_id: params.workspace_id,
      event_type_key: 'bloqueio-descanso',
      title: params.title,
      start_at: params.start_at,
      defaultDurationMin: params.durationHours * 60,
      is_blocked_period: true,
      created_by_rule_id: params.rule_id,
    });
    await this.repo.saveEvent(params.workspace_id, event);
    return event;
  }

  public async listWorkspaceEvents(actor: ActorContext): Promise<readonly CalendarEvent[]> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    return this.repo.listEvents(actor.workspace_id);
  }

  public async exportIcs(actor: ActorContext, workspaceName: string): Promise<string> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    const events = await this.repo.listEvents(actor.workspace_id);
    return exportEventsToIcs(workspaceName, events);
  }
}
