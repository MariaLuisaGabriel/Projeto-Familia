/**
 * @estudos/registries
 * Catálogos fechados de pontos de extensão (§7).
 * Regras atendidas: R-06, R-20, R-21, R-22, R-23, R-24, R-36, R-37.
 */
import { WORKSPACE_LIMITS } from '@estudos/core';

export interface JSONSchema {
  readonly type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  readonly properties?: Record<string, JSONSchema>;
  readonly required?: readonly string[];
  readonly enum?: readonly (string | number)[];
  readonly items?: JSONSchema;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly maxItems?: number;
  readonly format?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * §7.1 Contrato de um tipo de campo (domínio compartilhado cliente + servidor — R-21)
 */
export interface FieldType<TConfig = Record<string, unknown>, TValue = unknown> {
  readonly key: string;
  readonly label: string;
  readonly configSchema: JSONSchema;
  valueSchema(config: TConfig): JSONSchema;
  defaultValue(config: TConfig): TValue | null;
  readonly isAnalyzable: boolean;
  toIndexExpression?(fieldPath: string): string;
  validateConfig(config: unknown): ValidationResult;
  validateValue(config: TConfig, value: unknown): ValidationResult;
}

export class ClosedRegistry<TEntry extends { readonly key: string }> {
  private readonly entries = new Map<string, TEntry>();
  public readonly name: string;

  constructor(name: string, initialEntries: readonly TEntry[] = []) {
    this.name = name;
    for (const entry of initialEntries) {
      this.register(entry);
    }
  }

  public register(entry: TEntry): this {
    if (!entry.key || typeof entry.key !== 'string') {
      throw new Error(`[${this.name}] Entrada de registro inválida: key obrigatória (R-20).`);
    }
    if (this.entries.has(entry.key)) {
      throw new Error(`[${this.name}] Chave duplicada no registro: "${entry.key}" (R-20).`);
    }
    this.entries.set(entry.key, entry);
    return this;
  }

  public get(key: string): TEntry | undefined {
    return this.entries.get(key);
  }

  public getOrThrow(key: string): TEntry {
    const found = this.entries.get(key);
    if (!found) {
      throw new Error(`[${this.name}] Entrada não registrada: "${key}" (R-14).`);
    }
    return found;
  }

  public has(key: string): boolean {
    return this.entries.has(key);
  }

  public keys(): string[] {
    return Array.from(this.entries.keys());
  }

