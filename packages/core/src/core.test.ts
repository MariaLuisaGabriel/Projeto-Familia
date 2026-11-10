import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUuidV7,
  isValidUuidV7,
  createDomainEvent,
  assertWithinLimit,
  assertAuthorized,
  WORKSPACE_LIMITS,
  LimitExceededError,
  sanitizeUserText,
} from './index.ts';

describe('@estudos/core', () => {
  it('generates valid monotonic UUIDv7 identifiers (R-34, R-45)', () => {
    const id1 = createUuidV7(1700000000000);
    const id2 = createUuidV7(1700000001000);
    assert.equal(isValidUuidV7(id1), true);
    assert.equal(isValidUuidV7(id2), true);
    assert.equal(id1 < id2, true);
  });

  it('creates immutable, versioned DomainEvents (R-09)', () => {
    const wsId = createUuidV7();
    const evt = createDomainEvent({
      type: 'AttemptRegistered.v1',
      workspace_id: wsId,
      payload: { questionId: 'q1', correct: false },
    });
    assert.equal(evt.workspace_id, wsId);
    assert.equal(evt.causation_id, evt.id);
    assert.equal(evt.correlation_id, evt.id);
    assert.equal(Object.isFrozen(evt), true);
    assert.equal(Object.isFrozen(evt.payload), true);
  });

  it('enforces quantitative limits with explicit error (R-25, R-26)', () => {
    assert.doesNotThrow(() => assertWithinLimit('Tipos de evento', 50, WORKSPACE_LIMITS.MAX_EVENT_TYPES));
    assert.throws(
      () => assertWithinLimit('Tipos de evento', 51, WORKSPACE_LIMITS.MAX_EVENT_TYPES),
      LimitExceededError
    );
  });

  it('verifies workspace authorization and isolation (R-35, R-48)', () => {
    const wsA = createUuidV7();
    const wsB = createUuidV7();
    const viewer = { user_id: createUuidV7(), workspace_id: wsA, role: 'viewer' as const };
    assert.doesNotThrow(() => assertAuthorized(viewer, 'viewer', wsA));
    assert.throws(() => assertAuthorized(viewer, 'editor', wsA), /INSUFFICIENT_ROLE|Permissão insuficiente/);
    assert.throws(() => assertAuthorized(viewer, 'viewer', wsB), /WORKSPACE_ISOLATION_VIOLATION|outro workspace/);
  });

  it('sanitizes raw HTML tags from user text (R-49)', () => {
    const dirty = 'Nota **importante** <script>alert(1)</script> <b>bold</b>';
    assert.equal(sanitizeUserText(dirty), 'Nota **importante**  bold');
  });
});
