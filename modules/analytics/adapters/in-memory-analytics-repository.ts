/**
 * modules/analytics/adapters
 */
import type { UUIDv7 } from '@estudos/core';
import {
  type WorkspaceAnalyticsProjection,
  createInitialProjection,
} from '../domain/projections.ts';
import type { AnalyticsRepositoryPort } from '../application/analytics-service.ts';

export class InMemoryAnalyticsRepository implements AnalyticsRepositoryPort {
  private readonly store = new Map<UUIDv7, WorkspaceAnalyticsProjection>();

  public async getProjection(workspaceId: UUIDv7): Promise<WorkspaceAnalyticsProjection> {
    return this.store.get(workspaceId) ?? createInitialProjection(workspaceId);
  }

  public async saveProjection(
    workspaceId: UUIDv7,
    projection: WorkspaceAnalyticsProjection
  ): Promise<void> {
    this.store.set(workspaceId, projection);
  }
}
