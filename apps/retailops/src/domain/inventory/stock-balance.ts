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
    const unitCodes = [
      balance.physicalOnHand.unitCode,
      balance.unavailable.unitCode,
      balance.availableToSell.unitCode,
      balance.reserved.unitCode,
    ];
    if (new Set(unitCodes).size !== 1) {
      context.addIssue({ code: 'custom', path: ['physicalOnHand', 'unitCode'], message: 'Inventory partitions must use the same unit' });
      return;
    }
    const partitions = [balance.unavailable.value, balance.availableToSell.value, balance.reserved.value];
    if (!decimalSumEquals(balance.physicalOnHand.value, partitions)) {
      context.addIssue({ code: 'custom', path: ['physicalOnHand', 'value'], message: 'Physical stock must equal the mutually exclusive inventory partitions' });
    }
  });

export type StockBalance = z.infer<typeof stockBalanceSchema>;
