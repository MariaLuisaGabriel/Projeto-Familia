-- 0001_initial_core_schema.sql
-- Regras atendidas: R-27, R-34, R-35, R-36, R-38, R-39, R-40

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  metadata_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  event_type_key TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  rrule TEXT NULL,
  rrule_exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_blocked_period BOOLEAN NOT NULL DEFAULT FALSE,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_rule_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_events_workspace_start ON events (workspace_id, start_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  event_type TEXT NOT NULL,
  causation_id UUID NOT NULL,
  correlation_id UUID NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NULL,
  created_by_rule_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox (workspace_id, created_at) WHERE processed_at IS NULL;