  public values(): TEntry[] {
    return Array.from(this.entries.values());
  }
}

// ============================================================================
// 1. FieldTypeRegistry (12 tipos iniciais da tabela §7)
// ============================================================================

export interface SelectFieldConfig {
  readonly options: readonly string[];
  readonly default?: string;
}

export interface NumberFieldConfig {
  readonly min?: number;
  readonly max?: number;
  readonly unit?: string;
}

export interface ChecklistItemValue {
  readonly text: string;
  readonly done: boolean;
}

const textFieldType: FieldType<{ maxLength?: number }, string> = {
  key: 'text',
  label: 'Texto curto',
  configSchema: {
    type: 'object',
    properties: { maxLength: { type: 'number', minimum: 1, maximum: WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS } },
  },
  valueSchema: (cfg) => ({
    type: 'string',
    maxLength: cfg?.maxLength ?? WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS,
  }),
  defaultValue: () => '',
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->>'${fieldPath}')`,
  validateConfig: (cfg) => {
    if (cfg === undefined || cfg === null) return { valid: true, errors: [] };
    if (typeof cfg !== 'object') return { valid: false, errors: ['Config deve ser objeto.'] };
    const maxLen = (cfg as { maxLength?: unknown }).maxLength;
    if (maxLen !== undefined && (typeof maxLen !== 'number' || maxLen < 1 || maxLen > WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS)) {
      return { valid: false, errors: [`maxLength deve estar entre 1 e ${WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS}.`] };
    }
    return { valid: true, errors: [] };
  },
  validateValue: (cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (typeof val !== 'string') return { valid: false, errors: ['Valor deve ser texto (string).'] };
    const limit = cfg?.maxLength ?? WORKSPACE_LIMITS.MAX_SHORT_TEXT_CHARS;
    if (val.length > limit) {
      return { valid: false, errors: [`Texto excede o limite de ${limit} caracteres (R-26).`] };
    }
    return { valid: true, errors: [] };
  },
};

const longTextFieldType: FieldType<{ maxLength?: number }, string> = {
  key: 'long-text',
  label: 'Texto longo',
  configSchema: { type: 'object' },
  valueSchema: () => ({ type: 'string', maxLength: WORKSPACE_LIMITS.MAX_NOTE_MARKDOWN_CHARS }),
  defaultValue: () => '',
  isAnalyzable: false,
  validateConfig: (cfg) =>
    cfg === undefined || cfg === null || typeof cfg === 'object'
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['Config deve ser objeto.'] },
  validateValue: (_cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (typeof val !== 'string') return { valid: false, errors: ['Valor deve ser string.'] };
    if (val.length > WORKSPACE_LIMITS.MAX_NOTE_MARKDOWN_CHARS) {
      return { valid: false, errors: [`Texto longo excede ${WORKSPACE_LIMITS.MAX_NOTE_MARKDOWN_CHARS} caracteres.`] };
    }
    return { valid: true, errors: [] };
  },
};

const numberFieldType: FieldType<NumberFieldConfig, number> = {
  key: 'number',
  label: 'Número',
  configSchema: {
    type: 'object',
    properties: { min: { type: 'number' }, max: { type: 'number' }, unit: { type: 'string' } },
  },
  valueSchema: (cfg) => ({ type: 'number', minimum: cfg?.min, maximum: cfg?.max }),
  defaultValue: () => null,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `((custom_fields->>'${fieldPath}')::numeric)`,
  validateConfig: (cfg) => {
    if (!cfg || typeof cfg !== 'object') return { valid: true, errors: [] };
    const c = cfg as NumberFieldConfig;
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      return { valid: false, errors: ['min não pode ser maior que max.'] };
    }
    return { valid: true, errors: [] };
  },
  validateValue: (cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (typeof val !== 'number' || Number.isNaN(val)) {
      return { valid: false, errors: ['Valor deve ser numérico válido.'] };
    }
    if (cfg?.min !== undefined && val < cfg.min) {
      return { valid: false, errors: [`Valor mínimo é ${cfg.min}.`] };
    }
    if (cfg?.max !== undefined && val > cfg.max) {
      return { valid: false, errors: [`Valor máximo é ${cfg.max}.`] };
    }
    return { valid: true, errors: [] };
  },
};

const selectFieldType: FieldType<SelectFieldConfig, string> = {
  key: 'select',
  label: 'Seleção única',
  configSchema: {
    type: 'object',
    required: ['options'],
    properties: {
      options: { type: 'array', items: { type: 'string' }, maxItems: WORKSPACE_LIMITS.MAX_SELECT_OPTIONS },
    },
  },
  valueSchema: (cfg) => ({ type: 'string', enum: cfg?.options ?? [] }),
  defaultValue: (cfg) => cfg?.default ?? (cfg?.options?.[0] ?? null),
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->>'${fieldPath}')`,
  validateConfig: (cfg) => {
    if (!cfg || typeof cfg !== 'object') return { valid: false, errors: ['Configuração de select exige options.'] };
    const options = (cfg as SelectFieldConfig).options;
    if (!Array.isArray(options) || options.length === 0) {
      return { valid: false, errors: ['select exige ao menos 1 opção em options.'] };
    }
    if (options.length > WORKSPACE_LIMITS.MAX_SELECT_OPTIONS) {
      return {
        valid: false,
        errors: [`select excede o limite de ${WORKSPACE_LIMITS.MAX_SELECT_OPTIONS} opções (§8.2).`],
      };
    }
    return { valid: true, errors: [] };
  },
  validateValue: (cfg, val) => {
    if (val === null || val === undefined || val === '') return { valid: true, errors: [] };
    if (typeof val !== 'string' || !cfg.options.includes(val)) {
      return { valid: false, errors: [`Opção "${String(val)}" não pertence a [${cfg.options.join(', ')}].`] };
    }
    return { valid: true, errors: [] };
  },
};

