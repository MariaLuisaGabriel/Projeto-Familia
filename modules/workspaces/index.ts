/**
 * Interface pública do módulo @estudos/workspaces (R-03)
 */
export {
  type Workspace,
  type WorkspaceMetadataSnapshot,
  type OutboxRecord,
  instantiateWorkspaceFromTemplate,
  archiveWorkspaceEventType,
  extractShareableTemplateFromWorkspace,
} from './domain/workspace.ts';
export {
  type LegacyCronogramaJson,
  type WorkspaceExportBundle,
  type WorkspaceRepositoryPort,
  WorkspaceService,
} from './application/workspace-service.ts';
export { InMemoryWorkspaceRepository } from './adapters/in-memory-workspace-repository.ts';
