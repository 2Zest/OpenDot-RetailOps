import { z } from 'zod';
import { batchSchema } from '../inventory/batch.js';
import { operationSchema } from '../inventory/operation.js';
import { productSchema } from '../product/product.js';
import { contractVersionSchema, opaqueReferenceSchema, quantitySchema } from '../shared/primitives.js';
import { draftStatusSchema } from './draft.js';

export const DRAFT_REVISION_CANONICALIZATION_VERSION = 'retail-draft-canonical-json-v1' as const;

const sha256DigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'Expected a lowercase SHA-256 digest');
const nonNegativePriceSchema = operationSchema.options[0].shape.proposedPrice;
const uniqueReferences = z.array(opaqueReferenceSchema).refine(
  (references) => new Set(references).size === references.length,
  'References must be unique',
);

export const draftRevisionInputSnapshotSchema = z.object({
  id: opaqueReferenceSchema,
  productIds: uniqueReferences.min(1),
  batchIds: uniqueReferences.min(1),
  evidenceIds: uniqueReferences.min(1),
  policyId: opaqueReferenceSchema,
  policyRevision: opaqueReferenceSchema,
}).strict();

const draftRevisionOperationBase = {
  operationId: opaqueReferenceSchema,
  draftId: opaqueReferenceSchema,
  productId: opaqueReferenceSchema,
  batchId: opaqueReferenceSchema,
  quantity: quantitySchema,
  evidenceIds: z.array(opaqueReferenceSchema),
};

export const draftRevisionOperationSchema = z.discriminatedUnion('kind', [
  z.object({
    ...draftRevisionOperationBase,
    kind: z.literal('MARKDOWN_PROPOSAL'),
    proposedPrice: nonNegativePriceSchema,
  }).strict(),
  z.object({
    ...draftRevisionOperationBase,
    kind: z.literal('DISPOSAL_PROPOSAL'),
    reasonCode: opaqueReferenceSchema,
  }).strict(),
]);

export const draftRevisionEvidenceDigestSchema = z.object({
  evidenceId: opaqueReferenceSchema,
  canonicalDigest: sha256DigestSchema,
}).strict();

export const draftRevisionContentSchema = z.object({
  inputSnapshot: draftRevisionInputSnapshotSchema,
  products: z.array(productSchema).min(1),
  batches: z.array(batchSchema).min(1),
  operations: z.array(draftRevisionOperationSchema).min(1),
  evidenceDigests: z.array(draftRevisionEvidenceDigestSchema).min(1),
  policy: z.object({
    contractVersion: contractVersionSchema,
    id: opaqueReferenceSchema,
    revision: opaqueReferenceSchema,
    evidenceIds: z.array(opaqueReferenceSchema).min(1),
  }).strict(),
}).strict().superRefine((content, context) => {
  const snapshot = content.inputSnapshot;
  const sameOrderedReferences = (actual: readonly string[], expected: readonly string[]) =>
    actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  const addMismatch = (path: (string | number)[], label: string) => context.addIssue({
    code: 'custom',
    path,
    message: label + ' must match the input snapshot',
  });

  if (!sameOrderedReferences(content.products.map((product) => product.id), snapshot.productIds)) {
    addMismatch(['products'], 'Product references');
  }
  if (!sameOrderedReferences(content.batches.map((batch) => batch.id), snapshot.batchIds)) {
    addMismatch(['batches'], 'Batch references');
  }
  if (!sameOrderedReferences(content.evidenceDigests.map((evidence) => evidence.evidenceId), snapshot.evidenceIds)) {
    addMismatch(['evidenceDigests'], 'Evidence references');
  }
  if (content.policy.id !== snapshot.policyId || content.policy.revision !== snapshot.policyRevision) {
    addMismatch(['policy'], 'Policy identity and revision');
  }

  const productIds = new Set(content.products.map((product) => product.id));
  const batchById = new Map(content.batches.map((batch) => [batch.id, batch]));
  const evidenceIds = new Set(snapshot.evidenceIds);
  for (const product of content.products) {
    for (const evidenceId of product.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) addMismatch(['products', product.id, 'evidenceIds'], 'Product Evidence references');
    }
  }
  for (const batch of content.batches) {
    if (!productIds.has(batch.productId)) addMismatch(['batches', batch.id, 'productId'], 'Batch Product reference');
    for (const evidenceId of batch.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) addMismatch(['batches', batch.id, 'evidenceIds'], 'Batch Evidence references');
    }
  }
  for (const operation of content.operations) {
    const batch = batchById.get(operation.batchId);
    if (!productIds.has(operation.productId) || batch?.productId !== operation.productId) {
      addMismatch(['operations', operation.operationId], 'Operation Product/Batch references');
    }
    for (const evidenceId of operation.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) addMismatch(['operations', operation.operationId, 'evidenceIds'], 'Operation Evidence references');
    }
  }
  for (const evidenceId of content.policy.evidenceIds) {
    if (!evidenceIds.has(evidenceId)) addMismatch(['policy', 'evidenceIds'], 'Policy Evidence references');
  }
});

