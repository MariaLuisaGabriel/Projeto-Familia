/**
 * @estudos/core
 * Tipos, primitivos, UUIDv7, eventos de domínio, limites quantitativos e autorização do núcleo.
 * Regras atendidas: R-06, R-09, R-10, R-11, R-25, R-26, R-34, R-40, R-45, R-48.
 */

export type UUIDv7 = string;
export type ISODateTimeUTC = string;

/**
 * Gera um identificador UUIDv7 (RFC 9562) ordenado no tempo, adequado para criação offline no cliente (R-45)
 * e chaves primárias no servidor (R-34).
 */
export function createUuidV7(nowMs: number = Date.now()): UUIDv7 {
  const timeHex = Math.floor(nowMs).toString(16).padStart(12, '0').slice(-12);
  const randomBytes = new Uint8Array(10);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // version 7 (0111xxxx)
  randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70;
  // variant RFC 4122 / 9562 (10xxxxxx)
  randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80;

  const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 20)}`;
}

export function isValidUuidV7(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * R-34: Toda tabela/entidade de dados de usuário DEVE ter id (UUIDv7), workspace_id,
 * created_at, updated_at e deleted_at (soft delete).
 */
export interface WorkspaceScopedEntity {
  readonly id: UUIDv7;
  readonly workspace_id: UUIDv7;
  readonly created_at: ISODateTimeUTC;
  readonly updated_at: ISODateTimeUTC;
  readonly deleted_at: ISODateTimeUTC | null;
  readonly created_by_rule_id?: string | null; // R-31: rastreia regra de origem quando aplicável
}

export function createBaseEntityFields(
  workspaceId: UUIDv7,
  overrides?: Partial<WorkspaceScopedEntity>
): WorkspaceScopedEntity {
  if (!workspaceId) {
    throw new DomainError('WORKSPACE_ID_REQUIRED', 'Toda entidade de usuário exige um workspace_id (R-34, R-35).');
  }
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? createUuidV7(),
    workspace_id: workspaceId,
    created_at: overrides?.created_at ?? now,
    updated_at: overrides?.updated_at ?? now,
    deleted_at: overrides?.deleted_at ?? null,
    created_by_rule_id: overrides?.created_by_rule_id ?? null,
  };
}

/**
 * R-09: Eventos de domínio DEVEM ser imutáveis, versionados (ex.: AttemptRegistered.v1)
 * e carregar workspace_id, occurred_at, causation_id e correlation_id.
 */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly id: UUIDv7;
  readonly type: `${string}.v${number}`;
  readonly workspace_id: UUIDv7;
  readonly occurred_at: ISODateTimeUTC;
  readonly causation_id: UUIDv7;
  readonly correlation_id: UUIDv7;
  readonly depth: number; // R-29: limite de encadeamento de regras (máx 3)
  readonly payload: Readonly<TPayload>;
}

export function createDomainEvent<TPayload extends Record<string, unknown>>(params: {
  type: `${string}.v${number}`;
  workspace_id: UUIDv7;
  payload: TPayload;
  causation_id?: UUIDv7;
  correlation_id?: UUIDv7;
  depth?: number;
}): Readonly<DomainEvent<TPayload>> {
  const id = createUuidV7();
  const event: DomainEvent<TPayload> = {
    id,
    type: params.type,
    workspace_id: params.workspace_id,
    occurred_at: new Date().toISOString(),
    causation_id: params.causation_id ?? id,
    correlation_id: params.correlation_id ?? id,
    depth: params.depth ?? 0,
    payload: Object.freeze({ ...params.payload }),
  };
  return Object.freeze(event);
}

/**
 * §8.2 Limites quantitativos (valores iniciais)
 * R-25: Os limites DEVEM ser verificados no servidor.
 * R-26: Ao atingir um limite, o sistema DEVE recusar a operação com mensagem clara.
 */
export const WORKSPACE_LIMITS = Object.freeze({
  MAX_EVENT_TYPES: 50,
  MAX_ITEM_TYPES: 30,
  MAX_FIELDS_PER_TYPE: 30,
  MAX_ANALYZABLE_FIELDS_PER_TYPE: 5,
  MAX_SELECT_OPTIONS: 100,
  MAX_CHECKLIST_ITEMS: 50,
  MAX_SHORT_TEXT_CHARS: 2_000,
  MAX_NOTE_MARKDOWN_CHARS: 100_000,
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_WORKSPACE_STORAGE_BYTES: 500 * 1024 * 1024, // 500 MB
  MAX_ACTIVE_RULES: 50,
  MAX_CONDITIONS_PER_RULE: 5,
  MAX_ACTIONS_PER_RULE: 5,
  MAX_RULE_CHAIN_DEPTH: 3,
  MAX_DASHBOARD_WIDGETS: 12,
  MAX_GENERATOR_HORIZON_WEEKS: 104,
  MAX_GENERATOR_OUTPUT_COUNT: 5_000,
} as const);

export class DomainError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class LimitExceededError extends DomainError {
  public readonly resource: string;
  public readonly limit: number;
  public readonly actual: number;

  constructor(resource: string, limit: number, actual: number) {
    super(
      'LIMIT_EXCEEDED',
      `Limite excedido para "${resource}": máximo permitido é ${limit}, mas foi solicitado ${actual} (R-26).`
    );
    this.name = 'LimitExceededError';
    this.resource = resource;
    this.limit = limit;
    this.actual = actual;
  }
}

export function assertWithinLimit(resource: string, actual: number, limit: number): void {
  if (actual > limit) {
    throw new LimitExceededError(resource, limit, actual);
  }
}

/**
 * R-48: Autorização verificada por caso de uso, com base no papel do usuário no workspace.
 */
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface ActorContext {
  readonly user_id: UUIDv7;
  readonly workspace_id: UUIDv7;
  readonly role: WorkspaceRole;
}

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function assertAuthorized(actor: ActorContext, minimumRole: WorkspaceRole, targetWorkspaceId: UUIDv7): void {
  if (actor.workspace_id !== targetWorkspaceId) {
    throw new DomainError(
      'WORKSPACE_ISOLATION_VIOLATION',
      'Acesso negado: o contexto do usuário pertence a outro workspace (R-35, R-48).'
    );
  }
  if (ROLE_WEIGHT[actor.role] < ROLE_WEIGHT[minimumRole]) {
    throw new DomainError(
      'INSUFFICIENT_ROLE',
      `Permissão insuficiente: operação requer papel "${minimumRole}", mas o usuário possui "${actor.role}" (R-48).`
    );
  }
}

/**
 * §5. Entidades fixas do Núcleo de Domínio (11 conceitos universais).
 * R-10: Novas entidades só por ADR e se universais a todos os perfis de estudante.
 */
export type CoreEntityKind =
  | 'Workspace'
  | 'EventType'
  | 'Event'
  | 'Subject'
  | 'Topic'
  | 'ItemType'
  | 'StudyItem'
  | 'Question'
  | 'Attempt'
  | 'Card'
  | 'ReviewLog'
  | 'Note'
  | 'Goal';

export interface EntityReference {
  readonly type: CoreEntityKind;
  readonly id: UUIDv7;
}

/**
 * Sanitização de texto livre (R-49: Texto livre de usuário DEVE ser sanitizado na renderização.
 * Markdown é renderizado sem HTML bruto).
 */
export function sanitizeUserText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '');
}
