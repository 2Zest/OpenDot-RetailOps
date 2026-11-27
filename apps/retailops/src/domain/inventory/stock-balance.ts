import { z } from 'zod';
import { decimalSumEquals, quantitySchema } from '../shared/primitives.js';

export const stockBalanceSchema = z
  .object({
    physicalOnHand: quantitySchema,
    unavailable: quantitySchema,
    availableToSell: quantitySchema,
    reserved: quantitySchema,
  })
  .strict()
  .superRefine((balance, context) => {
    const physical = quantitySchema.safeParse(balance.physicalOnHand);
    const unavailable = quantitySchema.safeParse(balance.unavailable);
    const available = quantitySchema.safeParse(balance.availableToSell);
    const reserved = quantitySchema.safeParse(balance.reserved);
    if (!physical.success || !unavailable.success || !available.success || !reserved.success) return;

    const unitCodes = [
      physical.data.unitCode,
      unavailable.data.unitCode,
      available.data.unitCode,
      reserved.data.unitCode,
    ];
    if (new Set(unitCodes).size !== 1) {
      context.addIssue({ code: 'custom', path: ['physicalOnHand', 'unitCode'], message: 'Inventory partitions must use the same unit' });
      return;
    }
    const partitions = [unavailable.data.value, available.data.value, reserved.data.value];
    if (!decimalSumEquals(physical.data.value, partitions)) {
      context.addIssue({ code: 'custom', path: ['physicalOnHand', 'value'], message: 'Physical stock must equal the mutually exclusive inventory partitions' });
    }
  });

export type StockBalance = z.infer<typeof stockBalanceSchema>;
