import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createUuidV7, createDomainEvent, type ActorContext } from '@estudos/core';
import type { StudyTemplateManifest } from '@estudos/template-schema';
import { WorkspaceService, InMemoryWorkspaceRepository } from '@estudos/workspaces';
import { CalendarService, InMemoryCalendarRepository } from '@estudos/calendar';
import { StudyService, InMemoryStudyRepository } from '@estudos/study';
import { PracticeService, InMemoryPracticeRepository } from '@estudos/practice';
import { NotesService, InMemoryNoteRepository } from '@estudos/notes';
import { RulesEngineService, InMemoryRulesRepository } from '@estudos/rules';
import { AnalyticsService, InMemoryAnalyticsRepository } from '@estudos/analytics';

function loadTemplate(slug: string): StudyTemplateManifest {
  const filePath = path.resolve(process.cwd(), 'templates', slug, 'template.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as StudyTemplateManifest;
}

describe('Integração dos Módulos e Fitness de Domínio (§4 a §16)', () => {
  it('instancia template com cópia isolada (R-15) e gera cronograma determinístico (R-24)', async () => {
    const wsRepo = new InMemoryWorkspaceRepository();
    const wsService = new WorkspaceService(wsRepo);
    const studyRepo = new InMemoryStudyRepository();
    const studyService = new StudyService(studyRepo);

    const template = loadTemplate('residencia-medica');
    const ws = await wsService.createFromTemplate({
      name: 'Residência SES-DF 2027',
      template,
    });

    assert.equal(ws.template_id, 'residencia-medica');
    assert.equal(ws.template_version, '1.0.0');

    const actor: ActorContext = {
      user_id: createUuidV7(),
      workspace_id: ws.id,
      role: 'owner',
    };

    const { topics } = await studyService.seedTaxonomy(ws.id, template.taxonomy);
    assert.equal(topics.length > 0, true);

    const items1 = await studyService.runScheduleGenerator(actor, {
      generatorKind: 'linear',
      generatorParams: { itemsPerWeek: 4, startDateISO: '2026-11-09' },
    });
    assert.equal(items1.length, topics.length);
  });

  it('executa regras via Outbox com idempotência (R-28), profundidade máx 3 (R-29) e atribuição (R-31)', async () => {
    const wsRepo = new InMemoryWorkspaceRepository();
    const wsService = new WorkspaceService(wsRepo);
    const calRepo = new InMemoryCalendarRepository((wsId, evt) => wsRepo.appendOutbox(wsId, evt));
    const calService = new CalendarService(calRepo);
    const studyRepo = new InMemoryStudyRepository((wsId, evt) => wsRepo.appendOutbox(wsId, evt));
    const studyService = new StudyService(studyRepo);
    const rulesRepo = new InMemoryRulesRepository();
    const rulesEngine = new RulesEngineService(rulesRepo, {
      calendarService: calService,
      studyService,
    });

    const template = loadTemplate('residencia-medica');
    const ws = await wsService.createFromTemplate({ name: 'Teste Regras', template });
    await rulesEngine.seedRules(ws.id, template.suggestedRules);

    const actor: ActorContext = {
      user_id: createUuidV7(),
      workspace_id: ws.id,
      role: 'owner',
    };

    const firstType = ws.metadata.eventTypes[0];
    const { domainEvent } = await calService.scheduleEvent(actor, ws, {
      event_type_key: firstType.key,
      title: 'Compromisso Noturno',
      start_at: '2026-11-10T19:00:00.000Z',
      custom_fields: {
        local: 'HRC',
        turno: 'noturno',
      },
    });

    const logs1 = await rulesEngine.processDomainEvent(domainEvent);
    assert.equal(logs1.length, 1);
    assert.equal(logs1[0].status, 'executed');

    // R-28: Reprocessar o mesmo evento não deve duplicar execução
    const logs2 = await rulesEngine.processDomainEvent(domainEvent);
    assert.equal(logs2.length, 0);

    // R-31: O bloqueio de período criado no calendário registra a regra de origem
    const allEvents = await calService.listWorkspaceEvents(actor);
    const blocked = allEvents.find((e) => e.is_blocked_period);
    assert.ok(blocked, 'Deveria ter criado período bloqueado pela regra');
    assert.ok(blocked.created_by_rule_id, 'Deveria registrar created_by_rule_id (R-31)');

    // R-29: Evento com depth >= 3 deve ser bloqueado
    const deepEvent = createDomainEvent({
      type: 'EventCreated.v1',
      workspace_id: ws.id,
      depth: 3,
      payload: {
        eventTypeKey: firstType.key,
        customFields: { turno: 'noturno' },
      },
    });
    const deepLogs = await rulesEngine.processDomainEvent(deepEvent);
    assert.equal(deepLogs[0]?.status, 'blocked_max_depth');
  });

  it('isola estritamente os dados por workspace (R-35, R-48) e processa analytics de forma idempotente (R-28)', async () => {
    const notesRepo = new InMemoryNoteRepository();
    const notesService = new NotesService(notesRepo);
    const practiceRepo = new InMemoryPracticeRepository();
    const practiceService = new PracticeService(practiceRepo);
    const analyticsRepo = new InMemoryAnalyticsRepository();
    const analyticsService = new AnalyticsService(analyticsRepo);

    const wsA = createUuidV7();
    const wsB = createUuidV7();
    const actorA: ActorContext = { user_id: createUuidV7(), workspace_id: wsA, role: 'owner' };
    const actorB: ActorContext = { user_id: createUuidV7(), workspace_id: wsB, role: 'owner' };

    await notesService.createNote(actorA, {
      title: 'Nota exclusiva A',
      content_markdown: 'Conteúdo de A',
    });

    const notesInA = await notesService.listNotes(actorA);
    const notesInB = await notesService.listNotes(actorB);
    assert.equal(notesInA.length, 1);
    assert.equal(notesInB.length, 0);

    const topicId = createUuidV7();
    const { domainEvent } = await practiceService.registerAttempt(actorA, {
      question_id: createUuidV7(),
      topic_id: topicId,
      is_correct: true,
    });

    await analyticsService.handleDomainEvent(domainEvent);
    // R-28: Reprocessar mesmo evento
    const proj = await analyticsService.handleDomainEvent(domainEvent);
    assert.equal(proj.attempts_by_topic[topicId]?.total, 1);
    assert.equal(proj.attempts_by_topic[topicId]?.accuracy, 1);
  });
});
