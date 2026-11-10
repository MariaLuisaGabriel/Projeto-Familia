/**
 * modules/identity/adapters
 */
import type { UUIDv7 } from '@estudos/core';
import type { Account, WorkspaceMembership } from '../domain/account.ts';
import type { IdentityRepositoryPort } from '../application/identity-service.ts';

export class InMemoryIdentityRepository implements IdentityRepositoryPort {
  private readonly accounts = new Map<UUIDv7, Account>();
  private readonly memberships = new Map<string, WorkspaceMembership>();

  public async saveAccount(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  public async findAccountById(userId: UUIDv7): Promise<Account | null> {
    const acc = this.accounts.get(userId);
    return acc && acc.deleted_at === null ? acc : null;
  }

  public async saveMembership(workspaceId: UUIDv7, membership: WorkspaceMembership): Promise<void> {
    this.memberships.set(`${workspaceId}:${membership.user_id}`, membership);
  }

  public async findMembership(workspaceId: UUIDv7, userId: UUIDv7): Promise<WorkspaceMembership | null> {
    return this.memberships.get(`${workspaceId}:${userId}`) ?? null;
  }

  public async deleteAccountAndMemberships(userId: UUIDv7, deletedAtISO: string): Promise<void> {
    const acc = this.accounts.get(userId);
    if (acc) {
      this.accounts.set(userId, { ...acc, deleted_at: deletedAtISO, updated_at: deletedAtISO });
    }
    for (const [key, m] of this.memberships.entries()) {
      if (m.user_id === userId) {
        this.memberships.set(key, { ...m, deleted_at: deletedAtISO, updated_at: deletedAtISO });
      }
    }
  }
}
