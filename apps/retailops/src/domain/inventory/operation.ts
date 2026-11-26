import { z } from 'zod';
import {
  contractVersionSchema,
  executionOutcomeSchema,
  moneySchema,
  opaqueReferenceSchema,
  passesPrecheck,
  precheckEvidenceSchema,
  quantitySchema,
  reconciliationOutcomeSchema,
} from '../shared/primitives.js';

export const operationStatusSchema = z.enum([
  'PROPOSED',
  'APPROVED',
  'PRECHECK',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'UNCERTAIN',
  'STALE',
  'APPROVAL_REVOKED',
  'APPROVAL_EXPIRED',
]);

export type OperationStatus = z.infer<typeof operationStatusSchema>;

const nonNegativePriceSchema = moneySchema.refine(
  (money) => typeof money.minorUnits === 'string'
    && (!money.minorUnits.startsWith('-') || /^-0+$/.test(money.minorUnits)),
  'A proposed markdown price cannot be negative',
);

const operationBase = {
  contractVersion: contractVersionSchema,
  id: opaqueReferenceSchema,
  draftId: opaqueReferenceSchema,
  productId: opaqueReferenceSchema,
  batchId: opaqueReferenceSchema,
  quantity: quantitySchema,
  status: operationStatusSchema,
  evidenceIds: z.array(opaqueReferenceSchema).min(1),
};

export const operationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...operationBase,
      kind: z.literal('MARKDOWN_PROPOSAL'),
      proposedPrice: nonNegativePriceSchema,
    })
    .strict(),
  z
    .object({
      ...operationBase,
      kind: z.literal('DISPOSAL_PROPOSAL'),
      reasonCode: opaqueReferenceSchema,
    })
    .strict(),
]);

export type Operation = z.infer<typeof operationSchema>;

const operationTransitionEvidenceSchema = z.object({
  approval: z.enum(['APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED']).optional(),
  precheck: precheckEvidenceSchema.optional(),
  execution: executionOutcomeSchema.optional(),
  reconciliation: reconciliationOutcomeSchema.optional(),
}).strict();

export type OperationTransitionEvidence = z.infer<typeof operationTransitionEvidenceSchema>;

const operationTransitions = {
  PROPOSED: ['APPROVED', 'CANCELLED', 'STALE'],
  APPROVED: ['PRECHECK', 'CANCELLED', 'STALE', 'APPROVAL_REVOKED', 'APPROVAL_EXPIRED'],
  PRECHECK: ['EXECUTING', 'FAILED', 'CANCELLED', 'STALE', 'APPROVAL_REVOKED', 'APPROVAL_EXPIRED'],
  EXECUTING: ['COMPLETED', 'FAILED', 'CANCELLED', 'UNCERTAIN'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  UNCERTAIN: ['COMPLETED', 'FAILED'],
  STALE: [],
  APPROVAL_REVOKED: [],
  APPROVAL_EXPIRED: [],
} satisfies Record<OperationStatus, readonly OperationStatus[]>;

export function canTransitionOperation(current: unknown, next: unknown, evidence: unknown = {}): boolean {
  const parsedCurrent = operationStatusSchema.safeParse(current);
  const parsedNext = operationStatusSchema.safeParse(next);
  const parsedEvidence = operationTransitionEvidenceSchema.safeParse(evidence);
  if (!parsedCurrent.success || !parsedNext.success || !parsedEvidence.success) return false;

  const currentStatus = parsedCurrent.data;
  const nextStatus = parsedNext.data;
  const transitionEvidence = parsedEvidence.data;
  if (!operationTransitions[currentStatus].some((allowed) => allowed === nextStatus)) return false;

  if (currentStatus === 'PROPOSED' && nextStatus === 'APPROVED') return transitionEvidence.approval === 'APPROVED';
  if (currentStatus === 'APPROVED' && nextStatus === 'PRECHECK') return transitionEvidence.approval === 'APPROVED';
  if (currentStatus === 'APPROVED' && nextStatus === 'APPROVAL_REVOKED') return transitionEvidence.approval === 'REVOKED';
  if (currentStatus === 'APPROVED' && nextStatus === 'APPROVAL_EXPIRED') return transitionEvidence.approval === 'EXPIRED';

  if (currentStatus === 'PRECHECK' && nextStatus === 'EXECUTING') return passesPrecheck(transitionEvidence.precheck);
  if (currentStatus === 'PRECHECK' && nextStatus === 'FAILED') {
    return transitionEvidence.precheck?.hardRules === 'FAIL'
      || transitionEvidence.precheck?.authorization === 'DENIED'
      || transitionEvidence.precheck?.idempotencyKey === 'MISSING';
  }
  if (currentStatus === 'PRECHECK' && nextStatus === 'APPROVAL_REVOKED') return transitionEvidence.precheck?.approval === 'REVOKED';
  if (currentStatus === 'PRECHECK' && nextStatus === 'APPROVAL_EXPIRED') return transitionEvidence.precheck?.approval === 'EXPIRED';
  if (currentStatus === 'PRECHECK' && nextStatus === 'STALE') {
    return transitionEvidence.precheck?.draftSnapshot === 'STALE' || transitionEvidence.precheck?.policy === 'STALE';
  }
  if (nextStatus === 'CANCELLED' && currentStatus !== 'EXECUTING') return true;
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

  return currentStatus === 'PRECHECK' && nextStatus === 'CANCELLED';
}
