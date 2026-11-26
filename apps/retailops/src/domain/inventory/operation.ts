import { z } from 'zod';
import { contractVersionSchema, moneySchema, opaqueReferenceSchema, passesPrecheck, quantitySchema, type PrecheckEvidence } from '../shared/primitives.js';

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
]);

export type OperationStatus = z.infer<typeof operationStatusSchema>;

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
      proposedPrice: moneySchema,
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

export interface OperationTransitionEvidence {
  readonly approval?: 'APPROVED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  readonly precheck?: PrecheckEvidence;
  readonly execution?: 'CONFIRMED' | 'DEFINITIVE_FAILURE' | 'NO_EFFECT' | 'UNKNOWN';
  readonly reconciliation?: 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

const operationTransitions = {
  PROPOSED: ['APPROVED', 'CANCELLED', 'STALE'],
  APPROVED: ['PRECHECK', 'CANCELLED', 'STALE'],
  PRECHECK: ['EXECUTING', 'FAILED', 'CANCELLED', 'STALE'],
  EXECUTING: ['COMPLETED', 'FAILED', 'CANCELLED', 'UNCERTAIN'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  UNCERTAIN: ['COMPLETED', 'FAILED'],
  STALE: [],
} satisfies Record<OperationStatus, readonly OperationStatus[]>;

export function canTransitionOperation(
  current: OperationStatus,
  next: OperationStatus,
  evidence: OperationTransitionEvidence = {},
): boolean {
  if (!operationTransitions[current].some((allowed) => allowed === next)) return false;
  if (next === 'APPROVED') return evidence.approval === 'APPROVED';
  if (next === 'PRECHECK' && current === 'APPROVED') return evidence.approval === 'APPROVED';
  if (current === 'PRECHECK' && next === 'EXECUTING') return passesPrecheck(evidence.precheck);
  if (current === 'PRECHECK' && next === 'FAILED') return evidence.precheck?.hardRules === 'FAIL' || evidence.precheck?.authorization === 'DENIED';
  if (current === 'PRECHECK' && next === 'STALE') return evidence.precheck?.draftSnapshot === 'STALE' || evidence.precheck?.policy === 'STALE';
  if (current === 'EXECUTING' && next === 'COMPLETED') return evidence.execution === 'CONFIRMED';
  if (current === 'EXECUTING' && next === 'FAILED') return evidence.execution === 'DEFINITIVE_FAILURE';
  if (current === 'EXECUTING' && next === 'CANCELLED') return evidence.execution === 'NO_EFFECT';
  if (current === 'EXECUTING' && next === 'UNCERTAIN') return evidence.execution === 'UNKNOWN';
  if (current === 'UNCERTAIN' && next === 'COMPLETED') return evidence.reconciliation === 'COMPLETED';
  if (current === 'UNCERTAIN' && next === 'FAILED') return evidence.reconciliation === 'FAILED';
  return true;
}
