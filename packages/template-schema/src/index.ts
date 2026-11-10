/**
 * @estudos/template-schema
 * Meta-schema declarativo e validador de templates (§6).
 * Regras atendidas: R-12, R-13, R-14, R-15, R-16, R-18, R-19, R-51.
 */
import { WORKSPACE_LIMITS } from '@estudos/core';
import {
  FieldTypeRegistry,
  GeneratorRegistry,
  TriggerRegistry,
  ConditionRegistry,
  ActionRegistry,
  isValidWidgetSpec,
} from '@estudos/registries';

export interface TemplateFieldDefinition {
  readonly key: string;
  readonly label?: string;
  readonly type: string;
  readonly required?: boolean;
  readonly analyzable?: boolean;
  readonly options?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly unit?: string;
  readonly default?: unknown;
}

export interface TemplateEventTypeDefinition {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly color?: string;
  readonly defaultDurationMin: number;
  readonly fields: readonly TemplateFieldDefinition[];
}

export interface TemplateItemTypeDefinition {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly fields: readonly TemplateFieldDefinition[];
}

export interface TemplateTopicSeed {
  readonly key: string;
  readonly title: string;
  readonly weight?: number;
}

export interface TemplateSubjectSeed {
  readonly key: string;
  readonly title: string;
  readonly color?: string;
  readonly topics: readonly TemplateTopicSeed[];
}

export interface TemplateGeneratorConfig {
  readonly kind: string;
  readonly params: Record<string, unknown>;
}

export interface TemplateRuleSeed {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean; // §6.1: regras sugeridas (desativadas por padrão)
  readonly when: { readonly trigger: string };
  readonly if: readonly { readonly condition: string; readonly params: Record<string, unknown> }[];
  readonly then: readonly { readonly action: string; readonly params: Record<string, unknown> }[];
}

export interface StudyTemplateManifest {
  readonly id: string;
  readonly version: string; // SemVer
  readonly name: string;
  readonly description?: string;
  readonly eventTypes: readonly TemplateEventTypeDefinition[];
  readonly itemTypes?: readonly TemplateItemTypeDefinition[];
  readonly taxonomy?: readonly TemplateSubjectSeed[];
  readonly generators: readonly TemplateGeneratorConfig[];
  readonly suggestedRules?: readonly TemplateRuleSeed[];
  readonly dashboard: readonly string[];
}

export interface TemplateValidationReport {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const FORBIDDEN_CODE_OR_HTML_REGEX = /(<script|<style|<\/?[a-z][\s\S]*?>|javascript:|eval\s*\(|Function\s*\()/i;
// L-07 / R-51: Proibir campos de dados sensíveis de pacientes ou terceiros
const FORBIDDEN_THIRD_PARTY_PII_KEYS = /^(cpf_paciente|nome_paciente|prontuario|rg_paciente|telefone_paciente)$/i;

function containsExecutableOrHtml(value: unknown): boolean {
  if (typeof value === 'string') {
    return FORBIDDEN_CODE_OR_HTML_REGEX.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsExecutableOrHtml);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsExecutableOrHtml);
  }
  return false;
}

function validateFieldsList(
  ownerLabel: string,
  fields: readonly TemplateFieldDefinition[],
  errors: string[]
): void {
  if (fields.length > WORKSPACE_LIMITS.MAX_FIELDS_PER_TYPE) {
    errors.push(
      `${ownerLabel}: possui ${fields.length} campos, acima do limite de ${WORKSPACE_LIMITS.MAX_FIELDS_PER_TYPE} (§8.2).`
    );
  }
  let analyzableCount = 0;
  const seenKeys = new Set<string>();

  for (const field of fields) {
    if (!field.key || typeof field.key !== 'string') {
      errors.push(`${ownerLabel}: campo sem "key" válida.`);
      continue;
    }
    if (seenKeys.has(field.key)) {
      errors.push(`${ownerLabel}: campo duplicado "${field.key}".`);
    }
    seenKeys.add(field.key);

    if (FORBIDDEN_THIRD_PARTY_PII_KEYS.test(field.key)) {
      errors.push(
        `${ownerLabel}.${field.key}: proibido sugerir campo para dados sensíveis ou identificáveis de terceiros (L-07, R-51).`
      );
    }

    const fieldEntry = FieldTypeRegistry.get(field.type);
    if (!fieldEntry) {
      errors.push(
        `${ownerLabel}.${field.key}: tipo de campo desconhecido "${field.type}" no FieldTypeRegistry (R-14).`
      );
      continue;
    }

    if (field.analyzable) {
      analyzableCount++;
      if (!fieldEntry.isAnalyzable) {
        errors.push(`${ownerLabel}.${field.key}: o tipo "${field.type}" não suporta análise/indexação (L-06).`);
      }
    }

    const cfgCheck = fieldEntry.validateConfig(field);
    if (!cfgCheck.valid) {
      for (const err of cfgCheck.errors) {
        errors.push(`${ownerLabel}.${field.key}: ${err}`);
      }
    }
  }

  if (analyzableCount > WORKSPACE_LIMITS.MAX_ANALYZABLE_FIELDS_PER_TYPE) {
    errors.push(
      `${ownerLabel}: possui ${analyzableCount} campos analisáveis, acima do limite de ${WORKSPACE_LIMITS.MAX_ANALYZABLE_FIELDS_PER_TYPE} (§8.2).`
    );
  }
}

/**
 * R-12, R-13, R-14, R-51: Valida um template contra o meta-schema e todos os registros.
 */
export function validateTemplateManifest(candidate: unknown): TemplateValidationReport {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Template deve ser um objeto JSON válido (R-12).'] };
  }

