/**
 * modules/identity/domain
 * Responsável por (§4.1): Contas, autenticação, sessão e papéis no workspace (owner, editor, viewer).
 * R-01: domain/ não importa de application/, adapters/ ou infra.
 */
import {
  type UUIDv7,
  type ISODateTimeUTC,
  type WorkspaceRole,
  type WorkspaceScopedEntity,
  createUuidV7,
  createBaseEntityFields,
  DomainError,
} from '@estudos/core';

export interface Account {
  readonly id: UUIDv7;
  readonly email: string;
  readonly display_name: string;
  readonly created_at: ISODateTimeUTC;
  readonly updated_at: ISODateTimeUTC;
  readonly deleted_at: ISODateTimeUTC | null;
}

export interface WorkspaceMembership extends WorkspaceScopedEntity {
  readonly user_id: UUIDv7;
  readonly role: WorkspaceRole;
}

export function createAccountEntity(params: { email: string; display_name: string }): Account {
  const email = params.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new DomainError('INVALID_EMAIL', 'E-mail inválido.');
  }
  const now = new Date().toISOString();
  return {
    id: createUuidV7(),
    email,
    display_name: params.display_name.trim() || email.split('@')[0],
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

export function createMembershipEntity(params: {
  workspace_id: UUIDv7;
  user_id: UUIDv7;
  role: WorkspaceRole;
}): WorkspaceMembership {
  const base = createBaseEntityFields(params.workspace_id);
  return {
    ...base,
    user_id: params.user_id,
    role: params.role,
  };
}
