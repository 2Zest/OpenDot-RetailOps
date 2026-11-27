import { describe, expect, it } from 'vitest';
import { freshRetailNetRecordSchema, freshRetailNetSourceRowSchema } from '../../../../src/domain/history/fresh-retailnet-record.js';
import { freshRetailNetImportManifestSchema, publicHistoryImportId } from '../../../../src/domain/history/fresh-retailnet-manifest.js';

const row = {
  city_id: 0,
  store_id: 0,
  management_group_id: 2,
  first_category_id: 29,
  second_category_id: 78,
  third_category_id: 82,
  product_id: 4,
  dt: '2024-03-28',
  sale_amount: 0.5,
  hours_sale: Array.from({ length: 24 }, (_, index) => index === 8 ? 0.5 : 0),
  stock_hour6_22_cnt: 16,
  hours_stock_status: Array.from({ length: 24 }, (_, index) => index >= 6 && index < 22 ? 1 : 0),
  discount: 0.882,
  holiday_flag: 0,
  activity_flag: 1,
  precpt: 1.6999,
  avg_temperature: 15.48,
  avg_humidity: 73.54,
  avg_wind_level: 1.97,
};

describe('FreshRetailNet v0.3.0 source contract', () => {
  it('preserves provider-normalized source values and rejects unknown or malformed fields', () => {
    expect(freshRetailNetSourceRowSchema.parse(row)).toEqual(row);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, unregistered: true }).success).toBe(false);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, dt: '2024-02-30' }).success).toBe(false);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, hours_sale: [1] }).success).toBe(false);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, hours_stock_status: Array(24).fill(2) }).success).toBe(false);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, sale_amount: Number.NaN }).success).toBe(false);
    expect(freshRetailNetSourceRowSchema.safeParse({ ...row, stock_hour6_22_cnt: 15 }).success).toBe(false);
  });

  it('requires fixed source identity on records', () => {
    const record = {
      contractVersion: '0.3.0',
      dataset: 'Dingdong-Inc/FreshRetailNet-50K',
      datasetRevision: 'c374e85975c82816c495acfa904cc55ab14a47d3',
      license: 'CC BY 4.0',
      sourceSplit: 'train',
      source: row,
    };
    expect(freshRetailNetRecordSchema.parse(record)).toEqual(record);
    expect(freshRetailNetRecordSchema.safeParse({ ...record, datasetRevision: 'main' }).success).toBe(false);
  });

  it('validates independent hash provenance and derives a stable import identity', () => {
    const manifest = {
      contractVersion: '0.3.0',
      dataset: 'Dingdong-Inc/FreshRetailNet-50K',
      datasetRevision: 'c374e85975c82816c495acfa904cc55ab14a47d3',
      license: 'CC BY 4.0',
      sourceSplit: 'train',
      sourcePath: 'data/train.parquet',
      sourceBytes: 106_436_287,
      sourceLfsObjectSha256: '6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d',
      sourceResponseBodySha256: '6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d',
      sourceLocalFileSha256: '6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d',
      rowCount: 1,
      selectedStoreId: 0,
      selectedSkuCount: 1,
      firstDate: '2024-03-28',
      lastDate: '2024-03-28',
      snapshotJsonlSha256: 'b'.repeat(64),
    };
    const parsed = freshRetailNetImportManifestSchema.parse(manifest);
    expect(publicHistoryImportId(parsed)).toBe(publicHistoryImportId({ ...parsed }));
    expect(freshRetailNetImportManifestSchema.safeParse({ ...manifest,
      sourceLfsObjectSha256: 'c'.repeat(64), sourceResponseBodySha256: 'c'.repeat(64), sourceLocalFileSha256: 'c'.repeat(64),
    }).success).toBe(false);
  });
});
