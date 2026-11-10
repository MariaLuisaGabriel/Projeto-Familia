/**
 * modules/identity/application
 * Casos de uso de identidade, papel no workspace e exclusão completa de conta (LGPD — R-52).
 */
import type { ActorContext, UUIDv7, WorkspaceRole } from '@estudos/core';
import {
  type Account,
  type WorkspaceMembership,
  createAccountEntity,
  createMembershipEntity,
} from '../domain/account.ts';

export interface IdentityRepositoryPort {
  saveAccount(account: Account): Promise<void>;
  findAccountById(userId: UUIDv7): Promise<Account | null>;
  saveMembership(workspaceId: UUIDv7, membership: WorkspaceMembership): Promise<void>;
  findMembership(workspaceId: UUIDv7, userId: UUIDv7): Promise<WorkspaceMembership | null>;
  deleteAccountAndMemberships(userId: UUIDv7, deletedAtISO: string): Promise<void>;
}

export class IdentityService {
  private readonly repo: IdentityRepositoryPort;

  constructor(repo: IdentityRepositoryPort) {
    this.repo = repo;
  }

  public async registerAccount(input: { email: string; display_name: string }): Promise<Account> {
    const account = createAccountEntity(input);
    await this.repo.saveAccount(account);
    return account;
  }

  public async grantWorkspaceRole(
    workspaceId: UUIDv7,
    userId: UUIDv7,
    role: WorkspaceRole
  ): Promise<WorkspaceMembership> {
    const membership = createMembershipEntity({
      workspace_id: workspaceId,
      user_id: userId,
      role,
    });
    await this.repo.saveMembership(workspaceId, membership);
    return membership;
  }

  public async resolveActorContext(workspaceId: UUIDv7, userId: UUIDv7): Promise<ActorContext | null> {
    const membership = await this.repo.findMembership(workspaceId, userId);
    if (!membership || membership.deleted_at !== null) return null;
    return {
      user_id: userId,
      workspace_id: workspaceId,
      role: membership.role,
    };
  }

  /**
   * R-52: O usuário DEVE poder excluir sua conta e todos os seus workspaces (LGPD).
   */
  public async deleteAccount(userId: UUIDv7): Promise<void> {
    await this.repo.deleteAccountAndMemberships(userId, new Date().toISOString());
  }
}