const multiSelectFieldType: FieldType<{ options: readonly string[] }, string[]> = {
  key: 'multi-select',
  label: 'Seleção múltipla',
  configSchema: {
    type: 'object',
    required: ['options'],
    properties: {
      options: { type: 'array', items: { type: 'string' }, maxItems: WORKSPACE_LIMITS.MAX_SELECT_OPTIONS },
    },
  },
  valueSchema: (cfg) => ({ type: 'array', items: { type: 'string', enum: cfg?.options ?? [] } }),
  defaultValue: () => [],
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->'${fieldPath}')`,
  validateConfig: (cfg) => selectFieldType.validateConfig(cfg),
  validateValue: (cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (!Array.isArray(val)) return { valid: false, errors: ['multi-select exige array de strings.'] };
    const invalid = val.filter((item) => typeof item !== 'string' || !cfg.options.includes(item));
    if (invalid.length > 0) {
      return { valid: false, errors: [`Opções inválidas: ${invalid.join(', ')}.`] };
    }
    return { valid: true, errors: [] };
  },
};

const dateFieldType: FieldType<Record<string, unknown>, string> = {
  key: 'date',
  label: 'Data',
  configSchema: { type: 'object' },
  valueSchema: () => ({ type: 'string', format: 'date' }),
  defaultValue: () => null,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->>'${fieldPath}')`,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) => {
    if (val === null || val === undefined || val === '') return { valid: true, errors: [] };
    if (typeof val !== 'string' || Number.isNaN(Date.parse(val))) {
      return { valid: false, errors: ['Data inválida (use formato ISO YYYY-MM-DD).'] };
    }
    return { valid: true, errors: [] };
  },
};

const booleanFieldType: FieldType<{ default?: boolean }, boolean> = {
  key: 'boolean',
  label: 'Sim / Não',
  configSchema: { type: 'object', properties: { default: { type: 'boolean' } } },
  valueSchema: () => ({ type: 'boolean' }),
  defaultValue: (cfg) => cfg?.default ?? false,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `((custom_fields->>'${fieldPath}')::boolean)`,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    return typeof val === 'boolean'
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['Valor deve ser booleano (true/false).'] };
  },
};

const durationFieldType: FieldType<{ maxMinutes?: number }, number> = {
  key: 'duration',
  label: 'Duração (minutos)',
  configSchema: { type: 'object', properties: { maxMinutes: { type: 'number', minimum: 1 } } },
  valueSchema: (cfg) => ({ type: 'number', minimum: 0, maximum: cfg?.maxMinutes ?? 10080 }),
  defaultValue: () => 60,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `((custom_fields->>'${fieldPath}')::numeric)`,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (typeof val !== 'number' || val < 0 || !Number.isFinite(val)) {
      return { valid: false, errors: ['Duração deve ser um número não-negativo em minutos.'] };
    }
    if (cfg?.maxMinutes !== undefined && val > cfg.maxMinutes) {
      return { valid: false, errors: [`Duração máxima é ${cfg.maxMinutes} min.`] };
    }
    return { valid: true, errors: [] };
  },
};

const checklistFieldType: FieldType<Record<string, unknown>, ChecklistItemValue[]> = {
  key: 'checklist',
  label: 'Lista de verificação',
  configSchema: { type: 'object' },
  valueSchema: () => ({
    type: 'array',
    maxItems: WORKSPACE_LIMITS.MAX_CHECKLIST_ITEMS,
    items: { type: 'object' },
  }),
  defaultValue: () => [],
  isAnalyzable: false,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (!Array.isArray(val)) return { valid: false, errors: ['Checklist exige um array de itens.'] };
    if (val.length > WORKSPACE_LIMITS.MAX_CHECKLIST_ITEMS) {
      return {
        valid: false,
        errors: [`Checklist excede o limite de ${WORKSPACE_LIMITS.MAX_CHECKLIST_ITEMS} itens (§8.2).`],
      };
    }
    for (const item of val) {
      if (!item || typeof item.text !== 'string' || typeof item.done !== 'boolean') {
        return { valid: false, errors: ['Cada item da checklist deve ter { text: string, done: boolean }.'] };
      }
    }
    return { valid: true, errors: [] };
  },
};

