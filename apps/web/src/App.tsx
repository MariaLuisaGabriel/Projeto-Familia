/**
 * apps/web/src/App.tsx
 * Interface minimalista gerada 100% a partir dos metadados do Workspace e dos Registros (§7, §11).
 * Regras atendidas: R-31, R-41, R-42, R-43, R-44, R-45, R-46, R-49, R-51.
 */
import React, { useState, useMemo } from 'react';
import { createUuidV7, type ActorContext } from '@estudos/core';
import { GeneratorRegistry, WidgetRegistry } from '@estudos/registries';
import type { StudyTemplateManifest, TemplateFieldDefinition } from '@estudos/template-schema';
import { Button, SurfaceCard, Badge, RuleOriginBadge } from '@estudos/ui';
import {
  instantiateWorkspaceFromTemplate,
  type Workspace,
  type WorkspaceExportBundle,
} from '@estudos/workspaces';
import {
  createCalendarEventEntity,
  exportEventsToIcs,
  type CalendarEvent,
} from '@estudos/calendar';
import {
  createSubjectEntity,
  createTopicEntity,
  createStudyItemEntity,
  buildStudyScheduleFromGenerator,
  type Subject,
  type Topic,
  type StudyItem,
} from '@estudos/study';
import {
  createCardEntity,
  scheduleNextFsrsReview,
  type Card,
  type FsrsRating,
} from '@estudos/practice';
import { createNoteEntity, type Note } from '@estudos/notes';
import {
  createUserRuleFromSeed,
  evaluateRuleAgainstEvent,
  type UserRule,
  type RuleExecutionLog,
} from '@estudos/rules';
import {
  createInitialProjection,
  applyDomainEventToProjection,
  type WorkspaceAnalyticsProjection,
} from '@estudos/analytics';
import { createDomainEvent } from '@estudos/core';
import { FieldTypeViewRegistry } from './registries/field-type-views.tsx';

// Carrega todos os templates declarativos de templates/*/template.json sem acoplamento a nomes de área (R-11, R-43)
const templateModules = import.meta.glob('../../../../templates/*/template.json', {
  eager: true,
}) as Record<string, { default: StudyTemplateManifest }>;

const OFFICIAL_TEMPLATES: readonly StudyTemplateManifest[] = Object.values(templateModules).map(
  (m) => m.default
);

interface WorkspaceRuntimeState {
  readonly workspace: Workspace;
  readonly subjects: readonly Subject[];
  readonly topics: readonly Topic[];
  readonly studyItems: readonly StudyItem[];
  readonly events: readonly CalendarEvent[];
  readonly cards: readonly Card[];
  readonly notes: readonly Note[];
  readonly rules: readonly UserRule[];
  readonly ruleLogs: readonly RuleExecutionLog[];
  readonly projection: WorkspaceAnalyticsProjection;
}

function buildInitialWorkspaceState(template: StudyTemplateManifest): WorkspaceRuntimeState {
  const workspace = instantiateWorkspaceFromTemplate({
    name: template.name,
    template,
  });

  const subjects: Subject[] = [];
  const topics: Topic[] = [];

  for (const subSeed of template.taxonomy ?? []) {
    const sub = createSubjectEntity({
      workspace_id: workspace.id,
      key: subSeed.key,
      title: subSeed.title,
      color: subSeed.color,
    });
    subjects.push(sub);
    for (const topSeed of subSeed.topics) {
      topics.push(
        createTopicEntity({
          workspace_id: workspace.id,
          subject_id: sub.id,
          key: topSeed.key,
          title: topSeed.title,
          weight: topSeed.weight,
        })
      );
    }
  }

  const defaultGen = template.generators[0] ?? { kind: 'linear', params: { itemsPerWeek: 4 } };
  const studyItems = buildStudyScheduleFromGenerator({
    workspace_id: workspace.id,
    generatorKind: defaultGen.kind,
    topics,
    generatorParams: {
      itemsPerWeek: Number(defaultGen.params.itemsPerWeek ?? 4),
      startDateISO: '2026-11-09',
      itemTypeKey: String(
        defaultGen.params.itemTypeKey ?? template.itemTypes?.[0]?.key ?? 'estudo'
      ),
    },
  });

  const cards: Card[] = topics.slice(0, 3).map((t) =>
    createCardEntity({
      workspace_id: workspace.id,
      topic_id: t.id,
      front: `Conceito essencial: ${t.title}`,
      back: `Pontos-chave de revisão espaçada (FSRS) sobre ${t.title}.`,
    })
  );

  const rules: UserRule[] = (template.suggestedRules ?? []).map((seed) =>
    createUserRuleFromSeed(workspace.id, seed)
  );

  return {
    workspace,
    subjects,
    topics,
    studyItems,
    events: [],
    cards,
    notes: [],
    rules,
    ruleLogs: [],
    projection: createInitialProjection(workspace.id),
  };
}

