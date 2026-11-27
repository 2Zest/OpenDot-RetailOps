import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { validatePublicHistorySnapshot } from '../../src/application/use-cases/import-public-history.js';
import { SqlitePublicHistoryRepository } from '../../src/adapters/persistence/sqlite/public-history-repository.js';
import { openRetailOpsDatabase } from '../../src/adapters/persistence/sqlite/database.js';
import type { PublicHistoryRepository } from '../../src/application/ports/public-history-repository.js';

const databases: ReturnType<typeof openRetailOpsDatabase>[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function importSyntheticFixtureOnly(input: Parameters<typeof validatePublicHistorySnapshot>[0], repository: PublicHistoryRepository) {
  const validated = validatePublicHistorySnapshot(input);
  if (validated.status === 'REJECTED') return validated;
  return {
    status: 'IMPORTED' as const,
    persistence: repository.importSnapshot(validated.manifest, validated.records, input.snapshotJsonl),
  };
}

describe('synthetic public history parser and repository contract', () => {
  it('validates a synthetic fixture, persists it idempotently, and returns its source manifest with query results', () => {
    const database = openRetailOpsDatabase(':memory:');
    databases.push(database);
    const repository = new SqlitePublicHistoryRepository(database);
    const row = {
      city_id: 0, store_id: 0, management_group_id: 2, first_category_id: 29, second_category_id: 78,
      third_category_id: 82, product_id: 4, dt: '2024-03-28', sale_amount: 0.5,
      hours_sale: Array.from({ length: 24 }, (_, index) => index === 8 ? 0.5 : 0),
      stock_hour6_22_cnt: 16,
      hours_stock_status: Array.from({ length: 24 }, (_, index) => index >= 6 && index < 22 ? 1 : 0),
      discount: 0.882, holiday_flag: 0, activity_flag: 1, precpt: 1.6999, avg_temperature: 15.48,
      avg_humidity: 73.54, avg_wind_level: 1.97,
    };
    const snapshotJsonl = new TextEncoder().encode(JSON.stringify(row) + '\n');
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
      snapshotJsonlSha256: createHash('sha256').update(snapshotJsonl).digest('hex'),
    };

    expect(importSyntheticFixtureOnly({ manifest, snapshotJsonl }, repository)).toMatchObject({
      status: 'IMPORTED', persistence: { insertedRecords: 1, unchangedRecords: 0 },
    });
    expect(importSyntheticFixtureOnly({ manifest, snapshotJsonl }, repository)).toMatchObject({
      status: 'IMPORTED', persistence: { insertedRecords: 0, unchangedRecords: 1 },
    });
    expect(repository.find({
      datasetRevision: manifest.datasetRevision, sourceSplit: 'train', storeId: 0, productId: 4,
    })).toMatchObject([{ record: { source: row }, importManifests: [manifest] }]);
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_records').get()).toEqual({ count: 1 });
  });
});