const attachmentFieldType: FieldType<{ allowedMimeTypes?: string[] }, { name: string; sizeBytes: number; url: string }> = {
  key: 'attachment',
  label: 'Anexo',
  configSchema: { type: 'object' },
  valueSchema: () => ({ type: 'object' }),
  defaultValue: () => null,
  isAnalyzable: false,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) => {
    if (val === null || val === undefined) return { valid: true, errors: [] };
    if (typeof val !== 'object') return { valid: false, errors: ['Anexo inválido.'] };
    const att = val as { name?: unknown; sizeBytes?: unknown; url?: unknown };
    if (typeof att.name !== 'string' || typeof att.sizeBytes !== 'number') {
      return { valid: false, errors: ['Anexo exige nome e tamanho em bytes (R-50).'] };
    }
    if (att.sizeBytes > WORKSPACE_LIMITS.MAX_ATTACHMENT_BYTES) {
      return { valid: false, errors: ['Anexo excede o limite de 10 MB por arquivo (§8.2, R-50).'] };
    }
    return { valid: true, errors: [] };
  },
};

const refTopicFieldType: FieldType<Record<string, unknown>, string> = {
  key: 'ref-topic',
  label: 'Vínculo com Tópico',
  configSchema: { type: 'object' },
  valueSchema: () => ({ type: 'string' }),
  defaultValue: () => null,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->>'${fieldPath}')`,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) =>
    val === null || val === undefined || typeof val === 'string'
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['ref-topic exige ID string do tópico.'] },
};

const refEventFieldType: FieldType<Record<string, unknown>, string> = {
  key: 'ref-event',
  label: 'Vínculo com Evento',
  configSchema: { type: 'object' },
  valueSchema: () => ({ type: 'string' }),
  defaultValue: () => null,
  isAnalyzable: true,
  toIndexExpression: (fieldPath) => `(custom_fields->>'${fieldPath}')`,
  validateConfig: () => ({ valid: true, errors: [] }),
  validateValue: (_cfg, val) =>
    val === null || val === undefined || typeof val === 'string'
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['ref-event exige ID string do evento.'] },
};

export const FieldTypeRegistry = new ClosedRegistry<FieldType<any, any>>('FieldTypeRegistry', [
  textFieldType,
  longTextFieldType,
  numberFieldType,
  selectFieldType,
  multiSelectFieldType,
  dateFieldType,
  booleanFieldType,
  durationFieldType,
  checklistFieldType,
  attachmentFieldType,
  refTopicFieldType,
  refEventFieldType,
]);

// ============================================================================
// 2. GeneratorRegistry (linear, weighted, cycle, until-exam, by-performance)
// R-24: Geradores DEVEM ser determinísticos dado o mesmo estado e parâmetros.
// ============================================================================

export interface GeneratorTopicInput {
  readonly id: string;
  readonly subjectId: string;
  readonly title: string;
  readonly weight?: number;
  readonly accuracyRate?: number; // 0 a 1
}

export interface GeneratorParams {
  readonly itemsPerWeek?: number;
  readonly horizonWeeks?: number;
  readonly startDateISO?: string;
  readonly targetExamDateISO?: string;
  readonly itemTypeKey?: string;
}

export interface GeneratedScheduleSlot {
  readonly weekIndex: number;
  readonly scheduledDateISO: string;
  readonly topicId: string;
  readonly topicTitle: string;
  readonly itemTypeKey: string;
}

export interface ScheduleGeneratorEntry {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  generate(topics: readonly GeneratorTopicInput[], params: GeneratorParams): readonly GeneratedScheduleSlot[];
}

function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(`${baseISO.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const GeneratorRegistry = new ClosedRegistry<ScheduleGeneratorEntry>('GeneratorRegistry', [
  {
    key: 'linear',
    label: 'Cronograma Linear',
    description: 'Distribui tópicos em sequência uniforme pelas semanas disponíveis.',
    generate: (topics, params) => {
      if (topics.length === 0) return [];
      const perWeek = Math.max(1, Math.min(params.itemsPerWeek ?? 4, 50));
      const maxWeeks = Math.min(params.horizonWeeks ?? 52, WORKSPACE_LIMITS.MAX_GENERATOR_HORIZON_WEEKS);
      const baseDate = params.startDateISO ?? '2026-11-09';
      const itemTypeKey = params.itemTypeKey ?? 'estudo-teorico';
      const slots: GeneratedScheduleSlot[] = [];

      for (let idx = 0; idx < topics.length; idx++) {
        const weekIndex = Math.floor(idx / perWeek);
        if (weekIndex >= maxWeeks || slots.length >= WORKSPACE_LIMITS.MAX_GENERATOR_OUTPUT_COUNT) break;
        const dayOffset = weekIndex * 7 + (idx % perWeek);
        slots.push({
          weekIndex,
          scheduledDateISO: addDaysISO(baseDate, dayOffset),
          topicId: topics[idx].id,
          topicTitle: topics[idx].title,
          itemTypeKey,
        });
      }
      return slots;
    },
  },
  {
    key: 'weighted',
    label: 'Por Peso / Relevância',
    description: 'Prioriza e repete tópicos proporcionalmente ao seu peso relativo.',
    generate: (topics, params) => {
      if (topics.length === 0) return [];
      const sorted = [...topics].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1) || a.id.localeCompare(b.id));
      const perWeek = Math.max(1, params.itemsPerWeek ?? 5);
      const baseDate = params.startDateISO ?? '2026-11-09';
      const itemTypeKey = params.itemTypeKey ?? 'revisao';
      return sorted.slice(0, WORKSPACE_LIMITS.MAX_GENERATOR_OUTPUT_COUNT).map((t, idx) => {
        const weekIndex = Math.floor(idx / perWeek);
        return {
          weekIndex,
          scheduledDateISO: addDaysISO(baseDate, weekIndex * 7 + (idx % perWeek)),
          topicId: t.id,
          topicTitle: t.title,
          itemTypeKey,
        };
      });
    },
  },
  {
    key: 'cycle',
    label: 'Ciclo de Estudos',
    description: 'Alterna tópicos em blocos contínuos independentes de dia fixo.',
    generate: (topics, params) => {
      if (topics.length === 0) return [];
      const perWeek = Math.max(1, params.itemsPerWeek ?? 4);
      const horizon = Math.min(params.horizonWeeks ?? 4, WORKSPACE_LIMITS.MAX_GENERATOR_HORIZON_WEEKS);
      const baseDate = params.startDateISO ?? '2026-11-09';
      const itemTypeKey = params.itemTypeKey ?? 'ciclo';
      const totalItems = Math.min(perWeek * horizon, WORKSPACE_LIMITS.MAX_GENERATOR_OUTPUT_COUNT);
      const slots: GeneratedScheduleSlot[] = [];
      for (let i = 0; i < totalItems; i++) {
        const topic = topics[i % topics.length];
        const weekIndex = Math.floor(i / perWeek);
        slots.push({
          weekIndex,
          scheduledDateISO: addDaysISO(baseDate, weekIndex * 7 + (i % perWeek)),
          topicId: topic.id,
          topicTitle: topic.title,
          itemTypeKey,
        });
      }
      return slots;
    },
  },
  {
    key: 'until-exam',
    label: 'Reta Final até a Prova',
    description: 'Comprime os tópicos restantes dentro do intervalo até a data-alvo.',
    generate: (topics, params) => {
      if (topics.length === 0) return [];
      const baseDate = params.startDateISO ?? '2026-11-09';
      const examDate = params.targetExamDateISO ?? addDaysISO(baseDate, 56);
      const diffMs = Date.parse(`${examDate}T00:00:00Z`) - Date.parse(`${baseDate}T00:00:00Z`);
      const totalDays = Math.max(7, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const itemTypeKey = params.itemTypeKey ?? 'revisao-final';
      return topics.map((t, idx) => {
        const dayOffset = Math.floor((idx / topics.length) * totalDays);
        return {
          weekIndex: Math.floor(dayOffset / 7),
          scheduledDateISO: addDaysISO(baseDate, dayOffset),
          topicId: t.id,
          topicTitle: t.title,
          itemTypeKey,
        };
      });
    },
  },
  {
    key: 'by-performance',
    label: 'Reforço por Desempenho',
    description: 'Agenda sessões extras para tópicos com menor taxa de acerto.',
    generate: (topics, params) => {
      if (topics.length === 0) return [];
      const sorted = [...topics].sort(
        (a, b) => (a.accuracyRate ?? 0.5) - (b.accuracyRate ?? 0.5) || a.id.localeCompare(b.id)
      );
      const perWeek = Math.max(1, params.itemsPerWeek ?? 3);
      const baseDate = params.startDateISO ?? '2026-11-09';
      const itemTypeKey = params.itemTypeKey ?? 'reforco';
      return sorted.map((t, idx) => {
        const weekIndex = Math.floor(idx / perWeek);
        return {
          weekIndex,
          scheduledDateISO: addDaysISO(baseDate, weekIndex * 7 + (idx % perWeek)),
          topicId: t.id,
          topicTitle: t.title,
          itemTypeKey,
        };
      });
    },
  },
]);

