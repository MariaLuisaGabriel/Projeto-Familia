/**
 * modules/workspaces/application
 * Casos de uso de criação de workspace, customização de Camada 1/2 e exportação/importação JSON (R-41).
 */
import {
  type ActorContext,
  type DomainEvent,
  type UUIDv7,
  assertAuthorized,
  createDomainEvent,
  DomainError,
} from '@estudos/core';
import type { StudyTemplateManifest } from '@estudos/template-schema';
import {
  type Workspace,
  type OutboxRecord,
  instantiateWorkspaceFromTemplate,
  archiveWorkspaceEventType,
} from '../domain/workspace.ts';

export interface LegacyCronogramaJson {
  readonly semanas?: readonly {
    readonly numero: number;
    readonly dataInicio?: string;
    readonly topicos?: readonly {
      readonly area?: string;
      readonly tema: string;
      readonly concluido?: boolean;
    }[];
  }[];
  readonly compromissos?: readonly {
    readonly tipo?: string;
    readonly titulo: string;
    readonly data: string;
    readonly local?: string;
    readonly turno?: string;
  }[];
}

export interface WorkspaceExportBundle {
  readonly schemaVersion: '1.0.0';
  readonly exportedAt: string;
  readonly workspace: Workspace;
  readonly data: {
    readonly events: readonly Record<string, unknown>[];
    readonly subjects: readonly Record<string, unknown>[];
    readonly topics: readonly Record<string, unknown>[];
    readonly studyItems: readonly Record<string, unknown>[];
    readonly notes: readonly Record<string, unknown>[];
  };
}

export interface WorkspaceRepositoryPort {
  saveWorkspace(workspace: Workspace, outboxEvent?: DomainEvent): Promise<void>;
  findById(workspaceId: UUIDv7): Promise<Workspace | null>;
  listAll(): Promise<readonly Workspace[]>;
  appendOutbox(workspaceId: UUIDv7, event: DomainEvent): Promise<void>;
  listUnprocessedOutbox(workspaceId: UUIDv7): Promise<readonly OutboxRecord[]>;
  markOutboxProcessed(workspaceId: UUIDv7, outboxId: UUIDv7, processedAtISO: string): Promise<void>;
}

export class WorkspaceService {
  private readonly repo: WorkspaceRepositoryPort;

  constructor(repo: WorkspaceRepositoryPort) {
    this.repo = repo;
  }

  public async createFromTemplate(params: {
    name: string;
    template: StudyTemplateManifest;
    timezone?: string;
  }): Promise<Workspace> {
    const ws = instantiateWorkspaceFromTemplate(params);
    const evt = createDomainEvent({
      type: 'WorkspaceInstantiated.v1',
      workspace_id: ws.id,
      payload: {
        template_id: ws.template_id,
        template_version: ws.template_version,
      },
    });
    await this.repo.saveWorkspace(ws, evt);
    return ws;
  }

  public async updateLayer1Config(
    actor: ActorContext,
    updates: {
      name?: string;
      timezone?: string;
      eventTypeLabels?: Record<string, { label?: string; color?: string; icon?: string }>;
      dashboard?: readonly string[];
    }
  ): Promise<Workspace> {
    assertAuthorized(actor, 'owner', actor.workspace_id);
    const existing = await this.repo.findById(actor.workspace_id);
    if (!existing) {
      throw new DomainError('WORKSPACE_NOT_FOUND', 'Workspace não encontrado.');
    }

    const updatedEventTypes = existing.metadata.eventTypes.map((et) => {
      const custom = updates.eventTypeLabels?.[et.key];
      if (!custom) return et;
      return {
        ...et,
        label: custom.label?.trim() || et.label,
        color: custom.color || et.color,
        icon: custom.icon || et.icon,
      };
    });

    const updated: Workspace = {
      ...existing,
      name: updates.name?.trim() || existing.name,
      timezone: updates.timezone || existing.timezone,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existing.metadata,
        eventTypes: updatedEventTypes,
        dashboard: updates.dashboard ?? existing.metadata.dashboard,
      },
    };

    await this.repo.saveWorkspace(updated);
    return updated;
  }

  public async archiveEventType(actor: ActorContext, eventTypeKey: string): Promise<Workspace> {
    assertAuthorized(actor, 'owner', actor.workspace_id);
    const existing = await this.repo.findById(actor.workspace_id);
    if (!existing) {
      throw new DomainError('WORKSPACE_NOT_FOUND', 'Workspace não encontrado.');
    }
    const updated = archiveWorkspaceEventType(existing, eventTypeKey);
    await this.repo.saveWorkspace(updated);
    return updated;
  }

  /**
   * R-41: O importador DEVE aceitar tanto o formato JSON versionado da plataforma
   * quanto o formato legado `cronograma.json` do protótipo original.
   */
  public parseImportPayload(
    rawJson: unknown,
    fallbackTemplate: StudyTemplateManifest
  ): {
    workspace: Workspace;
    importedItems: { title: string; scheduledDate: string; status: 'pending' | 'done'; area?: string }[];
    importedEvents: { typeKey: string; title: string; dateISO: string; customFields: Record<string, unknown> }[];
  } {
    if (!rawJson || typeof rawJson !== 'object') {
      throw new DomainError('INVALID_IMPORT_JSON', 'Arquivo de importação inválido.');
    }

    // Caso 1: Formato versionado completo (WorkspaceExportBundle)
    if ('schemaVersion' in rawJson && 'workspace' in rawJson) {
      const bundle = rawJson as WorkspaceExportBundle;
      return {
        workspace: bundle.workspace,
        importedItems: (bundle.data?.studyItems ?? []).map((it) => ({
          title: String(it.title ?? 'Item'),
          scheduledDate: String(it.scheduled_date ?? new Date().toISOString().slice(0, 10)),
          status: it.status === 'done' ? 'done' : 'pending',
        })),
        importedEvents: (bundle.data?.events ?? []).map((ev) => ({
          typeKey: String(ev.event_type_key ?? 'aula'),
          title: String(ev.title ?? 'Compromisso'),
          dateISO: String(ev.start_at ?? new Date().toISOString()),
          customFields: (ev.custom_fields as Record<string, unknown>) ?? {},
        })),
      };
    }

    // Caso 2: Formato legado `cronograma.json` do protótipo original (R-41)
    const legacy = rawJson as LegacyCronogramaJson;
    const ws = instantiateWorkspaceFromTemplate({
      name: 'Cronograma Importado',
      template: fallbackTemplate,
    });

    const importedItems: { title: string; scheduledDate: string; status: 'pending' | 'done'; area?: string }[] = [];
    for (const semana of legacy.semanas ?? []) {
      const dateStr = semana.dataInicio ?? '2026-11-09';
      for (const topico of semana.topicos ?? []) {
        importedItems.push({
          title: topico.tema,
          scheduledDate: dateStr,
          status: topico.concluido ? 'done' : 'pending',
          area: topico.area,
        });
      }
    }

    const defaultTypeKey = fallbackTemplate.eventTypes[0]?.key ?? 'aula';
    const importedEvents = (legacy.compromissos ?? []).map((comp) => ({
      typeKey: comp.tipo ?? defaultTypeKey,
      title: comp.titulo,
      dateISO: comp.data,
      customFields: {
        ...(comp.local ? { local: comp.local } : {}),
        ...(comp.turno ? { turno: comp.turno } : {}),
      },
    }));

    return { workspace: ws, importedItems, importedEvents };
  }
}
