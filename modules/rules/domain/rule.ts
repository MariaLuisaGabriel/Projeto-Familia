/**
 * modules/rules/domain
 * Responsável por (§4.1, §9): Avaliação e execução de regras do usuário (when -> if -> then).
 * Regras atendidas: R-01, R-28, R-29, R-30, R-31, R-32, R-33.
 */
import {
  type WorkspaceScopedEntity,
  type DomainEvent,
  type UUIDv7,
  createBaseEntityFields,
  assertWithinLimit,
  WORKSPACE_LIMITS,
} from '@estudos/core';
import {
  TriggerRegistry,
  ConditionRegistry,
  ActionRegistry,
  type PlannedRuleActionEffect,
} from '@estudos/registries';
import type { TemplateRuleSeed } from '@estudos/template-schema';

export interface UserRule extends WorkspaceScopedEntity {
  readonly rule_key: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly consecutive_failures: number; // R-33: desativa automaticamente ao atingir 5
  readonly disabled_reason: string | null;
  readonly when: { readonly trigger: string };
  readonly if: readonly { readonly condition: string; readonly params: Record<string, unknown> }[];
  readonly then: readonly { readonly action: string; readonly params: Record<string, unknown> }[];
}

export type RuleExecutionStatus =
  | 'executed'
  | 'skipped_conditions'
  | 'blocked_max_depth'
  | 'blocked_cycle'
  | 'failed';

export interface RuleExecutionLog extends WorkspaceScopedEntity {
  readonly rule_id: UUIDv7;
  readonly rule_name: string;
  readonly source_event_id: UUIDv7;
  readonly correlation_id: UUIDv7;
  readonly depth: number;
  readonly status: RuleExecutionStatus;
  readonly effects: readonly PlannedRuleActionEffect[];
  readonly error_message?: string | null;
}

export function createUserRuleFromSeed(workspaceId: UUIDv7, seed: TemplateRuleSeed): UserRule {
  assertWithinLimit('Condições por regra', seed.if.length, WORKSPACE_LIMITS.MAX_CONDITIONS_PER_RULE);
  assertWithinLimit('Ações por regra', seed.then.length, WORKSPACE_LIMITS.MAX_ACTIONS_PER_RULE);

  const base = createBaseEntityFields(workspaceId);
  return {
    ...base,
    rule_key: seed.id,
    name: seed.name,
    enabled: seed.enabled,
    consecutive_failures: 0,
    disabled_reason: null,
    when: seed.when,
    if: seed.if,
    then: seed.then,
  };
}

/**
 * Avalia de forma determinística (R-24) se uma regra deve disparar para o evento recebido,
 * respeitando os limites de profundidade (R-29) e prevenção de ciclo por correlation_id (R-30).
 */
export function evaluateRuleAgainstEvent(params: {
  rule: UserRule;
  event: DomainEvent;
   priorExecutionsInCorrelationChain: readonly RuleExecutionLog[];
}): {
  status: RuleExecutionStatus;
  plannedEffects: readonly PlannedRuleActionEffect[];
} {
  const { rule, event, priorExecutionsInCorrelationChain } = params;

  // Verifica se o gatilho corresponde ao tipo do evento de domínio
  const triggerEntry = TriggerRegistry.get(rule.when.trigger);
  if (!triggerEntry || triggerEntry.domainEventType !== event.type) {
    return { status: 'skipped_conditions', plannedEffects: [] };
  }

  // R-29: Uma execução com depth acima do limite (3) DEVE ser interrompida e registrada como bloqueada.
  if (event.depth >= WORKSPACE_LIMITS.MAX_RULE_CHAIN_DEPTH) {
    return { status: 'blocked_max_depth', plannedEffects: [] };
  }

  // R-30: Uma regra NÃO DEVE disparar a si mesma, direta ou indiretamente, na mesma cadeia de correlation_id.
  const alreadyFiredInChain = priorExecutionsInCorrelationChain.some(
    (log) =>
      log.correlation_id === event.correlation_id &&
      log.rule_id === rule.id &&
      log.status === 'executed'
  );
  if (alreadyFiredInChain) {
    return { status: 'blocked_cycle', plannedEffects: [] };
  }

  // §9.1: Condições em `if` são combinadas por E (AND).
  const entityTypeKey = String(
    event.payload.eventTypeKey ?? event.payload.itemTypeKey ?? ''
  );
  const customFields = (event.payload.customFields as Record<string, unknown>) ?? {};
  const accuracyRate =
    typeof event.payload.accuracyRate === 'number' ? event.payload.accuracyRate : undefined;

  for (const condSpec of rule.if) {
    const condEntry = ConditionRegistry.getOrThrow(condSpec.condition);
    const matched = condEntry.evaluate(condSpec.params, {
      entityTypeKey,
      customFields,
      metrics: { accuracyRate },
    });
    if (!matched) {
      return { status: 'skipped_conditions', plannedEffects: [] };
    }
  }

  // Planeja efeitos via ActionRegistry (R-32: apenas criar, reagendar, bloquear e notificar)
  const plannedEffects = rule.then.map((actionSpec) => {
    const actionEntry = ActionRegistry.getOrThrow(actionSpec.action);
    return actionEntry.planEffect(actionSpec.params, event.payload);
  });

  return { status: 'executed', plannedEffects };
}

/**
 * R-33: Uma regra que falhar 5 vezes seguidas DEVE ser desativada automaticamente, com aviso ao usuário.
 */
export function recordRuleFailure(rule: UserRule, errorMessage: string): UserRule {
  const nextFailures = rule.consecutive_failures + 1;
  const shouldDisable = nextFailures >= 5;
  return {
    ...rule,
    consecutive_failures: nextFailures,
    enabled: shouldDisable ? false : rule.enabled,
    disabled_reason: shouldDisable
      ? `Desativada automaticamente após 5 falhas consecutivas (R-33): ${errorMessage}`
      : rule.disabled_reason,
    updated_at: new Date().toISOString(),
  };
}