// ============================================================================
// 3. TriggerRegistry (event.created, event.finished, item.completed, attempt.registered, date.approaching)
// ============================================================================

export interface TriggerEntry {
  readonly key: string;
  readonly label: string;
  readonly domainEventType: `${string}.v${number}`;
}

export const TriggerRegistry = new ClosedRegistry<TriggerEntry>('TriggerRegistry', [
  { key: 'event.created', label: 'Quando um evento é criado', domainEventType: 'EventCreated.v1' },
  { key: 'event.finished', label: 'Quando um evento termina', domainEventType: 'EventFinished.v1' },
  { key: 'item.completed', label: 'Quando um item de estudo é concluído', domainEventType: 'StudyItemCompleted.v1' },
  { key: 'attempt.registered', label: 'Quando uma questão é respondida', domainEventType: 'AttemptRegistered.v1' },
  { key: 'date.approaching', label: 'Quando uma data importante se aproxima', domainEventType: 'DateApproaching.v1' },
]);

// ============================================================================
// 4. ConditionRegistry (field-equals, field-in, rate-below, count-above, type-is)
// ============================================================================

export interface ConditionEvaluationContext {
  readonly entityTypeKey?: string;
  readonly customFields?: Record<string, unknown>;
  readonly metrics?: {
    readonly accuracyRate?: number;
    readonly count?: number;
  };
}

