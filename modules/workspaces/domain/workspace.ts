/**
 * modules/workspaces/domain
 * Responsável por (§4.1): Workspaces, templates, versões, instanciação (cópia versionada — ADR-0006),
 * metadados (tipos, campos, widgets) e exportação/importação completa (R-41).
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import {
  type UUIDv7,
  type ISODateTimeUTC,
  type DomainEvent,
  createUuidV7,
  DomainError,
} from '@estudos/core';
import {
  type StudyTemplateManifest,
  type TemplateEventTypeDefinition,
  type TemplateItemTypeDefinition,
  validateTemplateManifest,
} from '@estudos/template-schema';

export interface WorkspaceMetadataSnapshot {
  readonly eventTypes: readonly (TemplateEventTypeDefinition & { readonly archived_at?: ISODateTimeUTC | null })[];
  readonly itemTypes: readonly (TemplateItemTypeDefinition & { readonly archived_at?: ISODateTimeUTC | null })[];
  readonly generators: StudyTemplateManifest['generators'];
  readonly dashboard: readonly string[];
  readonly activeModules: readonly string[];
}

export interface Workspace {
  readonly id: UUIDv7;
  readonly name: string;
  readonly timezone: string; // R-40: padrão America/Sao_Paulo
  readonly template_id: string; // R-15
  readonly template_version: string; // R-15
  readonly metadata: WorkspaceMetadataSnapshot; // R-15: cópia isolada do template
  readonly created_at: ISODateTimeUTC;
  readonly updated_at: ISODateTimeUTC;
  readonly deleted_at: ISODateTimeUTC | null;
}

export interface OutboxRecord {
  readonly id: UUIDv7;
  readonly workspace_id: UUIDv7;
  readonly event: DomainEvent;
  readonly processed_at: ISODateTimeUTC | null;
}

/**
 * R-12, R-15: Valida o template e instancia um Workspace copiando todos os metadados
 * para que o workspace nunca dependa de leitura viva do arquivo de template (ADR-0006).
 */
export function instantiateWorkspaceFromTemplate(params: {
  name: string;
  template: StudyTemplateManifest;
  timezone?: string;
  id?: UUIDv7;
}): Workspace {
  const validation = validateTemplateManifest(params.template);
  if (!validation.valid) {
    throw new DomainError(
      'INVALID_TEMPLATE',
      `Template "${params.template.id}" inválido (R-12): ${validation.errors.join('; ')}`
    );
  }

  const clonedManifest: StudyTemplateManifest = JSON.parse(JSON.stringify(params.template));
  const now = new Date().toISOString();

  return {
    id: params.id ?? createUuidV7(),
    name: params.name.trim() || clonedManifest.name,
    timezone: params.timezone ?? 'America/Sao_Paulo',
    template_id: clonedManifest.id,
    template_version: clonedManifest.version,
    metadata: {
      eventTypes: clonedManifest.eventTypes.map((et) => ({ ...et, archived_at: null })),
      itemTypes: (clonedManifest.itemTypes ?? []).map((it) => ({ ...it, archived_at: null })),
      generators: clonedManifest.generators,
      dashboard: [...clonedManifest.dashboard],
      activeModules: ['calendar', 'study', 'practice', 'notes', 'rules', 'analytics'],
    },
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * R-17: Remover um tipo ou campo que já possui dados DEVE arquivá-lo (soft delete).
 * Os valores existentes são preservados e continuam exportáveis.
 */
export function archiveWorkspaceEventType(workspace: Workspace, eventTypeKey: string): Workspace {
  const now = new Date().toISOString();
  return {
    ...workspace,
    updated_at: now,
    metadata: {
      ...workspace.metadata,
      eventTypes: workspace.metadata.eventTypes.map((et) =>
        et.key === eventTypeKey ? { ...et, archived_at: now } : et
      ),
    },
  };
}

/**
 * R-18: Templates compartilhados entre usuários NÃO DEVEM levar dados do workspace de origem
 * (eventos, tentativas, notas). Apenas metadados e taxonomia.
 */
export function extractShareableTemplateFromWorkspace(
  workspace: Workspace,
  taxonomy: StudyTemplateManifest['taxonomy'] = []
): StudyTemplateManifest {
  return {
    id: `${workspace.template_id}-shared`,
    version: '1.0.0',
    name: `${workspace.name} (Template)`,
    eventTypes: workspace.metadata.eventTypes
      .filter((et) => !et.archived_at)
      .map(({ archived_at: _archived, ...rest }) => rest),
    itemTypes: workspace.metadata.itemTypes
      .filter((it) => !it.archived_at)
      .map(({ archived_at: _archived, ...rest }) => rest),
    taxonomy: JSON.parse(JSON.stringify(taxonomy)),
    generators: JSON.parse(JSON.stringify(workspace.metadata.generators)),
    dashboard: [...workspace.metadata.dashboard],
  };
}
