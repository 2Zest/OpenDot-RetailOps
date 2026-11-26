import { describe, expect, it } from 'vitest';
import { canTransitionDraft, canTransitionOperation } from '../../src/domain/index.js';

const passingPrecheck = {
  hardRules: 'PASS' as const,
  authorization: 'ACTIVE' as const,
  approval: 'VALID' as const,
  draftSnapshot: 'CURRENT' as const,
  policy: 'CURRENT' as const,
  idempotencyKey: 'PRESENT' as const,
};

describe('RETAIL-01 pure status guards', () => {
  it('requires risk approval before a draft can reach business approval', () => {
    expect(canTransitionDraft('RISK_REVIEW', 'AWAITING_MANAGER')).toBe(false);
    expect(canTransitionDraft('RISK_REVIEW', 'AWAITING_MANAGER', { riskReview: 'PASS' })).toBe(true);
    expect(canTransitionDraft('RISK_REVIEW', 'AWAITING_MANAGER', { riskReview: 'REJECTED' })).toBe(false);
    expect(canTransitionDraft('RISK_REVIEW', 'RISK_REJECTED', { riskReview: 'REJECTED' })).toBe(true);
    expect(canTransitionDraft('DRAFTED', 'EXECUTING')).toBe(false);
  });

  it('requires explicit approval and all precheck evidence before execution', () => {
    expect(canTransitionDraft('AWAITING_MANAGER', 'APPROVED')).toBe(false);
    expect(canTransitionDraft('AWAITING_MANAGER', 'APPROVED', { approval: 'APPROVED' })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING')).toBe(false);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING', { precheck: passingPrecheck })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, authorization: 'DENIED' },
    })).toBe(false);
  });

  it('does not project failure, cancellation, or unknown side effects as success', () => {
    expect(canTransitionDraft('EXECUTING', 'COMPLETED')).toBe(false);
    expect(canTransitionDraft('EXECUTING', 'COMPLETED', { execution: 'CONFIRMED' })).toBe(true);
    expect(canTransitionDraft('EXECUTING', 'CANCELLED')).toBe(false);
    expect(canTransitionDraft('EXECUTING', 'CANCELLED', { execution: 'NO_EFFECT' })).toBe(true);
    expect(canTransitionDraft('EXECUTING', 'UNCERTAIN', { execution: 'UNKNOWN' })).toBe(true);
    expect(canTransitionDraft('UNCERTAIN', 'COMPLETED')).toBe(false);
    expect(canTransitionDraft('UNCERTAIN', 'COMPLETED', { reconciliation: 'COMPLETED' })).toBe(true);
    expect(canTransitionDraft('UNCERTAIN', 'FAILED', { reconciliation: 'BLOCKED' })).toBe(false);
  });

  it('blocks operation execution without approval and precheck evidence', () => {
    expect(canTransitionOperation('PROPOSED', 'APPROVED')).toBe(false);
    expect(canTransitionOperation('PROPOSED', 'APPROVED', { approval: 'APPROVED' })).toBe(true);
    expect(canTransitionOperation('APPROVED', 'EXECUTING')).toBe(false);
    expect(canTransitionOperation('APPROVED', 'PRECHECK', { approval: 'APPROVED' })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'EXECUTING')).toBe(false);
    expect(canTransitionOperation('PRECHECK', 'EXECUTING', { precheck: passingPrecheck })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, authorization: 'DENIED' },
    })).toBe(false);
  });

  it('requires reconciliation before resolving uncertain operations', () => {
    expect(canTransitionOperation('EXECUTING', 'UNCERTAIN', { execution: 'UNKNOWN' })).toBe(true);
    expect(canTransitionOperation('UNCERTAIN', 'COMPLETED')).toBe(false);
    expect(canTransitionOperation('UNCERTAIN', 'COMPLETED', { reconciliation: 'COMPLETED' })).toBe(true);
    expect(canTransitionOperation('UNCERTAIN', 'FAILED', { reconciliation: 'BLOCKED' })).toBe(false);
  });

  it('blocks execution when approval is revoked or expired, snapshots are stale, or precheck fails', () => {
    expect(canTransitionDraft('APPROVED', 'PRECHECK', { approval: 'REVOKED' })).toBe(false);
    expect(canTransitionDraft('APPROVED', 'PRECHECK', { approval: 'EXPIRED' })).toBe(false);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, approval: 'REVOKED' },
    })).toBe(false);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, approval: 'EXPIRED' },
    })).toBe(false);
    expect(canTransitionDraft('APPROVED', 'APPROVAL_EXPIRED', { approval: 'EXPIRED' })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'EXECUTING')).toBe(false);
    expect(canTransitionDraft('PRECHECK', 'APPROVAL_REVOKED', {
      precheck: { ...passingPrecheck, approval: 'REVOKED' },
    })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'APPROVAL_EXPIRED', {
      precheck: { ...passingPrecheck, approval: 'EXPIRED' },
    })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'STALE')).toBe(false);
    expect(canTransitionDraft('PRECHECK', 'STALE', {
      precheck: { ...passingPrecheck, policy: 'STALE' },
    })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'FAILED', {
      precheck: { ...passingPrecheck, hardRules: 'FAIL' },
    })).toBe(true);
    expect(canTransitionDraft('PRECHECK', 'FAILED', {
      precheck: { ...passingPrecheck, authorization: 'DENIED' },
    })).toBe(true);

    expect(canTransitionOperation('APPROVED', 'PRECHECK', { approval: 'REVOKED' })).toBe(false);
    expect(canTransitionOperation('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, approval: 'REVOKED' },
    })).toBe(false);
    expect(canTransitionOperation('PRECHECK', 'EXECUTING', {
      precheck: { ...passingPrecheck, approval: 'EXPIRED' },
    })).toBe(false);
    expect(canTransitionOperation('APPROVED', 'APPROVAL_EXPIRED', { approval: 'EXPIRED' })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'APPROVAL_REVOKED', {
      precheck: { ...passingPrecheck, approval: 'REVOKED' },
    })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'APPROVAL_EXPIRED', {
      precheck: { ...passingPrecheck, approval: 'EXPIRED' },
    })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'STALE', {
      precheck: { ...passingPrecheck, draftSnapshot: 'STALE' },
    })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'STALE', {
      precheck: { ...passingPrecheck, policy: 'STALE' },
    })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'FAILED', {
      precheck: { ...passingPrecheck, authorization: 'DENIED' },
    })).toBe(true);
    expect(canTransitionOperation('PRECHECK', 'FAILED', {
      precheck: { ...passingPrecheck, hardRules: 'FAIL' },
    })).toBe(true);
  });

  it('distinguishes timeout with known no effect from an uncertain side effect', () => {
    expect(canTransitionDraft('EXECUTING', 'FAILED', { execution: 'TIMEOUT_NO_EFFECT' })).toBe(true);
    expect(canTransitionDraft('EXECUTING', 'UNCERTAIN', { execution: 'TIMEOUT_NO_EFFECT' })).toBe(false);
    expect(canTransitionDraft('EXECUTING', 'UNCERTAIN', { execution: 'TIMEOUT_UNKNOWN' })).toBe(true);
    expect(canTransitionOperation('EXECUTING', 'FAILED', { execution: 'TIMEOUT_NO_EFFECT' })).toBe(true);
    expect(canTransitionOperation('EXECUTING', 'UNCERTAIN', { execution: 'TIMEOUT_NO_EFFECT' })).toBe(false);
    expect(canTransitionOperation('EXECUTING', 'UNCERTAIN', { execution: 'TIMEOUT_UNKNOWN' })).toBe(true);
  });

  it('returns false rather than throwing for invalid runtime statuses or evidence', () => {
    const invalidCalls: readonly (() => boolean)[] = [
      () => Reflect.apply(canTransitionDraft, undefined, ['UNKNOWN', 'EXECUTING']),
      () => Reflect.apply(canTransitionOperation, undefined, [null, 'EXECUTING']),
      () => Reflect.apply(canTransitionDraft, undefined, ['PRECHECK', 'EXECUTING', { precheck: null }]),
      () => Reflect.apply(canTransitionDraft, undefined, ['UNCERTAIN', 'COMPLETED', null]),
      () => Reflect.apply(canTransitionOperation, undefined, ['UNCERTAIN', 'COMPLETED', { reconciliation: 'CLEARED' }]),
    ];
    for (const call of invalidCalls) {
      expect(call).not.toThrow();
      expect(call()).toBe(false);
    }
    expect(Reflect.apply(canTransitionDraft, undefined, ['UNCERTAIN', 'COMPLETED', { reconciliation: 'COMPLETED' }])).toBe(true);
    expect(Reflect.apply(canTransitionDraft, undefined, ['UNCERTAIN', 'COMPLETED', { reconciliation: 'BLOCKED' }])).toBe(false);
  });
});
