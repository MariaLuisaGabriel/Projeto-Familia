import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateManifest, diffTemplateVersions, type StudyTemplateManifest } from './index.ts';

describe('@estudos/template-schema (R-12 a R-19)', () => {
  const validSample: StudyTemplateManifest = {
    id: 'residencia-medica',
    version: '1.0.0',
    name: 'Residência Médica',
    eventTypes: [
      {
        key: 'plantao',
        label: 'Plantão',
        icon: 'hospital',
        defaultDurationMin: 720,
        fields: [
          { key: 'local', type: 'select', options: ['HRC', 'HRAN', 'HBDF'] },
          { key: 'turno', type: 'select', options: ['diurno', 'noturno', '24h'] },
        ],
      },
    ],
    generators: [{ kind: 'linear', params: { itemsPerWeek: 4 } }],
    dashboard: ['progress', 'events-of-type:plantao', 'upcoming:aula'],
  };

  it('validates the canonical example template from §6.1 (R-12, R-14)', () => {
    const report = validateTemplateManifest(validSample);
    assert.equal(report.valid, true, report.errors.join('; '));
  });

  it('rejects templates with unknown registry entries (R-14)', () => {
    const broken = {
      ...validSample,
      generators: [{ kind: 'magic-ai-generator', params: {} }],
    };
    const report = validateTemplateManifest(broken);
    assert.equal(report.valid, false);
    assert.match(report.errors.join(' '), /GeneratorRegistry/);
  });

  it('rejects templates containing HTML or executable code (R-13)', () => {
    const malicious = {
      ...validSample,
      name: 'Residência <script>alert(1)</script>',
    };
    const report = validateTemplateManifest(malicious);
    assert.equal(report.valid, false);
    assert.match(report.errors.join(' '), /R-13/);
  });

  it('computes field-by-field diffs between template versions (R-16)', () => {
    const v2: StudyTemplateManifest = {
      ...validSample,
      version: '1.1.0',
      eventTypes: [
        {
          ...validSample.eventTypes[0],
          fields: [
            ...validSample.eventTypes[0].fields,
            { key: 'preceptor', type: 'text' },
          ],
        },
        {
          key: 'simulado',
          label: 'Simulado',
          icon: 'check',
          defaultDurationMin: 240,
          fields: [],
        },
      ],
    };
    const diff = diffTemplateVersions(validSample, v2);
    assert.deepEqual(diff.addedEventTypes, ['simulado']);
    assert.deepEqual(diff.addedFields, [{ ownerKey: 'plantao', fieldKey: 'preceptor' }]);
  });
});
