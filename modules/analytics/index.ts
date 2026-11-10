/**
 * Interface pública do módulo @estudos/analytics (R-03)
 */
export {
  type WorkspaceAnalyticsProjection,
  createInitialProjection,
  applyDomainEventToProjection,
} from './domain/projections.ts';
export { type AnalyticsRepositoryPort, AnalyticsService } from './application/analytics-service.ts';
export { InMemoryAnalyticsRepository } from './adapters/in-memory-analytics-repository.ts';
