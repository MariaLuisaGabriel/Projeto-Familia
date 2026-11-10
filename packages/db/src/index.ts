/**
 * @estudos/db
 * Definição declarativa do schema PostgreSQL (compatível com Drizzle ORM) e gerador de índices de expressão JSONB.
 * Regras atendidas: R-04, R-27, R-34, R-35, R-36, R-37, R-38, R-39, R-40.
 */

export interface TableColumnSpec {
  readonly name: string;
  readonly sqlType: 'uuid' | 'text' | 'timestamptz' | 'jsonb' | 'integer' | 'boolean' | 'numeric';
  readonly nullable: boolean;
  readonly defaultExpr?: string;
}

export interface TableSchemaSpec {
  readonly tableName: string;
  readonly ownerModule:
    | 'identity'
    | 'workspaces'
    | 'calendar'
    | 'study'
    | 'practice'
    | 'notes'
    | 'rules'
    | 'analytics';
  readonly requiresWorkspaceIsolation: boolean; // R-34, R-35
  readonly hasCustomFieldsJsonb: boolean; // R-36
  readonly columns: readonly TableColumnSpec[];
}

/**
 * Colunas obrigatórias em toda tabela de dados de usuário (R-34, R-40).
 */
export const MANDATORY_USER_TABLE_COLUMNS: readonly TableColumnSpec[] = [
  { name: 'id', sqlType: 'uuid', nullable: false },
  { name: 'workspace_id', sqlType: 'uuid', nullable: false },
  { name: 'created_at', sqlType: 'timestamptz', nullable: false, defaultExpr: ' now()' },
  { name: 'updated_at', sqlType: 'timestamptz', nullable: false, defaultExpr: 'now()' },
  { name: 'deleted_at', sqlType: 'timestamptz', nullable: true },
  { name: 'created_by_rule_id', sqlType: 'text', nullable: true }, // R-31
];

/**
 * Catálogo das tabelas do núcleo por módulo dono (R-04: cada tabela tem exatamente um módulo dono).
 */