  if (containsExecutableOrHtml(candidate)) {
    errors.push('Template NÃO DEVE conter código executável, expressões avaliáveis, HTML ou CSS (R-13).');
  }

  const tpl = candidate as Partial<StudyTemplateManifest>;

  if (!tpl.id || typeof tpl.id !== 'string') {
    errors.push('Campo obrigatório "id" ausente ou inválido.');
  }
  if (!tpl.version || typeof tpl.version !== 'string' || !SEMVER_REGEX.test(tpl.version)) {
    errors.push('Campo obrigatório "version" deve seguir SemVer ex: "1.0.0" (§6.1).');
  }
  if (!tpl.name || typeof tpl.name !== 'string') {
    errors.push('Campo obrigatório "name" ausente ou inválido.');
  }

  // EventTypes
  if (!Array.isArray(tpl.eventTypes) || tpl.eventTypes.length === 0) {
    errors.push('Template deve declarar ao menos um tipo em "eventTypes".');
  } else {
    if (tpl.eventTypes.length > WORKSPACE_LIMITS.MAX_EVENT_TYPES) {
      errors.push(`eventTypes excede o limite de ${WORKSPACE_LIMITS.MAX_EVENT_TYPES} (§8.2).`);
    }
    for (const et of tpl.eventTypes) {
      if (!et.key || !et.label) {
        errors.push('Todo eventType exige "key" e "label".');
      }
      validateFieldsList(`eventType(${et.key})`, et.fields ?? [], errors);
    }
  }

  // ItemTypes (opcional, mas validado se presente)
  if (tpl.itemTypes) {
    if (tpl.itemTypes.length > WORKSPACE_LIMITS.MAX_ITEM_TYPES) {
      errors.push(`itemTypes excede o limite de ${WORKSPACE_LIMITS.MAX_ITEM_TYPES} (§8.2).`);
    }
    for (const it of tpl.itemTypes) {
      if (!it.key || !it.label) {
        errors.push('Todo itemType exige "key" e "label".');
      }
      validateFieldsList(`itemType(${it.key})`, it.fields ?? [], errors);
    }
  }

  // Generators (R-14)
  if (!Array.isArray(tpl.generators) || tpl.generators.length === 0) {
    errors.push('Template deve declarar ao menos um gerador em "generators".');
  } else {
    for (const gen of tpl.generators) {
      if (!GeneratorRegistry.has(gen.kind)) {
        errors.push(`Gerador desconhecido "${gen.kind}" no GeneratorRegistry (R-14).`);
      }
    }
  }