export interface ConditionEntry {
  readonly key: string;
  readonly label: string;
  evaluate(params: Record<string, unknown>, context: ConditionEvaluationContext): boolean;
}

export const ConditionRegistry = new ClosedRegistry<ConditionEntry>('ConditionRegistry', [
  {
    key: 'type-is',
    label: 'Tipo é igual a',
    evaluate: (params, ctx) => {
      const expected = (params.eventType ?? params.itemType ?? params.type) as string | undefined;
      return Boolean(expected && ctx.entityTypeKey === expected);
    },
  },
  {
    key: 'field-equals',
    label: 'Campo customizado é igual a',
    evaluate: (params, ctx) => {
      const field = params.field as string;
      return ctx.customFields?.[field] === params.value;
    },
  },
  {
    key: 'field-in',
    label: 'Campo customizado está entre',
    evaluate: (params, ctx) => {
      const field = params.field as string;
      const values = Array.isArray(params.values) ? params.values : [];
      return values.includes(ctx.customFields?.[field]);
    },
  },
  {
    key: 'rate-below',
    label: 'Taxa de acerto abaixo de',
    evaluate: (params, ctx) => {
      const threshold = typeof params.threshold === 'number' ? params.threshold : 0.6;
      const actual = ctx.metrics?.accuracyRate ?? 1;
      return actual < threshold;
    },
  },
  {
    key: 'count-above',
    label: 'Contagem acima de',
    evaluate: (params, ctx) => {
      const threshold = typeof params.threshold === 'number' ? params.threshold : 0;
      const actual = ctx.metrics?.count ?? 0;
      return actual > threshold;
    },
  },
]);

// ============================================================================
// 5. ActionRegistry (create-item, block-period, notify, reschedule, run-generator)
// R-32: Ações de regra NÃO DEVEM excluir dados. Apenas criar, reagendar, bloquear e notificar.
// ============================================================================

export interface PlannedRuleActionEffect {
  readonly actionKey: string;
  readonly summary: string;
  readonly payload: Record<string, unknown>;
}

