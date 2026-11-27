import { z } from 'zod';
import {
  contractVersionSchema,
  executionOutcomeSchema,
  opaqueReferenceSchema,
  approvalEvidenceIsConsistent,
  passesPrecheck,
  precheckEvidenceSchema,
  precheckOutcomeSchema,
  reconciliationOutcomeSchema,
} from '../shared/primitives.js';

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

const draftTransitionEvidenceSchema = z.object({
  riskReview: z.enum(['PASS', 'REJECTED', 'FAILED', 'TIMEOUT']).optional(),
  approval: z.enum(['APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED']).optional(),
  precheck: precheckEvidenceSchema.optional(),
  precheckOutcome: precheckOutcomeSchema.optional(),
  execution: executionOutcomeSchema.optional(),
  reconciliation: reconciliationOutcomeSchema.optional(),
}).strict();

export type DraftTransitionEvidence = z.infer<typeof draftTransitionEvidenceSchema>;

const draftTransitions = {
  DRAFTED: ['RISK_REVIEW', 'CANCELLED', 'STALE'],
  RISK_REVIEW: ['AWAITING_MANAGER', 'RISK_REJECTED', 'RISK_FAILED', 'RISK_TIMEOUT', 'CANCELLED', 'STALE'],
  AWAITING_MANAGER: ['APPROVED', 'APPROVAL_REJECTED', 'APPROVAL_EXPIRED', 'CANCELLED', 'STALE'],
  APPROVED: ['PRECHECK', 'APPROVAL_REVOKED', 'APPROVAL_EXPIRED', 'CANCELLED', 'STALE'],
  PRECHECK: ['EXECUTING', 'FAILED', 'CANCELLED', 'STALE', 'APPROVAL_REVOKED', 'APPROVAL_EXPIRED', 'UNCERTAIN'],
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

export function canTransitionDraft(current: unknown, next: unknown, evidence: unknown = {}): boolean {
  const parsedCurrent = draftStatusSchema.safeParse(current);
  const parsedNext = draftStatusSchema.safeParse(next);
  const parsedEvidence = draftTransitionEvidenceSchema.safeParse(evidence);
  if (!parsedCurrent.success || !parsedNext.success || !parsedEvidence.success) return false;

  const currentStatus = parsedCurrent.data;
  const nextStatus = parsedNext.data;
  const transitionEvidence = parsedEvidence.data;
  if (!draftTransitions[currentStatus].some((allowed) => allowed === nextStatus)) return false;

  if (!approvalEvidenceIsConsistent(transitionEvidence.approval, transitionEvidence.precheck?.approval)) return false;
  if (transitionEvidence.riskReview !== undefined && currentStatus !== 'RISK_REVIEW') return false;
  if (transitionEvidence.approval !== undefined
    && !['AWAITING_MANAGER', 'APPROVED', 'PRECHECK'].includes(currentStatus)) return false;
  if ((transitionEvidence.precheck !== undefined || transitionEvidence.precheckOutcome !== undefined)
    && currentStatus !== 'PRECHECK') return false;
  if (transitionEvidence.execution !== undefined && currentStatus !== 'EXECUTING') return false;
  if (transitionEvidence.reconciliation !== undefined && currentStatus !== 'UNCERTAIN') return false;
  if (currentStatus === 'PRECHECK' && transitionEvidence.precheckOutcome === 'UNKNOWN' && nextStatus !== 'UNCERTAIN') return false;
  if (currentStatus === 'PRECHECK' && transitionEvidence.precheckOutcome === 'NO_EFFECT' && nextStatus === 'UNCERTAIN') return false;

  if (currentStatus === 'DRAFTED' && nextStatus === 'RISK_REVIEW') return true;
  if (currentStatus === 'RISK_REVIEW' && nextStatus === 'AWAITING_MANAGER') return transitionEvidence.riskReview === 'PASS';
  if (currentStatus === 'RISK_REVIEW' && nextStatus === 'RISK_REJECTED') return transitionEvidence.riskReview === 'REJECTED';
  if (currentStatus === 'RISK_REVIEW' && nextStatus === 'RISK_FAILED') return transitionEvidence.riskReview === 'FAILED';
  if (currentStatus === 'RISK_REVIEW' && nextStatus === 'RISK_TIMEOUT') return transitionEvidence.riskReview === 'TIMEOUT';
  if (currentStatus === 'AWAITING_MANAGER' && nextStatus === 'APPROVED') return transitionEvidence.approval === 'APPROVED';
  if (currentStatus === 'AWAITING_MANAGER' && nextStatus === 'APPROVAL_REJECTED') return transitionEvidence.approval === 'REJECTED';
  if (currentStatus === 'AWAITING_MANAGER' && nextStatus === 'APPROVAL_EXPIRED') return transitionEvidence.approval === 'EXPIRED';
  if (currentStatus === 'APPROVED' && nextStatus === 'PRECHECK') return transitionEvidence.approval === 'APPROVED';
  if (currentStatus === 'APPROVED' && nextStatus === 'APPROVAL_REVOKED') return transitionEvidence.approval === 'REVOKED';
  if (currentStatus === 'APPROVED' && nextStatus === 'APPROVAL_EXPIRED') return transitionEvidence.approval === 'EXPIRED';

  if (currentStatus === 'PRECHECK' && nextStatus === 'EXECUTING') return passesPrecheck(transitionEvidence.precheck);
  if (currentStatus === 'PRECHECK' && nextStatus === 'FAILED') {
    if (transitionEvidence.precheckOutcome === 'UNKNOWN') return false;
    return transitionEvidence.precheck?.hardRules === 'FAIL'
      || transitionEvidence.precheck?.authorization === 'DENIED'
      || transitionEvidence.precheck?.idempotencyKey === 'MISSING';
  }
  if (currentStatus === 'PRECHECK' && nextStatus === 'APPROVAL_REVOKED') return transitionEvidence.precheck?.approval === 'REVOKED';
  if (currentStatus === 'PRECHECK' && nextStatus === 'APPROVAL_EXPIRED') return transitionEvidence.precheck?.approval === 'EXPIRED';
  if (currentStatus === 'PRECHECK' && nextStatus === 'STALE') {
    return transitionEvidence.precheck?.draftSnapshot === 'STALE' || transitionEvidence.precheck?.policy === 'STALE';
  }
  if (currentStatus === 'PRECHECK' && nextStatus === 'UNCERTAIN') return transitionEvidence.precheckOutcome === 'UNKNOWN';
  if (currentStatus === 'PRECHECK' && nextStatus === 'CANCELLED') return transitionEvidence.precheckOutcome === 'NO_EFFECT';

  if (nextStatus === 'CANCELLED' && currentStatus !== 'EXECUTING' && currentStatus !== 'PRECHECK') return true;
  if (nextStatus === 'STALE') return true;

  if (currentStatus === 'EXECUTING' && nextStatus === 'COMPLETED') return transitionEvidence.execution === 'CONFIRMED';
  if (currentStatus === 'EXECUTING' && nextStatus === 'FAILED') {
    return transitionEvidence.execution === 'DEFINITIVE_FAILURE'
      || transitionEvidence.execution === 'NO_EFFECT'
      || transitionEvidence.execution === 'TIMEOUT_NO_EFFECT';
  }
  if (currentStatus === 'EXECUTING' && nextStatus === 'CANCELLED') {
    return transitionEvidence.execution === 'NO_EFFECT' || transitionEvidence.execution === 'TIMEOUT_NO_EFFECT';
  }
  if (currentStatus === 'EXECUTING' && nextStatus === 'UNCERTAIN') {
    return transitionEvidence.execution === 'UNKNOWN' || transitionEvidence.execution === 'TIMEOUT_UNKNOWN';
  }

  if (currentStatus === 'UNCERTAIN' && nextStatus === 'COMPLETED') return transitionEvidence.reconciliation === 'COMPLETED';
  if (currentStatus === 'UNCERTAIN' && nextStatus === 'FAILED') return transitionEvidence.reconciliation === 'FAILED';

  return false;
}
