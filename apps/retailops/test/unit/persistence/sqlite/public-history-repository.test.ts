import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { openRetailOpsDatabase, ImmutableEntityConflictError, CorruptPersistedEntityError, InvalidDomainEntityError } from '../../../../src/adapters/persistence/sqlite/database.js';
import { SqlitePublicHistoryRepository } from '../../../../src/adapters/persistence/sqlite/public-history-repository.js';
import type { FreshRetailNetImportManifest } from '../../../../src/domain/history/fresh-retailnet-manifest.js';
import type { FreshRetailNetRecord } from '../../../../src/domain/history/fresh-retailnet-record.js';

const databases: ReturnType<typeof openRetailOpsDatabase>[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function databaseAndRepository() {
  const database = openRetailOpsDatabase(':memory:');
  databases.push(database);
  return { database, repository: new SqlitePublicHistoryRepository(database) };
}

function makeRecord(productId: number, dt: string, saleAmount = 0.5): FreshRetailNetRecord {
  return {
    contractVersion: '0.3.0',
    dataset: 'Dingdong-Inc/FreshRetailNet-50K',
    datasetRevision: 'c374e85975c82816c495acfa904cc55ab14a47d3',
    license: 'CC BY 4.0',
    sourceSplit: 'train',
    source: {
      city_id: 0, store_id: 0, management_group_id: 2, first_category_id: 29, second_category_id: 78,
      third_category_id: 82, product_id: productId, dt, sale_amount: saleAmount,
      hours_sale: Array.from({ length: 24 }, (_, index) => index === 8 ? saleAmount : 0),
      stock_hour6_22_cnt: 16,
      hours_stock_status: Array.from({ length: 24 }, (_, index) => index >= 6 && index < 22 ? 1 : 0),
      discount: 0.882, holiday_flag: 0, activity_flag: 1, precpt: 1.6999, avg_temperature: 15.48,
      avg_humidity: 73.54, avg_wind_level: 1.97,
    },
  };
}

function snapshotFor(records: readonly FreshRetailNetRecord[]): Uint8Array {
  return new TextEncoder().encode(records.map((record) => JSON.stringify(record.source)).join('\n') + '\n');
}

function makeManifest(rowCount: number, selectedSkuCount: number, firstDate: string, lastDate: string, snapshot: Uint8Array): FreshRetailNetImportManifest {
  return {
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
    rowCount,
    selectedStoreId: 0,
    selectedSkuCount,
    firstDate,
    lastDate,
    snapshotJsonlSha256: createHash('sha256').update(snapshot).digest('hex'),
  };
}

describe('SqlitePublicHistoryRepository', () => {
  it('stores source provenance, is idempotent, and queries without changing source units', () => {
    const { database, repository } = databaseAndRepository();
    const records = [makeRecord(4, '2024-03-28'), makeRecord(6, '2024-03-28', 0.25)];
    const snapshot = snapshotFor(records);
    const manifest = makeManifest(2, 2, '2024-03-28', '2024-03-28', snapshot);

    expect(repository.importSnapshot(manifest, records, snapshot)).toMatchObject({ insertedRecords: 2, unchangedRecords: 0 });
    expect(repository.importSnapshot(manifest, records, snapshot)).toMatchObject({ insertedRecords: 0, unchangedRecords: 2 });
    const queried = repository.find({
      datasetRevision: manifest.datasetRevision, sourceSplit: 'train', storeId: 0,
      productId: 6, fromDate: '2024-03-28', throughDate: '2024-03-28',
    });
    expect(queried).toEqual([{ record: records[1], importManifests: [manifest] }]);
    expect(queried[0]?.record.source.sale_amount).toBe(0.25);
    expect(() => repository.find({
      datasetRevision: manifest.datasetRevision, sourceSplit: 'train', storeId: 0, fromDate: '2024-02-30',
    })).toThrow(TypeError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_imports').get()).toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_import_rows').get()).toEqual({ count: 2 });
  });

  it('rejects a changed source record and rolls back earlier rows in the same snapshot', () => {
    const { database, repository } = databaseAndRepository();
    const original = makeRecord(4, '2024-03-29');
    const originalSnapshot = snapshotFor([original]);
    repository.importSnapshot(makeManifest(1, 1, '2024-03-29', '2024-03-29', originalSnapshot), [original], originalSnapshot);
    const conflictingRecords = [makeRecord(4, '2024-03-28'), makeRecord(4, '2024-03-29', 0.75)];
    const conflictingSnapshot = snapshotFor(conflictingRecords);
    const changedManifest = makeManifest(2, 1, '2024-03-28', '2024-03-29', conflictingSnapshot);

    expect(() => repository.importSnapshot(changedManifest, conflictingRecords, conflictingSnapshot)).toThrow(ImmutableEntityConflictError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_records').get()).toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_imports').get()).toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_import_rows').get()).toEqual({ count: 1 });
  });

  it('rejects corrupted persisted source payloads', () => {
    const { database, repository } = databaseAndRepository();
    const record = makeRecord(4, '2024-03-28');
    const snapshot = snapshotFor([record]);
    repository.importSnapshot(makeManifest(1, 1, '2024-03-28', '2024-03-28', snapshot), [record], snapshot);
    database.prepare('UPDATE public_history_records SET payload = ?').run('{"not":"the source contract"}');

    expect(() => repository.find({
      datasetRevision: record.datasetRevision, sourceSplit: 'train', storeId: 0,
    })).toThrow(CorruptPersistedEntityError);
  });

  it('independently binds repository rows to the exact JSONL bytes', () => {
    const { database, repository } = databaseAndRepository();
    const record = makeRecord(4, '2024-03-28');
    const snapshot = snapshotFor([record]);
    const manifest = makeManifest(1, 1, '2024-03-28', '2024-03-28', snapshot);
    const changedSnapshot = new Uint8Array(snapshot);
    changedSnapshot[0] = changedSnapshot[0] === 0x7b ? 0x5b : 0x7b;

    expect(() => repository.importSnapshot(manifest, [record], changedSnapshot)).toThrow(InvalidDomainEntityError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_records').get()).toEqual({ count: 0 });
  });

  it('rejects a BOM even if the supplied manifest hash was recomputed', () => {
    const { database, repository } = databaseAndRepository();
    const record = makeRecord(4, '2024-03-28');
    const source = snapshotFor([record]);
    const bomSnapshot = new Uint8Array([0xef, 0xbb, 0xbf, ...source]);
    const manifest = makeManifest(1, 1, '2024-03-28', '2024-03-28', bomSnapshot);

    expect(() => repository.importSnapshot(manifest, [record], bomSnapshot)).toThrow(InvalidDomainEntityError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM public_history_records').get()).toEqual({ count: 0 });
  });

  it('rejects source rows whose provenance association was removed', () => {
    const { database, repository } = databaseAndRepository();
    const record = makeRecord(4, '2024-03-28');
    const snapshot = snapshotFor([record]);
    repository.importSnapshot(makeManifest(1, 1, '2024-03-28', '2024-03-28', snapshot), [record], snapshot);
    database.prepare('DELETE FROM public_history_import_rows').run();

    expect(() => repository.find({
      datasetRevision: record.datasetRevision, sourceSplit: 'train', storeId: 0,
    })).toThrow(CorruptPersistedEntityError);
  });
});