  // Suggested Rules (R-14 + §8.2)
  if (tpl.suggestedRules) {
    if (tpl.suggestedRules.length > WORKSPACE_LIMITS.MAX_ACTIVE_RULES) {
      errors.push(`suggestedRules excede o limite de ${WORKSPACE_LIMITS.MAX_ACTIVE_RULES}.`);
    }
    for (const rule of tpl.suggestedRules) {
      if (!TriggerRegistry.has(rule.when?.trigger)) {
        errors.push(`Regra "${rule.id}": gatilho desconhecido "${rule.when?.trigger}" no TriggerRegistry (R-14).`);
      }
      if ((rule.if?.length ?? 0) > WORKSPACE_LIMITS.MAX_CONDITIONS_PER_RULE) {
        errors.push(`Regra "${rule.id}": excede ${WORKSPACE_LIMITS.MAX_CONDITIONS_PER_RULE} condições (§8.2).`);
      }
      for (const cond of rule.if ?? []) {
        if (!ConditionRegistry.has(cond.condition)) {
          errors.push(`Regra "${rule.id}": condição desconhecida "${cond.condition}" no ConditionRegistry (R-14).`);
        }
      }
      if ((rule.then?.length ?? 0) > WORKSPACE_LIMITS.MAX_ACTIONS_PER_RULE) {
        errors.push(`Regra "${rule.id}": excede ${WORKSPACE_LIMITS.MAX_ACTIONS_PER_RULE} ações (§8.2).`);
      }
      for (const act of rule.then ?? []) {
        if (!ActionRegistry.has(act.action)) {
          errors.push(`Regra "${rule.id}": ação desconhecida "${act.action}" no ActionRegistry (R-14).`);
        }
      }
    }
  }

  // Dashboard Widgets (R-14 + §8.2)
  if (!Array.isArray(tpl.dashboard) || tpl.dashboard.length === 0) {
    errors.push('Template deve declarar widgets em "dashboard".');
  } else {
    if (tpl.dashboard.length > WORKSPACE_LIMITS.MAX_DASHBOARD_WIDGETS) {
      errors.push(`dashboard excede o limite de ${WORKSPACE_LIMITS.MAX_DASHBOARD_WIDGETS} widgets (§8.2).`);
    }
    for (const widgetSpec of tpl.dashboard) {
      if (!isValidWidgetSpec(widgetSpec)) {
        errors.push(`Widget desconhecido ou inválido "${widgetSpec}" no WidgetRegistry (R-14).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * R-16: Calcula o diff declarativo entre duas versões de um template para que o usuário
 * possa revisar campo a campo sem sobrescrever customizações automaticamente (P5).
 */
export interface TemplateDiffSummary {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly addedEventTypes: readonly string[];
  readonly addedItemTypes: readonly string[];
  readonly addedFields: readonly { ownerKey: string; fieldKey: string }[];
}

export function diffTemplateVersions(
  current: StudyTemplateManifest,
  incoming: StudyTemplateManifest
): TemplateDiffSummary {
  const currentEventKeys = new Set(current.eventTypes.map((e) => e.key));
  const addedEventTypes = incoming.eventTypes.filter((e) => !currentEventKeys.has(e.key)).map((e) => e.key);

  const currentItemKeys = new Set((current.itemTypes ?? []).map((i) => i.key));
  const addedItemTypes = (incoming.itemTypes ?? []).filter((i) => !currentItemKeys.has(i.key)).map((i) => i.key);

  const addedFields: { ownerKey: string; fieldKey: string }[] = [];
  for (const incomingEt of incoming.eventTypes) {
    const existingEt = current.eventTypes.find((e) => e.key === incomingEt.key);
    if (existingEt) {
      const existingFieldKeys = new Set(existingEt.fields.map((f) => f.key));
      for (const f of incomingEt.fields) {
        if (!existingFieldKeys.has(f.key)) {
          addedFields.push({ ownerKey: incomingEt.key, fieldKey: f.key });
        }
      }
    }
  }

  return {
    fromVersion: current.version,
    toVersion: incoming.version,
    addedEventTypes,
    addedItemTypes,
    addedFields,
  };
}
