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
});