type ActiveTab = 'dashboard' | 'calendar' | 'study' | 'practice' | 'notes' | 'rules';

export function App(): React.ReactElement {
  const [workspacesMap, setWorkspacesMap] = useState<Record<string, WorkspaceRuntimeState>>(() => {
    const initial: Record<string, WorkspaceRuntimeState> = {};
    for (const tpl of OFFICIAL_TEMPLATES) {
      const state = buildInitialWorkspaceState(tpl);
      initial[state.workspace.id] = state;
    }
    return initial;
  });

  const workspaceIds = Object.keys(workspacesMap);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaceIds[0] ?? '');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [offlineQueueCount] = useState<number>(0);

  const current = workspacesMap[activeWorkspaceId];
  const actor: ActorContext = useMemo(
    () => ({
      user_id: createUuidV7(),
      workspace_id: activeWorkspaceId,
      role: 'owner',
    }),
    [activeWorkspaceId]
  );

  // Estado do formulário dinâmico de Eventos (gerado por metadados — R-42)
  const availableEventTypes = useMemo(
    () => current?.workspace.metadata.eventTypes.filter((et) => !et.archived_at) ?? [],
    [current]
  );
  const [selectedEventTypeKey, setSelectedEventTypeKey] = useState<string>(
    availableEventTypes[0]?.key ?? ''
  );
  const activeEventTypeDef =
    availableEventTypes.find((et) => et.key === selectedEventTypeKey) ?? availableEventTypes[0];

  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDateISO, setEventDateISO] = useState<string>('2026-11-10T19:00');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Estado do formulário de Notas
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteMarkdown, setNoteMarkdown] = useState<string>('');

  // Estado de Flashcards FSRS
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);

  if (!current) {
    return <div className="app-shell">Carregando workspaces...</div>;
  }

  const updateCurrentWorkspace = (
    updater: (prev: WorkspaceRuntimeState) => WorkspaceRuntimeState
  ) => {
    setWorkspacesMap((prev) => ({
      ...prev,
      [activeWorkspaceId]: updater(prev[activeWorkspaceId]),
    }));
  };

  // Dispara evento de domínio na Outbox local e avalia regras ativas + projeções (R-27 a R-31)
  const dispatchDomainEventThroughOutbox = (
    state: WorkspaceRuntimeState,
    domainEvent: ReturnType<typeof createDomainEvent>
  ): WorkspaceRuntimeState => {
    let nextEvents = [...state.events];
    let nextItems = [...state.studyItems];
    const nextLogs = [...state.ruleLogs];
    const nextProjection = applyDomainEventToProjection(state.projection, domainEvent);

    for (const rule of state.rules) {
      if (!rule.enabled) continue;
      const evalResult = evaluateRuleAgainstEvent({
        rule,
        event: domainEvent,
        priorExecutionsInCorrelationChain: nextLogs,
      });

      if (evalResult.status === 'skipped_conditions') continue;

      if (evalResult.status === 'executed') {
        for (const eff of evalResult.plannedEffects) {
          if (eff.actionKey === 'block-period') {
            const blockedEv = createCalendarEventEntity({
              workspace_id: state.workspace.id,
              event_type_key: 'bloqueio-descanso',
              title: `Período Bloqueado (${rule.name})`,
              start_at: String(eff.payload.referenceEndISO ?? domainEvent.occurred_at),
              defaultDurationMin: 720,
              is_blocked_period: true,
              created_by_rule_id: rule.name, // R-31
            });
            nextEvents = [blockedEv, ...nextEvents];
          } else if (eff.actionKey === 'create-item') {
            const createdItem = createStudyItemEntity({
              workspace_id: state.workspace.id,
              item_type_key: String(eff.payload.itemType ?? 'revisao'),
              topic_id: (eff.payload.topicId as string | null) ?? null,
              title: `Revisão Programada (${rule.name})`,
              scheduled_date: '2026-11-12',
              created_by_rule_id: rule.name, // R-31
            });
            nextItems = [createdItem, ...nextItems];
          }
        }
      }

      nextLogs.unshift({
        id: createUuidV7(),
        workspace_id: state.workspace.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        rule_id: rule.id,
        rule_name: rule.name,
        source_event_id: domainEvent.id,
        correlation_id: domainEvent.correlation_id,
        depth: domainEvent.depth + 1,
        status: evalResult.status,
        effects: evalResult.plannedEffects,
      });
    }

    return {
      ...state,
      events: nextEvents,
      studyItems: nextItems,
      ruleLogs: nextLogs,
      projection: nextProjection,
    };
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventTypeDef) return;

    // Preenche valores default dos campos do catálogo caso não tocados
    const resolvedFields: Record<string, unknown> = {};
    for (const f of activeEventTypeDef.fields) {
      resolvedFields[f.key] =
        customFieldValues[f.key] ?? (f.options ? f.options[0] : f.default ?? '');
    }

    const startISO = new Date(eventDateISO).toISOString();
    const newEv = createCalendarEventEntity({
      workspace_id: current.workspace.id,
      event_type_key: activeEventTypeDef.key,
      title: eventTitle.trim() || activeEventTypeDef.label,
      start_at: startISO,
      defaultDurationMin: activeEventTypeDef.defaultDurationMin,
      custom_fields: resolvedFields,
    });

    const domEvt = createDomainEvent({
      type: 'EventCreated.v1',
      workspace_id: current.workspace.id,
      payload: {
        eventId: newEv.id,
        eventTypeKey: newEv.event_type_key,
        startAt: newEv.start_at,
        endAt: newEv.end_at,
        customFields: newEv.custom_fields,
      },
    });

    updateCurrentWorkspace((prev) => {
      const withEvent = { ...prev, events: [newEv, ...prev.events] };
      return dispatchDomainEventThroughOutbox(withEvent, domEvt);
    });

    setEventTitle('');
  };

  const handleToggleStudyItem = (itemId: string) => {
    updateCurrentWorkspace((prev) => {
      let completedItem: StudyItem | null = null;
      const updatedItems = prev.studyItems.map((it) => {
        if (it.id !== itemId) return it;
        const nextStatus = it.status === 'done' ? ('pending' as const) : ('done' as const);
        const updated: StudyItem = {
          ...it,
          status: nextStatus,
          completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };
        if (nextStatus === 'done') completedItem = updated;
        return updated;
      });

      const nextState = { ...prev, studyItems: updatedItems };
      if (!completedItem) return nextState;

      const evt = createDomainEvent({
        type: 'StudyItemCompleted.v1',
        workspace_id: prev.workspace.id,
        payload: {
          itemId: (completedItem as StudyItem).id,
          itemTypeKey: (completedItem as StudyItem).item_type_key,
        },
      });
      return dispatchDomainEventThroughOutbox(nextState, evt);
    });
  };

  const handleRunGenerator = (generatorKind: string) => {
    updateCurrentWorkspace((prev) => {
      const generated = buildStudyScheduleFromGenerator({
        workspace_id: prev.workspace.id,
        generatorKind,
        topics: prev.topics,
        generatorParams: {
          itemsPerWeek: 4,
          startDateISO: '2026-11-09',
          itemTypeKey: prev.workspace.metadata.itemTypes[0]?.key ?? 'estudo',
        },
      });
      return {
        ...prev,
        studyItems: [...generated],
      };
    });
  };

  const handleReviewCard = (cardId: string, rating: FsrsRating) => {
    updateCurrentWorkspace((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === cardId ? scheduleNextFsrsReview(c, rating).updatedCard : c
      ),
    }));
    setRevealedCardId(null);
  };

  const handleLogQuestionAttempt = (topicId: string, isCorrect: boolean) => {
    const evt = createDomainEvent({
      type: 'AttemptRegistered.v1',
      workspace_id: current.workspace.id,
      payload: {
        attemptId: createUuidV7(),
        topicId,
        isCorrect,
        accuracyRate: isCorrect ? 0.85 : 0.45,
      },
    });
    updateCurrentWorkspace((prev) => dispatchDomainEventThroughOutbox(prev, evt));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    const note = createNoteEntity({
      workspace_id: current.workspace.id,
      title: noteTitle,
      content_markdown: noteMarkdown,
    });
    updateCurrentWorkspace((prev) => ({
      ...prev,
      notes: [note, ...prev.notes],
    }));
    setNoteTitle('');
    setNoteMarkdown('');
  };

  const handleExportWorkspaceJson = () => {
    const bundle: WorkspaceExportBundle = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      workspace: current.workspace,
      data: {
        events: current.events as unknown as Record<string, unknown>[],
        subjects: current.subjects as unknown as Record<string, unknown>[],
        topics: current.topics as unknown as Record<string, unknown>[],
        studyItems: current.studyItems as unknown as Record<string, unknown>[],
        notes: current.notes as unknown as Record<string, unknown>[],
      },
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-${current.workspace.template_id}-${current.workspace.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportIcs = () => {
    const ics = exportEventsToIcs(current.workspace.name, current.events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-${current.workspace.template_id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = current.studyItems.filter((i) => i.status === 'done').length;
  const totalItems = current.studyItems.length;
  const completionPct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;

  return (
    <div className="app-shell">
      {/* Cabeçalho Minimalista + Seletor de Workspace/Template */}
      <header className="topbar">
        <div className="brand">
          <span className="brand__eyebrow">
            Monolito Modular · {current.workspace.template_id}@{current.workspace.template_version} ·{' '}
            {current.workspace.timezone}
          </span>
          <h1 className="brand__title">{current.workspace.name}</h1>
        </div>

        <div className="workspace-switcher">
          <Badge tone="neutral" title="Papel no Workspace (R-48)">
            papel: {actor.role}
          </Badge>
          <Badge tone="success" title="PWA Offline-Ready & Fila Local (R-44, R-46)">
            fila offline: {offlineQueueCount}
          </Badge>
          <select
            className="ui-select"
            style={{ width: 'auto', minWidth: 230 }}
            aria-label="Alternar Workspace (Template Instanciado)"
            value={activeWorkspaceId}
            onChange={(e) => {
              const nextWsId = e.target.value;
              setActiveWorkspaceId(nextWsId);
              const firstEt =
                workspacesMap[nextWsId]?.workspace.metadata.eventTypes[0]?.key ?? '';
              setSelectedEventTypeKey(firstEt);
              setCustomFieldValues({});
            }}
          >
            {Object.values(workspacesMap).map((wsState) => (
              <option key={wsState.workspace.id} value={wsState.workspace.id}>
                {wsState.workspace.name} ({wsState.workspace.template_id})
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={handleExportWorkspaceJson}>
            Exportar JSON (R-41)
          </Button>
        </div>
      </header>

      {/* Navegação Principal (Alvos >= 44px — R-44) */}
      <nav className="nav-tabs" aria-label="Seções do Workspace">
        {(
          [
            ['dashboard', 'Painel'],
            ['calendar', `Agenda (${current.events.length})`],
            ['study', `Cronograma (${doneCount}/${totalItems})`],
            ['practice', `Prática & FSRS (${current.cards.length})`],
            ['notes', `Notas (${current.notes.length})`],
            ['rules', `Regras & Metadados (${current.rules.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`nav-tab ${activeTab === key ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ABA 1: PAINEL COMPOSTO POR WIDGETS DO CATÁLOGO (L-05, R-14, R-42) */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="grid-widgets">
            {current.workspace.metadata.dashboard.map((widgetSpec) => {
              const [baseKey, param] = widgetSpec.split(':');
              const widgetEntry = WidgetRegistry.get(baseKey);
              if (!widgetEntry) return null;

              if (baseKey === 'progress') {
                return (
                  <SurfaceCard
                    key={widgetSpec}
                    title={widgetEntry.label}
                    subtitle="Itens do cronograma concluídos"
                    headerRight={<Badge tone="accent">{completionPct}%</Badge>}
                  >
                    <div className="metric-big">
                      {doneCount} / {totalItems}
                    </div>
                    <div className="progress-bar" role="progressbar" aria-valuenow={completionPct}>
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </SurfaceCard>
                );
              }

              if (baseKey === 'events-of-type' && param) {
                const etDef = current.workspace.metadata.eventTypes.find((e) => e.key === param);
                const count = current.events.filter((e) => e.event_type_key === param).length;
                return (
                  <SurfaceCard
                    key={widgetSpec}
                    title={etDef ? etDef.label : param}
                    subtitle={`Widget: ${widgetSpec}`}
                    headerRight={<Badge>{param}</Badge>}
                  >
                    <div className="metric-big">{count}</div>
                    <p className="ui-card__subtitle">registros na agenda deste workspace</p>
                  </SurfaceCard>
                );
              }

              if (baseKey === 'hours-by-subject') {
                return (
                  <SurfaceCard
                    key={widgetSpec}
                    title={widgetEntry.label}
                    subtitle={`${current.subjects.length} disciplinas na taxonomia`}
                  >
                    <div className="item-list">
                      {current.subjects.slice(0, 4).map((sub) => (
                        <div key={sub.id} className="item-row">
                          <span>{sub.title}</span>
                          <Badge>
                            {current.topics.filter((t) => t.subject_id === sub.id).length} tópicos
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                );
              }

              if (baseKey === 'accuracy-by-topic') {
                const topicEntries = Object.entries(current.projection.attempts_by_topic);
                return (
                  <SurfaceCard
                    key={widgetSpec}
                    title={widgetEntry.label}
                    subtitle="Projeção analítica de tentativas"
                  >
                    {topicEntries.length === 0 ? (
                      <p className="ui-card__subtitle">
                        Registre respostas na aba Prática para alimentar a projeção.
                      </p>
                    ) : (
                      <div className="item-list">
                        {topicEntries.map(([tId, stats]) => {
                          const topic = current.topics.find((t) => t.id === tId);
                          return (
                            <div key={tId} className="item-row">
                              <span>{topic?.title ?? tId.slice(0, 8)}</span>
                              <Badge tone={stats.accuracy >= 0.7 ? 'success' : 'warning'}>
                                {Math.round(stats.accuracy * 100)}% ({stats.correct}/{stats.total})
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SurfaceCard>
                );
              }

              return (
                <SurfaceCard
                  key={widgetSpec}
                  title={widgetEntry.label}
                  subtitle={`Configuração: ${widgetSpec}`}
                >
                  <p className="ui-card__subtitle">{widgetEntry.description}</p>
                </SurfaceCard>
              );
            })}
          </div>

          <SurfaceCard
            title="Arquitetura Orientada a Metadados"
            subtitle="Este painel não possui nenhuma condicional por template (R-42, R-43)"
          >
            <p className="ui-card__subtitle">
              Troque o workspace no seletor superior para ver tipos de compromisso, campos
              customizados, taxonomia, geradores e regras mudarem instantaneamente a partir da cópia
              versionada do template (ADR-0006, R-15).
            </p>
          </SurfaceCard>
        </div>
      )}

      {/* ABA 2: AGENDA & FORMULÁRIO GERADO POR METADADOS (FieldTypeViewRegistry — R-42) */}
      {activeTab === 'calendar' && (
        <div className="split-layout">
          <SurfaceCard
            title="Novo Compromisso"
            subtitle="Formulário gerado a partir de EventType + FieldTypeViewRegistry (R-42)"
          >
            <form className="form-stack" onSubmit={handleCreateEvent}>
              <div className="form-field">
                <label className="form-field__label">
                  <span>Tipo de Evento (do Template)</span>
                  <span className="ui-mono">{activeEventTypeDef?.key}</span>
                </label>
                <select
                  className="ui-select"
                  value={activeEventTypeDef?.key ?? ''}
                  onChange={(e) => {
                    setSelectedEventTypeKey(e.target.value);
                    setCustomFieldValues({});
                  }}
                >
                  {availableEventTypes.map((et) => (
                    <option key={et.key} value={et.key}>
                      {et.label} ({et.defaultDurationMin} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-field__label">Título / Descrição</label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder={activeEventTypeDef?.label ?? 'Compromisso'}
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-field__label">Início</label>
                <input
                  type="datetime-local"
                  className="ui-input"
                  value={eventDateISO}
                  onChange={(e) => setEventDateISO(e.target.value)}
                />
              </div>

              {/* Renderização dinâmica de cada campo customizado via FieldTypeViewRegistry */}
              {(activeEventTypeDef?.fields ?? []).map((fieldDef: TemplateFieldDefinition) => {
                const viewEntry = FieldTypeViewRegistry.get(fieldDef.type);
                if (!viewEntry) return null;
                const EditorComponent = viewEntry.Editor;
                const currentVal =
                  customFieldValues[fieldDef.key] ??
                  (fieldDef.options ? fieldDef.options[0] : fieldDef.default ?? '');

                return (
                  <div key={fieldDef.key} className="form-field">
                    <label className="form-field__label">
                      <span>{fieldDef.label ?? fieldDef.key}</span>
                      <span className="ui-mono">
                        {fieldDef.type}
                        {fieldDef.analyzable ? ' · analisável' : ''}
                      </span>
                    </label>
                    <EditorComponent
                      config={fieldDef}
                      value={currentVal}
                      onChange={(val: unknown) =>
                        setCustomFieldValues((prev) => ({ ...prev, [fieldDef.key]: val }))
                      }
                    />
                  </div>
                );
              })}

              <div className="privacy-notice">
                Aviso de Privacidade (R-51 / L-07): Nunca registre dados pessoais ou sensíveis de
                terceiros em campos customizados.
              </div>

              <Button type="submit" variant="primary">
                Agendar Compromisso
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard
            title="Compromissos e Bloqueios na Agenda"
            subtitle="Inclui períodos bloqueados automaticamente por regras (R-31)"
            headerRight={
              <Button variant="secondary" onClick={handleExportIcs}>
                Exportar .ics
              </Button>
            }
          >
            {current.events.length === 0 ? (
              <p className="ui-card__subtitle">
                Nenhum compromisso registrado ainda. Crie um ao lado para testar os campos
                customizados e o disparo automático de regras na Outbox.
              </p>
            ) : (
              <div className="item-list">
                {current.events.map((ev) => (
                  <div key={ev.id} className="item-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{ev.title}</strong>
                        <Badge tone={ev.is_blocked_period ? 'warning' : 'neutral'}>
                          {ev.event_type_key}
                        </Badge>
                        <RuleOriginBadge ruleName={ev.created_by_rule_id} />
                      </div>
                      <div className="ui-card__subtitle ui-mono" style={{ marginTop: 4 }}>
                        {new Date(ev.start_at).toLocaleString('pt-BR')} →{' '}
                        {new Date(ev.end_at).toLocaleString('pt-BR')}
                      </div>
                      {Object.keys(ev.custom_fields).length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {Object.entries(ev.custom_fields).map(([k, v]) => (
                            <span key={k} className="ui-pill">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ABA 3: ESTUDOS & GERADOR DE CRONOGRAMA DETERMINÍSTICO (R-24) */}
      {activeTab === 'study' && (
        <div className="split-layout">
          <SurfaceCard
            title="Geradores de Cronograma (GeneratorRegistry)"
            subtitle="Execução determinística dado o mesmo estado e parâmetros (R-24)"
          >
            <div className="form-stack">
              {GeneratorRegistry.values().map((gen) => (
                <div key={gen.key} className="item-row">
                  <div>
                    <strong>{gen.label}</strong>
                    <span className="ui-mono" style={{ marginLeft: 8 }}>
                      ({gen.key})
                    </span>
                    <p className="ui-card__subtitle">{gen.description}</p>
                  </div>
                  <Button variant="secondary" onClick={() => handleRunGenerator(gen.key)}>
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Itens de Estudo Planejados"
            subtitle="Marque itens como concluídos ou veja itens criados por regras (R-31)"
          >
            <div className="item-list">
              {current.studyItems.map((item) => (
                <div key={item.id} className="item-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          textDecoration: item.status === 'done' ? 'line-through' : 'none',
                          color: item.status === 'done' ? 'var(--text-muted)' : 'inherit',
                          fontWeight: 500,
                        }}
                      >
                        {item.title}
                      </span>
                      <Badge>{item.item_type_key}</Badge>
                      <RuleOriginBadge ruleName={item.created_by_rule_id} />
                    </div>
                    <span className="ui-mono" style={{ color: 'var(--text-muted)' }}>
                      Data prevista: {item.scheduled_date}
                    </span>
                  </div>
                  <Button
                    variant={item.status === 'done' ? 'secondary' : 'primary'}
                    onClick={() => handleToggleStudyItem(item.id)}
                  >
                    {item.status === 'done' ? 'Concluído ✓' : 'Concluir'}
                  </Button>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ABA 4: PRÁTICA — QUESTÕES & REPETIÇÃO ESPAÇADA FSRS (ADR-0007) */}
      {activeTab === 'practice' && (
        <div className="split-layout">
          <SurfaceCard
            title="Repetição Espaçada (FSRS — ADR-0007)"
            subtitle="Calcula estabilidade (S) e dificuldade (D) determinísticas"
          >
            <div className="form-stack">
              {current.cards.map((card) => {
                const isRevealed = revealedCardId === card.id;
                return (
                  <div key={card.id} className="ui-card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Badge>S={card.stability}d · D={card.difficulty}</Badge>
                      <span className="ui-mono">
                        Revisão: {card.due_at.slice(0, 10)} (reps: {card.reps})
                      </span>
                    </div>
                    <p style={{ fontWeight: 500, marginBottom: 8 }}>{card.front}</p>
                    {isRevealed ? (
                      <div>
                        <p
                          style={{
                            padding: 10,
                            background: 'var(--bg-subtle)',
                            borderRadius: 6,
                            marginBottom: 10,
                          }}
                        >
                          {card.back}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button onClick={() => handleReviewCard(card.id, 1)}>1 · Errei</Button>
                          <Button onClick={() => handleReviewCard(card.id, 2)}>2 · Difícil</Button>
                          <Button variant="primary" onClick={() => handleReviewCard(card.id, 3)}>
                            3 · Bom
                          </Button>
                          <Button onClick={() => handleReviewCard(card.id, 4)}>4 · Fácil</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="secondary" onClick={() => setRevealedCardId(card.id)}>
                        Mostrar Resposta
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Registro de Tentativas por Tópico"
            subtitle="Emite evento AttemptRegistered.v1 para Rules e Analytics (R-08, R-09)"
          >
            <div className="item-list">
              {current.topics.map((topic) => {
                const stats = current.projection.attempts_by_topic[topic.id];
                return (
                  <div key={topic.id} className="item-row">
                    <div>
                      <strong>{topic.title}</strong>
                      <div className="ui-mono" style={{ color: 'var(--text-muted)' }}>
                        Peso: {topic.weight} ·{' '}
                        {stats
                          ? `Acertos: ${stats.correct}/${stats.total} (${Math.round(stats.accuracy * 100)}%)`
                          : 'Sem tentativas'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="primary"
                        onClick={() => handleLogQuestionAttempt(topic.id, true)}
                      >
                        + Acerto
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleLogQuestionAttempt(topic.id, false)}
                      >
                        + Erro
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ABA 5: NOTAS EM MARKDOWN SANITIZADO (R-49, R-56) */}
      {activeTab === 'notes' && (
        <div className="split-layout">
          <SurfaceCard
            title="Nova Anotação (Módulo de Referência — R-56)"
            subtitle="Texto livre sanitizado sem HTML bruto (R-49)"
          >
            <form className="form-stack" onSubmit={handleAddNote}>
              <div className="form-field">
                <label className="form-field__label">Título</label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="Resumo do tópico..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-field__label">Conteúdo Markdown (máx 100.000 caracteres)</label>
                <textarea
                  className="ui-textarea"
                  placeholder="Escreva suas anotações de estudo..."
                  value={noteMarkdown}
                  onChange={(e) => setNoteMarkdown(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary">
                Salvar Nota
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard title="Caderno de Anotações" subtitle="Isolado por workspace_id (R-35)">
            {current.notes.length === 0 ? (
              <p className="ui-card__subtitle">Nenhuma nota registrada neste workspace.</p>
            ) : (
              <div className="item-list">
                {current.notes.map((n) => (
                  <div key={n.id} className="item-row">
                    <div>
                      <strong>{n.title}</strong>
                      <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.content_markdown}</p>
                    </div>
                    <span className="ui-mono">{n.created_at.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ABA 6: MOTOR DE REGRAS (when -> if -> then) & EXECUÇÕES DA OUTBOX (§9) */}
      {activeTab === 'rules' && (
        <div className="split-layout">
          <SurfaceCard
            title="Regras de Automação do Workspace (§9)"
            subtitle="Combinação de TriggerRegistry + ConditionRegistry + ActionRegistry (P2)"
          >
            <div className="item-list">
              {current.rules.map((rule) => (
                <div key={rule.id} className="item-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{rule.name}</strong>
                      <Badge tone={rule.enabled ? 'success' : 'neutral'}>
                        {rule.enabled ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="ui-mono" style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                      QUANDO {rule.when.trigger} · SE{' '}
                      {rule.if.map((c) => `${c.condition}(${JSON.stringify(c.params)})`).join(' E ')}{' '}
                      · ENTÃO {rule.then.map((a) => a.action).join(', ')}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateCurrentWorkspace((prev) => ({
                        ...prev,
                        rules: prev.rules.map((r) =>
                          r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                        ),
                      }))
                    }
                  >
                    {rule.enabled ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Histórico de Execuções (rule_executions — §9.2)"
            subtitle="Rastreia correlation_id, depth <= 3 (R-29) e idempotência (R-28)"
          >
            {current.ruleLogs.length === 0 ? (
              <p className="ui-card__subtitle">
                Nenhuma regra disparada ainda. Agende um evento ou registre tentativas para acionar
                gatilhos correspondentes.
              </p>
            ) : (
              <div className="item-list">
                {current.ruleLogs.map((log) => (
                  <div key={log.id} className="item-row">
                    <div>
                      <strong>{log.rule_name}</strong>
                      <div className="ui-mono" style={{ color: 'var(--text-muted)' }}>
                        status: {log.status} · depth: {log.depth} · evento:{' '}
                        {log.source_event_id.slice(0, 8)}
                      </div>
                      {log.effects.map((eff, i) => (
                        <div key={i} className="ui-pill" style={{ marginTop: 4 }}>
                          {eff.summary}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}
    </div>
  );
}
