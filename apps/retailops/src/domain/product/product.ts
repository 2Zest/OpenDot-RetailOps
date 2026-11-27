import { z } from 'zod';
import { contractVersionSchema, opaqueReferenceSchema, unitCodeSchema } from '../shared/primitives.js';

export const productSchema = z
  .object({
    contractVersion: contractVersionSchema,
    id: opaqueReferenceSchema,
    baseUnitCode: unitCodeSchema,
    evidenceIds: z.array(opaqueReferenceSchema).min(1),
  })
  .strict();

export type Product = z.infer<typeof productSchema>;
