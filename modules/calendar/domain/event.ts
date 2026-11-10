/**
 * modules/calendar/domain
 * Responsável por (§4.1): Eventos, recorrência (RRULE RFC 5545 + exceções — ADR-0008),
 * bloqueios de período e exportação .ics.
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import {
  type WorkspaceScopedEntity,
  type ISODateTimeUTC,
  type UUIDv7,
  createBaseEntityFields,
  DomainError,
} from '@estudos/core';
import { FieldTypeRegistry } from '@estudos/registries';
import type { TemplateEventTypeDefinition } from '@estudos/template-schema';

export interface CalendarEvent extends WorkspaceScopedEntity {
  readonly event_type_key: string;
  readonly title: string;
  readonly start_at: ISODateTimeUTC;
  readonly end_at: ISODateTimeUTC;
  readonly rrule: string | null; // Ex: "FREQ=WEEKLY;COUNT=4" (ADR-0008)
  readonly rrule_exceptions: readonly string[]; // Datas ISO excluídas da recorrência
  readonly is_blocked_period: boolean;
  readonly custom_fields: Readonly<Record<string, unknown>>; // R-36
}

/**
 * R-36: Campos customizados DEVEM ser validados no servidor contra o schema do tipo
 * no FieldTypeRegistry antes de qualquer escrita.
 */
export function validateEventCustomFields(
  eventTypeDef: TemplateEventTypeDefinition,
  customFields: Record<string, unknown>
): void {
  for (const fieldDef of eventTypeDef.fields) {
    const typeEntry = FieldTypeRegistry.getOrThrow(fieldDef.type);
    const val = customFields[fieldDef.key];
    if (fieldDef.required && (val === undefined || val === null || val === '')) {
      throw new DomainError(
        'CUSTOM_FIELD_REQUIRED',
        `Campo obrigatório "${fieldDef.label ?? fieldDef.key}" não informado (R-36).`
      );
    }
    const check = typeEntry.validateValue(fieldDef as Record<string, unknown>, val);
    if (!check.valid) {
      throw new DomainError(
        'CUSTOM_FIELD_INVALID',
        `Campo "${fieldDef.key}" inválido (R-36): ${check.errors.join(', ')}`
      );
    }
  }
}

export function createCalendarEventEntity(params: {
  workspace_id: UUIDv7;
  event_type_key: string;
  title: string;
  start_at: ISODateTimeUTC;
  end_at?: ISODateTimeUTC;
  defaultDurationMin?: number;
  rrule?: string | null;
  rrule_exceptions?: readonly string[];
  is_blocked_period?: boolean;
  custom_fields?: Record<string, unknown>;
  created_by_rule_id?: string | null;
}): CalendarEvent {
  const startMs = Date.parse(params.start_at);
  if (Number.isNaN(startMs)) {
    throw new DomainError('INVALID_START_DATE', 'Data de início inválida.');
  }
  const durationMin = params.defaultDurationMin ?? 60;
  const computedEnd =
    params.end_at ?? new Date(startMs + durationMin * 60 * 1000).toISOString();

  const base = createBaseEntityFields(params.workspace_id, {
    created_by_rule_id: params.created_by_rule_id ?? null,
  });

  return {
    ...base,
    event_type_key: params.event_type_key,
    title: params.title.trim() || params.event_type_key,
    start_at: new Date(startMs).toISOString(),
    end_at: computedEnd,
    rrule: params.rrule ?? null,
    rrule_exceptions: [...(params.rrule_exceptions ?? [])],
    is_blocked_period: params.is_blocked_period ?? false,
    custom_fields: Object.freeze({ ...(params.custom_fields ?? {}) }),
  };
}

/**
 * Exportação para formato iCalendar (.ics — RFC 5545) (§4.1, §17 Fase 3).
 */
export function exportEventsToIcs(workspaceName: string, events: readonly CalendarEvent[]): string {
  const formatIcsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Plataforma de Estudos//${workspaceName}//PT-BR`,
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    if (ev.deleted_at !== null) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@estudos.local`);
    lines.push(`DTSTAMP:${formatIcsDate(ev.created_at)}`);
    lines.push(`DTSTART:${formatIcsDate(ev.start_at)}`);
    lines.push(`DTEND:${formatIcsDate(ev.end_at)}`);
    lines.push(`SUMMARY:${ev.title}`);
    if (ev.rrule) {
      lines.push(`RRULE:${ev.rrule}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