export interface ActionEntry {
  readonly key: string;
  readonly label: string;
  planEffect(params: Record<string, unknown>, eventPayload: Record<string, unknown>): PlannedRuleActionEffect;
}

export const ActionRegistry = new ClosedRegistry<ActionEntry>('ActionRegistry', [
  {
    key: 'create-item',
    label: 'Criar item de estudo',
    planEffect: (params, eventPayload) => ({
      actionKey: 'create-item',
      summary: `Criar item "${String(params.itemType ?? 'revisao')}" em ${String(params.offsetDays ?? 1)} dia(s)`,
      payload: {
        itemType: params.itemType ?? 'revisao',
        offsetDays: Number(params.offsetDays ?? 1),
        topicId: params.topicId ?? eventPayload.topicId ?? null,
      },
    }),
  },
  {
    key: 'block-period',
    label: 'Bloquear período de descanso no calendário',
    planEffect: (params, eventPayload) => ({
      actionKey: 'block-period',
      summary: `Bloquear período (${String(params.duration ?? 'PT12H')}) após ${String(params.anchor ?? 'end')}`,
      payload: {
        offset: params.offset ?? 'PT0H',
        anchor: params.anchor ?? 'end',
        duration: params.duration ?? 'PT12H',
        referenceEndISO: eventPayload.endAt ?? new Date().toISOString(),
      },
    }),
  },
  {
    key: 'notify',
    label: 'Enviar lembrete no workspace',
    planEffect: (params) => ({
      actionKey: 'notify',
      summary: `Notificar: "${String(params.message ?? 'Lembrete de estudo')}"`,
      payload: { message: String(params.message ?? 'Lembrete de estudo') },
    }),
  },
  {
    key: 'reschedule',
    label: 'Reagendar itens pendentes',
    planEffect: (params) => ({
      actionKey: 'reschedule',
      summary: `Reagendar itens em +${String(params.shiftDays ?? 1)} dia(s)`,
      payload: { shiftDays: Number(params.shiftDays ?? 1) },
    }),
  },
  {
    key: 'run-generator',
    label: 'Executar gerador de cronograma',
    planEffect: (params) => ({
      actionKey: 'run-generator',
      summary: `Executar gerador "${String(params.kind ?? 'linear')}"`,
      payload: { kind: String(params.kind ?? 'linear') },
    }),
  },
]);

// ============================================================================
// 6. WidgetRegistry (progress, hours-by-subject, events-of-type, countdown, accuracy-by-topic)
// ============================================================================

export interface WidgetEntry {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly supportsParameter: boolean; // ex: "events-of-type:plantao", "upcoming:aula"
}

export const WidgetRegistry = new ClosedRegistry<WidgetEntry>('WidgetRegistry', [
  {
    key: 'progress',
    label: 'Progresso Geral',
    description: 'Percentual de tópicos e itens de estudo concluídos.',
    supportsParameter: false,
  },
  {
    key: 'hours-by-subject',
    label: 'Horas por Disciplina',
    description: 'Distribuição de horas dedicadas a cada disciplina.',
    supportsParameter: false,
  },
  {
    key: 'events-of-type',
    label: 'Contagem por Tipo de Evento',
    description: 'Resumo de compromissos filtrados por um tipo de evento do template.',
    supportsParameter: true,
  },
  {
    key: 'upcoming',
    label: 'Próximos Compromissos',
    description: 'Lista dos próximos eventos na agenda.',
    supportsParameter: true,
  },
  {
    key: 'countdown',
    label: 'Contagem Regressiva',
    description: 'Dias restantes até a meta ou exame principal.',
    supportsParameter: true,
  },
  {
    key: 'accuracy-by-topic',
    label: 'Taxa de Acerto por Tópico',
    description: 'Desempenho em questões e cartões FSRS por tópico.',
    supportsParameter: false,
  },
]);

/**
 * Valida se uma especificação de widget (ex: "progress" ou "events-of-type:plantao")
 * referencia uma entrada válida no WidgetRegistry (R-14).
 */
export function isValidWidgetSpec(spec: string): boolean {
  const [baseKey, param] = spec.split(':');
  const entry = WidgetRegistry.get(baseKey);
  if (!entry) return false;
  if (param && !entry.supportsParameter) return false;
  return true;
}
