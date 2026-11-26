import { z } from 'zod';
import { contractVersionSchema, opaqueReferenceSchema, passesPrecheck, type PrecheckEvidence } from '../shared/primitives.js';

export const draftStatusSchema = z.enum([
  'DRAFTED',
  'RISK_REVIEW',
  'AWAITING_MANAGER',
  'APPROVED',
  'PRECHECK',
  'EXECUTING',
  'COMPLETED',
  'RISK_REJECTED',
  'RISK_FAILED',
  'RISK_TIMEOUT',
  'CANCELLED',
  'APPROVAL_REJECTED',
  'APPROVAL_REVOKED',
  'APPROVAL_EXPIRED',
  'STALE',
  'FAILED',
  'UNCERTAIN',
]);

export type DraftStatus = z.infer<typeof draftStatusSchema>;

const referenceList = z.array(opaqueReferenceSchema).min(1).refine(
  (references) => new Set(references).size === references.length,
  'References must be unique',
);

export const draftSchema = z
  .object({
    contractVersion: contractVersionSchema,
    id: opaqueReferenceSchema,
    draftDigest: opaqueReferenceSchema,
    status: draftStatusSchema,
    inputSnapshot: z
      .object({
        id: opaqueReferenceSchema,
        productIds: referenceList,
        batchIds: referenceList,
        evidenceIds: referenceList,
        policyId: opaqueReferenceSchema,
        policyRevision: opaqueReferenceSchema,
      })
      .strict(),
    operationIds: referenceList,
  })
  .strict();

export type Draft = z.infer<typeof draftSchema>;

export interface DraftTransitionEvidence {
  readonly riskReview?: 'PASS' | 'REJECTED' | 'FAILED' | 'TIMEOUT';
  readonly approval?: 'APPROVED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  readonly precheck?: PrecheckEvidence;
  readonly execution?: 'CONFIRMED' | 'DEFINITIVE_FAILURE' | 'NO_EFFECT' | 'UNKNOWN';
  readonly reconciliation?: 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

const draftTransitions = {
  DRAFTED: ['RISK_REVIEW', 'CANCELLED', 'STALE'],
  RISK_REVIEW: ['AWAITING_MANAGER', 'RISK_REJECTED', 'RISK_FAILED', 'RISK_TIMEOUT', 'CANCELLED', 'STALE'],
  AWAITING_MANAGER: ['APPROVED', 'APPROVAL_REJECTED', 'APPROVAL_EXPIRED', 'CANCELLED', 'STALE'],
  APPROVED: ['PRECHECK', 'APPROVAL_REVOKED', 'APPROVAL_EXPIRED', 'CANCELLED', 'STALE'],
  PRECHECK: ['EXECUTING', 'FAILED', 'CANCELLED', 'STALE'],
  EXECUTING: ['COMPLETED', 'FAILED', 'CANCELLED', 'UNCERTAIN'],
  COMPLETED: [],
  RISK_REJECTED: [],
  RISK_FAILED: [],
  RISK_TIMEOUT: [],
  CANCELLED: [],
  APPROVAL_REJECTED: [],
  APPROVAL_REVOKED: [],
  APPROVAL_EXPIRED: [],
  STALE: [],
  FAILED: [],
  UNCERTAIN: ['COMPLETED', 'FAILED'],
} satisfies Record<DraftStatus, readonly DraftStatus[]>;

export function canTransitionDraft(
  current: DraftStatus,
  next: DraftStatus,
  evidence: DraftTransitionEvidence = {},
): boolean {
  if (!draftTransitions[current].some((allowed) => allowed === next)) return false;

  if (current === 'RISK_REVIEW' && next === 'AWAITING_MANAGER') return evidence.riskReview === 'PASS';
  if (current === 'RISK_REVIEW' && next === 'RISK_REJECTED') return evidence.riskReview === 'REJECTED';
  if (current === 'RISK_REVIEW' && next === 'RISK_FAILED') return evidence.riskReview === 'FAILED';
  if (current === 'RISK_REVIEW' && next === 'RISK_TIMEOUT') return evidence.riskReview === 'TIMEOUT';
  if (current === 'AWAITING_MANAGER' && next === 'APPROVED') return evidence.approval === 'APPROVED';
  if (current === 'AWAITING_MANAGER' && next === 'APPROVAL_REJECTED') return evidence.approval === 'REJECTED';
  if (next === 'APPROVAL_REVOKED') return evidence.approval === 'REVOKED';
  if (next === 'APPROVAL_EXPIRED') return evidence.approval === 'EXPIRED';
  if (current === 'APPROVED' && next === 'PRECHECK') return evidence.approval === 'APPROVED';
  if (current === 'PRECHECK' && next === 'EXECUTING') return passesPrecheck(evidence.precheck);
  if (current === 'PRECHECK' && next === 'FAILED') return evidence.precheck?.hardRules === 'FAIL' || evidence.precheck?.authorization === 'DENIED';
  if (current === 'EXECUTING' && next === 'COMPLETED') return evidence.execution === 'CONFIRMED';
  if (current === 'EXECUTING' && next === 'FAILED') return evidence.execution === 'DEFINITIVE_FAILURE';
  if (current === 'EXECUTING' && next === 'CANCELLED') return evidence.execution === 'NO_EFFECT';
  if (current === 'EXECUTING' && next === 'UNCERTAIN') return evidence.execution === 'UNKNOWN';
  if (current === 'UNCERTAIN' && next === 'COMPLETED') return evidence.reconciliation === 'COMPLETED';
  if (current === 'UNCERTAIN' && next === 'FAILED') return evidence.reconciliation === 'FAILED';

  return true;
}
