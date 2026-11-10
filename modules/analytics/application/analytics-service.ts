/**
 * modules/analytics/application
 */
import { type ActorContext, type DomainEvent, type UUIDv7, assertAuthorized } from '@estudos/core';
import {
  type WorkspaceAnalyticsProjection,
  createInitialProjection,
  applyDomainEventToProjection,
} from '../domain/projections.ts';

export interface AnalyticsRepositoryPort {
  getProjection(workspaceId: UUIDv7): Promise<WorkspaceAnalyticsProjection>;
  saveProjection(workspaceId: UUIDv7, projection: WorkspaceAnalyticsProjection): Promise<void>;
}

export class AnalyticsService {
  private readonly repo: AnalyticsRepositoryPort;

  constructor(repo: AnalyticsRepositoryPort) {
    this.repo = repo;
  }

  public async handleDomainEvent(event: DomainEvent): Promise<WorkspaceAnalyticsProjection> {
    const current = await this.repo.getProjection(event.workspace_id);
    const updated = applyDomainEventToProjection(current, event);
    await this.repo.saveProjection(event.workspace_id, updated);
    return updated;
  }

  public async readProjection(actor: ActorContext): Promise<WorkspaceAnalyticsProjection> {
    assertAuthorized(actor, 'viewer', actor.workspace_id);
    return this.repo.getProjection(actor.workspace_id);
  }
}

export { createInitialProjection };
