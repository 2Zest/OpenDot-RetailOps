import { z } from 'zod';
import { contractVersionSchema, instantSchema, opaqueReferenceSchema } from '../shared/primitives.js';

const evidenceBase = {
  contractVersion: contractVersionSchema,
  id: opaqueReferenceSchema,
  snapshotId: opaqueReferenceSchema,
  locator: opaqueReferenceSchema,
  observedAt: instantSchema,
};

export const evidenceSchema = z.discriminatedUnion('sourceKind', [
  z
    .object({
      ...evidenceBase,
      sourceKind: z.literal('PUBLIC_HISTORICAL'),
      sourceName: opaqueReferenceSchema,
      sourceRevision: opaqueReferenceSchema,
    })
    .strict(),
  z
    .object({
      ...evidenceBase,
      sourceKind: z.literal('DERIVED'),
      parentEvidenceIds: z.array(opaqueReferenceSchema).min(1),
      methodVersion: opaqueReferenceSchema,
    })
    .strict()
    .refine((evidence) => new Set(evidence.parentEvidenceIds).size === evidence.parentEvidenceIds.length, {
      path: ['parentEvidenceIds'],
      message: 'Parent Evidence references must be unique',
    }),
  z
    .object({
      ...evidenceBase,
      sourceKind: z.literal('SIMULATED'),
      scenarioId: opaqueReferenceSchema,
      seed: opaqueReferenceSchema,
      generatorVersion: opaqueReferenceSchema,
    })
    .strict(),
  z
    .object({
      ...evidenceBase,
      sourceKind: z.literal('LIVE_DEVICE'),
      deviceRef: opaqueReferenceSchema,
      sourceRevision: opaqueReferenceSchema,
    })
    .strict(),
]);

export type Evidence = z.infer<typeof evidenceSchema>;
