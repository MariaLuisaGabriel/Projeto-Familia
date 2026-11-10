import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FieldTypeRegistry,
  GeneratorRegistry,
  TriggerRegistry,
  ConditionRegistry,
  ActionRegistry,
  WidgetRegistry,
  isValidWidgetSpec,
} from './index.ts';

describe('@estudos/registries (R-20 a R-24)', () => {
  it('registers all 12 core field types and validates configs/values (R-21, R-22)', () => {
    const expectedKeys = [
      'text',
      'long-text',
      'number',
      'select',
      'multi-select',
      'date',
      'boolean',
      'duration',
      'checklist',
      'attachment',
      'ref-topic',
      'ref-event',
    ];
    for (const k of expectedKeys) {
      assert.equal(FieldTypeRegistry.has(k), true, `Missing field type: ${k}`);
    }

    const selectType = FieldTypeRegistry.getOrThrow('select');
    assert.equal(selectType.validateConfig({ options: ['A', 'B'] }).valid, true);
    assert.equal(selectType.validateConfig({ options: [] }).valid, false);
    assert.equal(selectType.validateValue({ options: ['A', 'B'] }, 'A').valid, true);
    assert.equal(selectType.validateValue({ options: ['A', 'B'] }, 'C').valid, false);
  });

  it('produces deterministic schedule outputs for the same state and params (R-24)', () => {
    const linear = GeneratorRegistry.getOrThrow('linear');
    const topics = [
      { id: 't1', subjectId: 's1', title: 'Tópico 1' },
      { id: 't2', subjectId: 's1', title: 'Tópico 2' },
      { id: 't3', subjectId: 's2', title: 'Tópico 3' },
    ];
    const params = { itemsPerWeek: 2, startDateISO: '2026-11-09' };

    const run1 = linear.generate(topics, params);
    const run2 = linear.generate(topics, params);
    assert.deepEqual(run1, run2);
    assert.equal(run1.length, 3);
    assert.equal(run1[0].weekIndex, 0);
    assert.equal(run1[2].weekIndex, 1);
  });

  it('evaluates conditions and plans non-destructive rule actions (R-32)', () => {
    const condType = ConditionRegistry.getOrThrow('type-is');
    const condField = ConditionRegistry.getOrThrow('field-equals');
    const ctx = { entityTypeKey: 'simulado', customFields: { turno: 'noturno' } };

    assert.equal(condType.evaluate({ eventType: 'simulado' }, ctx), true);
    assert.equal(condField.evaluate({ field: 'turno', value: 'noturno' }, ctx), true);
    assert.equal(condField.evaluate({ field: 'turno', value: 'diurno' }, ctx), false);

    const blockAction = ActionRegistry.getOrThrow('block-period');
    const effect = blockAction.planEffect({ duration: 'PT12H', anchor: 'end' }, { endAt: '2026-11-10T07:00:00Z' });
    assert.equal(effect.actionKey, 'block-period');
  });

  it('validates widget specifications including parameterized widgets (R-14)', () => {
    assert.equal(TriggerRegistry.keys().length, 5);
    assert.equal(WidgetRegistry.has('progress'), true);
    assert.equal(isValidWidgetSpec('progress'), true);
    assert.equal(isValidWidgetSpec('events-of-type:plantao'), true);
    assert.equal(isValidWidgetSpec('unknown-widget'), false);
  });
});
