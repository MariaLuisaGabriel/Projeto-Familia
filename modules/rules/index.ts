/**
 * Interface pública do módulo @estudos/rules (R-03)
 */
export {
  type UserRule,
  type RuleExecutionStatus,
  type RuleExecutionLog,
  createUserRuleFromSeed,
  evaluateRuleAgainstEvent,
  recordRuleFailure,
} from './domain/rule.ts';
export { type RulesRepositoryPort, RulesEngineService } from './application/rules-engine.ts';
export { InMemoryRulesRepository } from './adapters/in-memory-rules-repository.ts';
