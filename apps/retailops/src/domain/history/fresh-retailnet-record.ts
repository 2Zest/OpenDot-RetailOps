import { z } from 'zod';
import { CONTRACT_VERSION } from '../shared/primitives.js';

export const freshRetailNetRevision = 'c374e85975c82816c495acfa904cc55ab14a47d3' as const;
export const freshRetailNetDataset = 'Dingdong-Inc/FreshRetailNet-50K' as const;
export const freshRetailNetLicense = 'CC BY 4.0' as const;

export const freshRetailNetSourceColumnOrder = [
  'city_id', 'store_id', 'management_group_id', 'first_category_id', 'second_category_id', 'third_category_id',
  'product_id', 'dt', 'sale_amount', 'hours_sale', 'stock_hour6_22_cnt', 'hours_stock_status', 'discount',
  'holiday_flag', 'activity_flag', 'precpt', 'avg_temperature', 'avg_humidity', 'avg_wind_level',
] as const;

const finiteNumber = z.number().finite();
const nonNegativeId = z.number().int().safe().nonnegative();

/** Source columns are kept in their provider names and units. */
export const freshRetailNetSourceRowSchema = z.object({
  city_id: nonNegativeId,
  store_id: nonNegativeId,
  management_group_id: nonNegativeId,
  first_category_id: nonNegativeId,
  second_category_id: nonNegativeId,
  third_category_id: nonNegativeId,
  product_id: nonNegativeId,
  dt: z.string().date(),
  sale_amount: finiteNumber,
  hours_sale: z.array(finiteNumber).length(24),
  stock_hour6_22_cnt: z.number().int().safe().min(0).max(16),
  hours_stock_status: z.array(z.union([z.literal(0), z.literal(1)])).length(24),
  discount: finiteNumber,
  holiday_flag: z.number().int().safe(),
  activity_flag: z.number().int().safe(),
  precpt: finiteNumber,
  avg_temperature: finiteNumber,
  avg_humidity: finiteNumber,
  avg_wind_level: finiteNumber,
}).strict().superRefine((row, context) => {
  const reportedOutOfStockHours = row.hours_stock_status.slice(6, 22).reduce<number>((sum, status) => sum + status, 0);
  if (row.stock_hour6_22_cnt !== reportedOutOfStockHours) {
    context.addIssue({
      code: 'custom',
      path: ['stock_hour6_22_cnt'],
      message: 'Source out-of-stock hour count does not match hours_stock_status[6:22]',
    });
  }
});

export const freshRetailNetRecordSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  dataset: z.literal(freshRetailNetDataset),
  datasetRevision: z.literal(freshRetailNetRevision),
  license: z.literal(freshRetailNetLicense),
  sourceSplit: z.enum(['train', 'eval']),
  source: freshRetailNetSourceRowSchema,
}).strict();

export type FreshRetailNetSourceRow = z.infer<typeof freshRetailNetSourceRowSchema>;
export type FreshRetailNetRecord = z.infer<typeof freshRetailNetRecordSchema>;

export function freshRetailNetNaturalKey(record: FreshRetailNetRecord): string {
  return [record.datasetRevision, record.sourceSplit, record.source.store_id,
    record.source.product_id, record.source.dt].join('\u001f');
}
