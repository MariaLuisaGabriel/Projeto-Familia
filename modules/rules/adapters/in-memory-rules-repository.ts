/**
 * modules/rules/adapters
 */
import type { UUIDv7 } from '@estudos/core';
import type { UserRule, RuleExecutionLog } from '../domain/rule.ts';
import type { RulesRepositoryPort } from '../application/rules-engine.ts';

export class InMemoryRulesRepository implements RulesRepositoryPort {
  private readonly rules = new Map<string, UserRule>();
  private readonly logs = new Map<string, RuleExecutionLog>();
  private readonly processedPairs = new Set<string>();

  public async saveRule(workspaceId: UUIDv7, rule: UserRule): Promise<void> {
    this.rules.set(`${workspaceId}:${rule.id}`, rule);
  }

  public async listRules(workspaceId: UUIDv7): Promise<readonly UserRule[]> {
    return Array.from(this.rules.values()).filter(
      (r) => r.workspace_id === workspaceId && r.deleted_at === null
    );
  }

  public async saveExecutionLog(workspaceId: UUIDv7, log: RuleExecutionLog): Promise<void> {
    this.logs.set(`${workspaceId}:${log.id}`, log);
    this.processedPairs.add(`${workspaceId}:${log.rule_id}:${log.source_event_id}`);
  }

  public async listExecutionLogs(workspaceId: UUIDv7): Promise<readonly RuleExecutionLog[]> {
    return Array.from(this.logs.values())
      .filter((l) => l.workspace_id === workspaceId && l.deleted_at === null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async hasProcessedEventForRule(
    workspaceId: UUIDv7,
    ruleId: UUIDv7,
    eventId: UUIDv7
  ): Promise<boolean> {
    return this.processedPairs.has(`${workspaceId}:${ruleId}:${eventId}`);
  }
}
