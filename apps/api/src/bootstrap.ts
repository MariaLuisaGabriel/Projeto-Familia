/**
 * apps/api/src/bootstrap.ts
 * Composição central do monolito modular (§3): instancia repositórios e serviços dos 8 módulos
 * compartilhados entre `apps/api` e `apps/worker` (mesmo código, entrypoints diferentes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createUuidV7, type ActorContext } from '@estudos/core';
import type { StudyTemplateManifest } from '@estudos/template-schema';
import { IdentityService, InMemoryIdentityRepository } from '@estudos/identity';
import { WorkspaceService, InMemoryWorkspaceRepository } from '@estudos/workspaces';
import { CalendarService, InMemoryCalendarRepository } from '@estudos/calendar';
import { StudyService, InMemoryStudyRepository } from '@estudos/study';
import { PracticeService, InMemoryPracticeRepository } from '@estudos/practice';
import { NotesService, InMemoryNoteRepository } from '@estudos/notes';
import { RulesEngineService, InMemoryRulesRepository } from '@estudos/rules';
import { AnalyticsService, InMemoryAnalyticsRepository } from '@estudos/analytics';

export function loadOfficialTemplates(rootDir: string = process.cwd()): StudyTemplateManifest[] {
  const candidates = [
    path.resolve(rootDir, 'templates'),
    path.resolve(rootDir, '..', '..', 'templates'),
  ];
  const templatesDir = candidates.find((d) => fs.existsSync(d));
  if (!templatesDir) return [];

  const manifests: StudyTemplateManifest[] = [];
  for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(templatesDir, entry.name, 'template.json');
    if (fs.existsSync(file)) {
      manifests.push(JSON.parse(fs.readFileSync(file, 'utf-8')) as StudyTemplateManifest);
    }
  }
  return manifests;
}

export function createPlatformContainer() {
  const identityRepo = new InMemoryIdentityRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();
  const appendOutbox = (wsId: string, evt: Parameters<typeof workspaceRepo.appendOutbox>[1]) =>
    workspaceRepo.appendOutbox(wsId, evt);

  const calendarRepo = new InMemoryCalendarRepository(appendOutbox);
  const studyRepo = new InMemoryStudyRepository(appendOutbox);
  const practiceRepo = new InMemoryPracticeRepository(appendOutbox);
  const notesRepo = new InMemoryNoteRepository();
  const rulesRepo = new InMemoryRulesRepository();
  const analyticsRepo = new InMemoryAnalyticsRepository();

  const identityService = new IdentityService(identityRepo);
  const workspaceService = new WorkspaceService(workspaceRepo);
  const calendarService = new CalendarService(calendarRepo);
  const studyService = new StudyService(studyRepo);
  const practiceService = new PracticeService(practiceRepo);
  const notesService = new NotesService(notesRepo);
  const analyticsService = new AnalyticsService(analyticsRepo);
  const rulesEngine = new RulesEngineService(rulesRepo, {
    calendarService,
    studyService,
  });

  /**
   * Processa a fila Transactional Outbox de um workspace (usado por apps/worker ou em modo síncrono de dev).
   */
  async function drainWorkspaceOutbox(workspaceId: string): Promise<number> {
    const pending = await workspaceRepo.listUnprocessedOutbox(workspaceId);
    for (const record of pending) {
      await rulesEngine.processDomainEvent(record.event);
      await analyticsService.handleDomainEvent(record.event);
      await workspaceRepo.markOutboxProcessed(
        workspaceId,
        record.id,
        new Date().toISOString()
      );
    }
    return pending.length;
  }

  return {
    identityService,
    workspaceRepo,
    workspaceService,
    calendarService,
    studyService,
    practiceService,
    notesService,
    rulesRepo,
    rulesEngine,
    analyticsService,
    drainWorkspaceOutbox,
    defaultUserId: createUuidV7(),
    createOwnerActor(workspaceId: string, userId?: string): ActorContext {
      return {
        user_id: userId ?? this.defaultUserId,
        workspace_id: workspaceId,
        role: 'owner',
      };
    },
  };
}
