/**
 * modules/rules/application
 * Motor de regras que processa a Outbox de forma idempotente (R-27, R-28) e aciona interfaces públicas
 * dos módulos donos propagando causation_id, correlation_id, depth + 1 e created_by_rule_id (R-31).
 */
import {
  type ActorContext,
  type DomainEvent,
  type UUIDv7,
  assertAuthorized,
  createBaseEntityFields,
} from '@estudos/core';
import type { TemplateRuleSeed } from '@estudos/template-schema';
import type { CalendarService } from '@estudos/calendar';
import type { StudyService } from '@estudos/study';
import {
  type UserRule,
  type RuleExecutionLog,
  createUserRuleFromSeed,
  evaluateRuleAgainstEvent,
  recordRuleFailure,
} from '../domain/rule.ts';

export interface RulesRepositoryPort {
  saveRule(workspaceId: UUIDv7, rule: UserRule): Promise<void>;
  listRules(workspaceId: UUIDv7): Promise<readonly UserRule[]>;
  saveExecutionLog(workspaceId: UUIDv7, log: RuleExecutionLog): Promise<void>;
  listExecutionLogs(workspaceId: UUIDv7): Promise<readonly RuleExecutionLog[]>;
  hasProcessedEventForRule(workspaceId: UUIDv7, ruleId: UUIDv7, eventId: UUIDv7): Promise<boolean>;
}

export class RulesEngineService {
  private readonly repo: RulesRepositoryPort;
  private readonly calendarService?: CalendarService;
  private readonly studyService?: StudyService;

  constructor(
    repo: RulesRepositoryPort,
    collaborators?: {
      calendarService?: CalendarService;
      studyService?: StudyService;
    }
  ) {
    this.repo = repo;
    this.calendarService = collaborators?.calendarService;
    this.studyService = collaborators?.studyService;
  }

  public async seedRules(
    workspaceId: UUIDv7,
    seeds: readonly TemplateRuleSeed[] = []
  ): Promise<readonly UserRule[]> {
    const created: UserRule[] = [];
    for (const seed of seeds) {
      const rule = createUserRuleFromSeed(workspaceId, seed);
      await this.repo.saveRule(workspaceId, rule);
      created.push(rule);
    }
    return created;
  }

  public async toggleRule(actor: ActorContext, ruleId: UUIDv7): Promise<UserRule | null> {
    assertAuthorized(actor, 'editor', actor.workspace_id);
    const rules = await this.repo.listRules(actor.workspace_id);
    const target = rules.find((r) => r.id === ruleId);
    if (!target) return null;

    const updated: UserRule = {
      ...target,
      enabled: !target.enabled,
      consecutive_failures: !target.enabled ? 0 : target.consecutive_failures,
      disabled_reason: !target.enabled ? null : target.disabled_reason,
      updated_at: new Date().toISOString(),
    };
    await this.repo.saveRule(actor.workspace_id, updated);
    return updated;
  }

  /**
   * §9.2 Processa um evento da Outbox de forma idempotente (R-28).
   */
  public async processDomainEvent(event: DomainEvent): Promise<readonly RuleExecutionLog[]> {
    const workspaceId = event.workspace_id;
    const rules = (await this.repo.listRules(workspaceId)).filter((r) => r.enabled);
    const existingLogs = await this.repo.listExecutionLogs(workspaceId);
    const logsCreated: RuleExecutionLog[] = [];

    for (const rule of rules) {
      // R-28: Idempotência — processar o mesmo evento duas vezes não duplica efeitos
      const alreadyHandled = await this.repo.hasProcessedEventForRule(
        workspaceId,
        rule.id,
        event.id
      );
      if (alreadyHandled) continue;

      const chainLogs = existingLogs.filter((l) => l.correlation_id === event.correlation_id);
      const evaluation = evaluateRuleAgainstEvent({
        rule,
        event,
        priorExecutionsInCorrelationChain: chainLogs,
      });

      if (evaluation.status === 'skipped_conditions') {
        continue;
      }

      try {
        if (evaluation.status === 'executed') {
          for (const effect of evaluation.plannedEffects) {
            if (effect.actionKey === 'block-period' && this.calendarService) {
              const durationStr = String(effect.payload.duration ?? 'PT12H');
              const hoursMatch = /PT(\d+)H/i.exec(durationStr);
              const hours = hoursMatch ? Number(hoursMatch[1]) : 12;
              await this.calendarService.createBlockedPeriodFromRule({
                workspace_id: workspaceId,
                title: `Descanso bloqueado (${rule.name})`,
                start_at: String(effect.payload.referenceEndISO ?? new Date().toISOString()),
                durationHours: hours,
                rule_id: rule.name, // R-31: exibe nome da regra de origem
                causation_id: event.id,
                correlation_id: event.correlation_id,
                depth: event.depth + 1,
              });
            } else if (effect.actionKey === 'create-item' && this.studyService) {
              const offsetDays = Number(effect.payload.offsetDays ?? 1);
              const targetDate = new Date(Date.now() + offsetDays * 86400000)
                .toISOString()
                .slice(0, 10);
              const systemActor: ActorContext = {
                user_id: event.id,
                workspace_id: workspaceId,
                role: 'editor',
              };
              await this.studyService.createItem(systemActor, {
                item_type_key: String(effect.payload.itemType ?? 'revisao'),
                topic_id: (effect.payload.topicId as UUIDv7 | null) ?? null,
                title: `Revisão automática (${rule.name})`,
                scheduled_date: targetDate,
                created_by_rule_id: rule.name, // R-31
              });
            }
          }
        }

        const execLog: RuleExecutionLog = {
          ...createBaseEntityFields(workspaceId),
          rule_id: rule.id,
          rule_name: rule.name,
          source_event_id: event.id,
          correlation_id: event.correlation_id,
          depth: event.depth + 1,
          status: evaluation.status,
          effects: evaluation.plannedEffects,
          error_message: null,
        };
        await this.repo.saveExecutionLog(workspaceId, execLog);
        logsCreated.push(execLog);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        const updatedRule = recordRuleFailure(rule, msg);
        await this.repo.saveRule(workspaceId, updatedRule);

        const failLog: RuleExecutionLog = {
          ...createBaseEntityFields(workspaceId),
          rule_id: rule.id,
          rule_name: rule.name,
          source_event_id: event.id,
          correlation_id: event.correlation_id,
          depth: event.depth + 1,
          status: 'failed',
          effects: [],
          error_message: msg,
        };
        await this.repo.saveExecutionLog(workspaceId, failLog);
        logsCreated.push(failLog);
      }
    }

    return logsCreated;
  }
}