export const CORE_TABLES: readonly TableSchemaSpec[] = [
  {
    tableName: 'accounts',
    ownerModule: 'identity',
    requiresWorkspaceIsolation: false,
    hasCustomFieldsJsonb: false,
    columns: [
      { name: 'id', sqlType: 'uuid', nullable: false },
      { name: 'email', sqlType: 'text', nullable: false },
      { name: 'display_name', sqlType: 'text', nullable: false },
      { name: 'created_at', sqlType: 'timestamptz', nullable: false },
      { name: 'updated_at', sqlType: 'timestamptz', nullable: false },
      { name: 'deleted_at', sqlType: 'timestamptz', nullable: true },
    ],
  },
  {
    tableName: 'workspace_members',
    ownerModule: 'identity',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'user_id', sqlType: 'uuid', nullable: false },
      { name: 'role', sqlType: 'text', nullable: false },
    ],
  },
  {
    tableName: 'workspaces',
    ownerModule: 'workspaces',
    requiresWorkspaceIsolation: false,
    hasCustomFieldsJsonb: false,
    columns: [
      { name: 'id', sqlType: 'uuid', nullable: false },
      { name: 'name', sqlType: 'text', nullable: false },
      { name: 'timezone', sqlType: 'text', nullable: false, defaultExpr: "'America/Sao_Paulo'" }, // R-40
      { name: 'template_id', sqlType: 'text', nullable: false }, // R-15
      { name: 'template_version', sqlType: 'text', nullable: false }, // R-15
      { name: 'metadata_snapshot', sqlType: 'jsonb', nullable: false }, // R-15
      { name: 'created_at', sqlType: 'timestamptz', nullable: false },
      { name: 'updated_at', sqlType: 'timestamptz', nullable: false },
      { name: 'deleted_at', sqlType: 'timestamptz', nullable: true },
    ],
  },
  {
    tableName: 'event_types',
    ownerModule: 'workspaces',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'key', sqlType: 'text', nullable: false },
      { name: 'label', sqlType: 'text', nullable: false },
      { name: 'icon', sqlType: 'text', nullable: false },
      { name: 'default_duration_min', sqlType: 'integer', nullable: false },
      { name: 'fields_schema', sqlType: 'jsonb', nullable: false },
    ],
  },
  {
    tableName: 'events',
    ownerModule: 'calendar',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: true,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'event_type_key', sqlType: 'text', nullable: false },
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'start_at', sqlType: 'timestamptz', nullable: false },
      { name: 'end_at', sqlType: 'timestamptz', nullable: false },
      { name: 'rrule', sqlType: 'text', nullable: true }, // ADR-0008
      { name: 'rrule_exceptions', sqlType: 'jsonb', nullable: false, defaultExpr: "'[]'::jsonb" },
      { name: 'is_blocked_period', sqlType: 'boolean', nullable: false, defaultExpr: 'false' },
      { name: 'custom_fields', sqlType: 'jsonb', nullable: false, defaultExpr: "'{}'::jsonb" }, // R-36
    ],
  },
  {
    tableName: 'subjects',
    ownerModule: 'study',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: true,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'key', sqlType: 'text', nullable: false },
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'color', sqlType: 'text', nullable: true },
      { name: 'custom_fields', sqlType: 'jsonb', nullable: false, defaultExpr: "'{}'::jsonb" },
    ],
  },
  {
    tableName: 'topics',
    ownerModule: 'study',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: true,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'subject_id', sqlType: 'uuid', nullable: false },
      { name: 'key', sqlType: 'text', nullable: false },
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'weight', sqlType: 'integer', nullable: false, defaultExpr: '1' },
      { name: 'custom_fields', sqlType: 'jsonb', nullable: false, defaultExpr: "'{}'::jsonb" },
    ],
  },
  {
    tableName: 'study_items',
    ownerModule: 'study',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: true,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'item_type_key', sqlType: 'text', nullable: false },
      { name: 'topic_id', sqlType: 'uuid', nullable: true },
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'scheduled_date', sqlType: 'text', nullable: false },
      { name: 'status', sqlType: 'text', nullable: false, defaultExpr: "'pending'" },
      { name: 'completed_at', sqlType: 'timestamptz', nullable: true },
      { name: 'custom_fields', sqlType: 'jsonb', nullable: false, defaultExpr: "'{}'::jsonb" },
    ],
  },
  {
    tableName: 'goals',
    ownerModule: 'study',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'metric', sqlType: 'text', nullable: false },
      { name: 'target_value', sqlType: 'numeric', nullable: false },
      { name: 'period_end_at', sqlType: 'timestamptz', nullable: true },
    ],
  },
  {
    tableName: 'questions',
    ownerModule: 'practice',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: true,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'topic_id', sqlType: 'uuid', nullable: false },
      { name: 'prompt', sqlType: 'text', nullable: false },
      { name: 'custom_fields', sqlType: 'jsonb', nullable: false, defaultExpr: "'{}'::jsonb" },
    ],
  },
  {
    tableName: 'attempts',
    ownerModule: 'practice',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'question_id', sqlType: 'uuid', nullable: false },
      { name: 'topic_id', sqlType: 'uuid', nullable: false },
      { name: 'is_correct', sqlType: 'boolean', nullable: false },
      { name: 'time_spent_sec', sqlType: 'integer', nullable: false },
    ],
  },
  {
    tableName: 'cards',
    ownerModule: 'practice',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'topic_id', sqlType: 'uuid', nullable: false },
      { name: 'front', sqlType: 'text', nullable: false },
      { name: 'back', sqlType: 'text', nullable: false },
      { name: 'stability', sqlType: 'numeric', nullable: false },
      { name: 'difficulty', sqlType: 'numeric', nullable: false },
      { name: 'due_at', sqlType: 'timestamptz', nullable: false },
      { name: 'reps', sqlType: 'integer', nullable: false },
      { name: 'lapses', sqlType: 'integer', nullable: false },
    ],
  },
  {
    tableName: 'review_logs',
    ownerModule: 'practice',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'card_id', sqlType: 'uuid', nullable: false },
      { name: 'rating', sqlType: 'integer', nullable: false },
      { name: 'elapsed_days', sqlType: 'numeric', nullable: false },
      { name: 'scheduled_days', sqlType: 'numeric', nullable: false },
    ],
  },
  {
    tableName: 'notes',
    ownerModule: 'notes',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'title', sqlType: 'text', nullable: false },
      { name: 'content_markdown', sqlType: 'text', nullable: false },
      { name: 'links', sqlType: 'jsonb', nullable: false, defaultExpr: "'[]'::jsonb" },
    ],
  },
  {
    tableName: 'rules',
    ownerModule: 'rules',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'name', sqlType: 'text', nullable: false },
      { name: 'enabled', sqlType: 'boolean', nullable: false },
      { name: 'consecutive_failures', sqlType: 'integer', nullable: false, defaultExpr: '0' }, // R-33
      { name: 'definition', sqlType: 'jsonb', nullable: false },
    ],
  },
  {
    tableName: 'rule_executions',
    ownerModule: 'rules',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'rule_id', sqlType: 'uuid', nullable: false },
      { name: 'source_event_id', sqlType: 'uuid', nullable: false },
      { name: 'correlation_id', sqlType: 'uuid', nullable: false },
      { name: 'depth', sqlType: 'integer', nullable: false },
      { name: 'status', sqlType: 'text', nullable: false },
      { name: 'actions_executed', sqlType: 'jsonb', nullable: false },
    ],
  },
  {
    tableName: 'outbox',
    ownerModule: 'workspaces',
    requiresWorkspaceIsolation: true,
    hasCustomFieldsJsonb: false,
    columns: [
      ...MANDATORY_USER_TABLE_COLUMNS,
      { name: 'event_type', sqlType: 'text', nullable: false },
      { name: 'causation_id', sqlType: 'uuid', nullable: false },
      { name: 'correlation_id', sqlType: 'uuid', nullable: false },
      { name: 'depth', sqlType: 'integer', nullable: false },
      { name: 'payload', sqlType: 'jsonb', nullable: false },
      { name: 'processed_at', sqlType: 'timestamptz', nullable: true },
    ],
  },
];

/**
 * R-37: Gera DDL de índice de expressão para campos customizados marcados como analisáveis.
 */
export function buildAnalyzableFieldIndexSQL(params: {
  tableName: 'events' | 'study_items' | 'questions';
  workspaceId: string;
  fieldKey: string;
  indexExpression: string;
}): string {
  const safeField = params.fieldKey.replace(/[^a-zA-Z0-9_]/g, '_');
  const safeWs = params.workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const idxName = `idx_${params.tableName}_${safeWs}_${safeField}`;
  return `CREATE INDEX IF NOT EXISTS ${idxName} ON ${params.tableName} (workspace_id, ${params.indexExpression}) WHERE deleted_at IS NULL;`;
}
