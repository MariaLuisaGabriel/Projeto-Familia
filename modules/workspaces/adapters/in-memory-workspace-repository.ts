/**
 * modules/workspaces/adapters
 * Repositório em memória + Transactional Outbox (R-27).
 */
import type { DomainEvent, UUIDv7 } from '@estudos/core';
import type { Workspace, OutboxRecord } from '../domain/workspace.ts';
import type { WorkspaceRepositoryPort } from '../application/workspace-service.ts';

export class InMemoryWorkspaceRepository implements WorkspaceRepositoryPort {
  private readonly workspaces = new Map<UUIDv7, Workspace>();
  private readonly outbox = new Map<UUIDv7, OutboxRecord[]>();

  public async saveWorkspace(workspace: Workspace, outboxEvent?: DomainEvent): Promise<void> {
    // R-27: Grava mudança e evento de domínio na outbox na mesma operação atômica
    this.workspaces.set(workspace.id, workspace);
    if (outboxEvent) {
      await this.appendOutbox(workspace.id, outboxEvent);
    }
  }

  public async findById(workspaceId: UUIDv7): Promise<Workspace | null> {
    const ws = this.workspaces.get(workspaceId);
    return ws && ws.deleted_at === null ? ws : null;
  }

  public async listAll(): Promise<readonly Workspace[]> {
    return Array.from(this.workspaces.values()).filter((w) => w.deleted_at === null);
  }

  public async appendOutbox(workspaceId: UUIDv7, event: DomainEvent): Promise<void> {
    const list = this.outbox.get(workspaceId) ?? [];
    list.push({
      id: event.id,
      workspace_id: workspaceId,
      event,
      processed_at: null,
    });
    this.outbox.set(workspaceId, list);
  }

  public async listUnprocessedOutbox(workspaceId: UUIDv7): Promise<readonly OutboxRecord[]> {
    const list = this.outbox.get(workspaceId) ?? [];
    return list.filter((r) => r.processed_at === null);
  }

  public async markOutboxProcessed(
    workspaceId: UUIDv7,
    outboxId: UUIDv7,
    processedAtISO: string
  ): Promise<void> {
    const list = this.outbox.get(workspaceId) ?? [];
    this.outbox.set(
      workspaceId,
      list.map((r) => (r.id === outboxId ? { ...r, processed_at: processedAtISO } : r))
    );
  }
}
