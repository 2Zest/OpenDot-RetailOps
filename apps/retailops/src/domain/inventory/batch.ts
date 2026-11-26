import { z } from 'zod';
import { expirySchema, qualityStatusSchema } from '../expiry/expiry.js';
import { contractVersionSchema, opaqueReferenceSchema } from '../shared/primitives.js';
import { stockBalanceSchema } from './stock-balance.js';

export const batchSchema = z
  .object({
    contractVersion: contractVersionSchema,
    id: opaqueReferenceSchema,
    productId: opaqueReferenceSchema,
    expiry: expirySchema,
    qualityStatus: qualityStatusSchema,
    stockBalance: stockBalanceSchema,
    evidenceIds: z.array(opaqueReferenceSchema).min(1),
  })
  .strict();

export type Batch = z.infer<typeof batchSchema>;
