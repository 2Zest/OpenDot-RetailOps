import { z } from 'zod';
import { contractVersionSchema, opaqueReferenceSchema } from '../shared/primitives.js';

export const policySchema = z
  .object({
    contractVersion: contractVersionSchema,
    id: opaqueReferenceSchema,
    revision: opaqueReferenceSchema,
    evidenceIds: z.array(opaqueReferenceSchema).min(1),
  })
  .strict();

export type Policy = z.infer<typeof policySchema>;