export const draftRevisionTraceSchema = z.object({
  taskId: opaqueReferenceSchema,
  agentRunId: opaqueReferenceSchema.optional(),
  toolCallIds: z.array(opaqueReferenceSchema),
}).strict();

export const draftRevisionSchema = z.object({
  kind: z.literal('DRAFT_REVISION_CREATED'),
  contractVersion: contractVersionSchema,
  draftId: opaqueReferenceSchema,
  revision: z.number().int().positive().safe(),
  canonicalizationVersion: z.literal(DRAFT_REVISION_CANONICALIZATION_VERSION),
  canonicalDigest: sha256DigestSchema,
  content: draftRevisionContentSchema,
  initialStatus: z.literal('DRAFTED'),
  eventId: opaqueReferenceSchema,
  trace: draftRevisionTraceSchema,
}).strict().superRefine((revision, context) => {
  const addMismatch = (path: (string | number)[], message: string) => context.addIssue({
    code: 'custom',
    path,
    message,
  });
  if (new Set(revision.content.operations.map((operation) => operation.operationId)).size
    !== revision.content.operations.length) {
    addMismatch(['content', 'operations'], 'Operation IDs must be unique');
  }
  for (let index = 0; index < revision.content.operations.length; index += 1) {
    if (revision.content.operations[index]?.draftId !== revision.draftId) {
      addMismatch(['content', 'operations', index, 'draftId'], 'Operation Draft reference must match the revision');
    }
  }
  for (let index = 0; index < revision.content.products.length; index += 1) {
    if (revision.content.products[index]?.contractVersion !== revision.contractVersion) {
      addMismatch(['content', 'products', index, 'contractVersion'], 'Product contract version must match the revision');
    }
  }
  for (let index = 0; index < revision.content.batches.length; index += 1) {
    if (revision.content.batches[index]?.contractVersion !== revision.contractVersion) {
      addMismatch(['content', 'batches', index, 'contractVersion'], 'Batch contract version must match the revision');
    }
  }
  if (revision.content.policy.contractVersion !== revision.contractVersion) {
    addMismatch(['content', 'policy', 'contractVersion'], 'Policy contract version must match the revision');
  }
});

export type DraftRevision = z.infer<typeof draftRevisionSchema>;

export const draftRevisionStatusEventSchema = z.object({
  kind: z.literal('DRAFT_STATUS_TRANSITIONED'),
  draftId: opaqueReferenceSchema,
  revision: z.number().int().positive().safe(),
  fromStatus: draftStatusSchema,
  toStatus: draftStatusSchema,
  eventId: opaqueReferenceSchema,
  trace: draftRevisionTraceSchema,
}).strict();

export type DraftRevisionStatusEvent = z.infer<typeof draftRevisionStatusEventSchema>;

export const draftRevisionEventSchema = z.discriminatedUnion('kind', [
  draftRevisionSchema,
  draftRevisionStatusEventSchema,
]);
export type DraftRevisionEvent = z.infer<typeof draftRevisionEventSchema>;

