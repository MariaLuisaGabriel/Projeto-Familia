/**
 * apps/web/src/registries/field-type-views.tsx
 * §7.1 Contrato de UI de tipos de campo (`FieldTypeView<TConfig, TValue>`).
 * R-42: Formulários, filtros e exibições de tipos customizados DEVEM ser gerados a partir dos
 * metadados e do FieldTypeView registrado. NÃO DEVE haver telas específicas por template.
 */
import React from 'react';
import { ClosedRegistry } from '@estudos/registries';
import type { TemplateFieldDefinition } from '@estudos/template-schema';

export interface FilterExpr {
  readonly fieldKey: string;
  readonly operator: 'eq' | 'in';
  readonly value: unknown;
}

export interface FieldTypeView<TConfig = TemplateFieldDefinition, TValue = unknown> {
  readonly key: string;
  readonly Editor: React.ComponentType<{
    config: TConfig;
    value: TValue;
    onChange(v: TValue): void;
  }>;
  readonly Display: React.ComponentType<{
    config: TConfig;
    value: TValue;
  }>;
  readonly Filter?: React.ComponentType<{
    config: TConfig;
    onChange(f: FilterExpr | null): void;
  }>;
}

const TextFieldView: FieldTypeView<TemplateFieldDefinition, string> = {
  key: 'text',
  Editor: ({ config, value, onChange }) => (
    <input
      type="text"
      className="ui-input"
      aria-label={config.label ?? config.key}
      value={value ?? ''}
      placeholder={config.label ?? config.key}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  Display: ({ value }) => <span>{value || '—'}</span>,
};

const LongTextFieldView: FieldTypeView<TemplateFieldDefinition, string> = {
  key: 'long-text',
  Editor: ({ config, value, onChange }) => (
    <textarea
      className="ui-textarea"
      aria-label={config.label ?? config.key}
      rows={3}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  Display: ({ value }) => <p className="ui-prose-sm">{value || '—'}</p>,
};

const NumberFieldView: FieldTypeView<TemplateFieldDefinition, number | null> = {
  key: 'number',
  Editor: ({ config, value, onChange }) => (
    <input
      type="number"
      className="ui-input"
      aria-label={config.label ?? config.key}
      min={config.min}
      max={config.max}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  ),
  Display: ({ config, value }) => (
    <span className="ui-mono">
      {value !== null && value !== undefined ? `${value}${config.unit ? ` ${config.unit}` : ''}` : '—'}
    </span>
  ),
};

const SelectFieldView: FieldTypeView<TemplateFieldDefinition, string> = {
  key: 'select',
  Editor: ({ config, value, onChange }) => {
    const options = config.options ?? [];
    return (
      <select
        className="ui-select"
        aria-label={config.label ?? config.key}
        value={value ?? options[0] ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  },
  Display: ({ value }) => <span className="ui-pill">{value || '—'}</span>,
  Filter: ({ config, onChange }) => (
    <select
      className="ui-select ui-select--compact"
      aria-label={`Filtrar por ${config.label ?? config.key}`}
      onChange={(e) =>
        onChange(
          e.target.value
            ? { fieldKey: config.key, operator: 'eq', value: e.target.value }
            : null
        )
      }
    >
      <option value="">Todos ({config.label ?? config.key})</option>
      {(config.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
};

const MultiSelectFieldView: FieldTypeView<TemplateFieldDefinition, string[]> = {
  key: 'multi-select',
  Editor: ({ config, value = [], onChange }) => {
    const options = config.options ?? [];
    const toggle = (opt: string) => {
      const next = value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt];
      onChange(next);
    };
    return (
      <div className="ui-chip-group" role="group" aria-label={config.label ?? config.key}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              className={`ui-chip ${active ? 'ui-chip--active' : ''}`}
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  },
  Display: ({ value }) => (
    <span>{Array.isArray(value) && value.length > 0 ? value.join(', ') : '—'}</span>
  ),
};

const BooleanFieldView: FieldTypeView<TemplateFieldDefinition, boolean> = {
  key: 'boolean',
  Editor: ({ config, value, onChange }) => (
    <label className="ui-checkbox-label">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{config.label ?? config.key}</span>
    </label>
  ),
  Display: ({ value }) => <span className="ui-mono">{value ? 'Sim' : 'Não'}</span>,
};

const DateFieldView: FieldTypeView<TemplateFieldDefinition, string> = {
  key: 'date',
  Editor: ({ config, value, onChange }) => (
    <input
      type="date"
      className="ui-input"
      aria-label={config.label ?? config.key}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  Display: ({ value }) => <span className="ui-mono">{value || '—'}</span>,
};

const DurationFieldView: FieldTypeView<TemplateFieldDefinition, number> = {
  key: 'duration',
  Editor: ({ config, value, onChange }) => (
    <input
      type="number"
      className="ui-input"
      min={5}
      step={5}
      aria-label={config.label ?? config.key}
      value={value ?? 60}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
  Display: ({ value }) => <span className="ui-mono">{value ? `${value} min` : '—'}</span>,
};

export const FieldTypeViewRegistry = new ClosedRegistry<FieldTypeView<any, any>>(
  'FieldTypeViewRegistry',
  [
    TextFieldView,
    LongTextFieldView,
    NumberFieldView,
    SelectFieldView,
    MultiSelectFieldView,
    BooleanFieldView,
    DateFieldView,
    DurationFieldView,
    { ...TextFieldView, key: 'checklist' },
    { ...TextFieldView, key: 'attachment' },
    { ...TextFieldView, key: 'ref-topic' },
    { ...TextFieldView, key: 'ref-event' },
  ]
);
