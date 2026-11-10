import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runArchitectureFitnessChecks } from './check-architecture.ts';

describe('Fitness Functions de Arquitetura (§16)', () => {
  it('verifica fronteiras hexagonais, matriz de dependências e validade de todos os templates', () => {
    const result = runArchitectureFitnessChecks(process.cwd());
    assert.equal(
      result.passed,
      true,
      `Violações encontradas:\n${result.violations.join('\n')}`
    );
    assert.equal(result.summary.validatedTemplates >= 3, true);
  });
});
