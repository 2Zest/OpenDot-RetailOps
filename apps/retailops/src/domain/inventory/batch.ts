import { z } from 'zod';
import { expirySchema, qualityStatusSchema } from '../expiry/expiry.js';
import { contractVersionSchema, decimalScale, decimalToScaledInteger, opaqueReferenceSchema } from '../shared/primitives.js';
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
  .strict()
  .superRefine((batch, context) => {
    const quality = qualityStatusSchema.safeParse(batch.qualityStatus);
    const balance = stockBalanceSchema.safeParse(batch.stockBalance);
    if (!quality.success || !balance.success || quality.data === 'PASS') return;

    if (isPositive(balance.data.availableToSell.value)) {
      context.addIssue({
        code: 'custom',
        path: ['stockBalance', 'availableToSell', 'value'],
        message: 'A batch without PASS quality cannot carry sellable stock',
      });
    }
    if (isPositive(balance.data.reserved.value)) {
      context.addIssue({
        code: 'custom',
        path: ['stockBalance', 'reserved', 'value'],
        message: 'A batch without PASS quality cannot carry active reserved stock',
      });
    }
  });

function isPositive(value: string): boolean {
  return decimalToScaledInteger(value, decimalScale(value)) > 0n;
}

export type Batch = z.infer<typeof batchSchema>;
