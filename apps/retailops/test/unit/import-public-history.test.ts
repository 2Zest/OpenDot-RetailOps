import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { importPublicHistory } from '../../src/application/use-cases/import-public-history.js';
import type { PublicHistoryRepository } from '../../src/application/ports/public-history-repository.js';

const row = (productId: number, dt: string, saleAmount = 0.5) => ({
  city_id: 0, store_id: 0, management_group_id: 2, first_category_id: 29, second_category_id: 78,
  third_category_id: 82, product_id: productId, dt, sale_amount: saleAmount,
  hours_sale: Array.from({ length: 24 }, (_, index) => index === 8 ? saleAmount : 0),
  stock_hour6_22_cnt: 16, hours_stock_status: Array.from({ length: 24 }, (_, index) => index >= 6 && index < 22 ? 1 : 0),
  discount: 0.882, holiday_flag: 0, activity_flag: 1, precpt: 1.6999, avg_temperature: 15.48,
  avg_humidity: 73.54, avg_wind_level: 1.97,
});

const bytesFor = (rows: readonly unknown[]) => new TextEncoder().encode(rows.map((value) => JSON.stringify(value)).join('\n') + '\n');

function manifestFor(bytes: Uint8Array, rowCount: number, selectedSkuCount: number, firstDate: string, lastDate: string) {
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
    snapshotJsonlSha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function fakeRepository(): { readonly repository: PublicHistoryRepository; readonly imports: unknown[] } {
  const imports: unknown[] = [];
  const repository: PublicHistoryRepository = {
    importSnapshot(manifest, records) {
      imports.push({ manifest, records });
      return { insertedRecords: records.length, unchangedRecords: 0, importId: 'test-import-id' };
    },
    find() { return []; },
  };
  return { repository, imports };
}

describe('importPublicHistory', () => {
  it('hashes exact LF-terminated JSONL bytes before allowing persistence', () => {
    const bytes = bytesFor([row(4, '2024-03-28'), row(6, '2024-03-28', 0.25)]);
    const target = fakeRepository();
    const result = importPublicHistory({
      manifest: manifestFor(bytes, 2, 2, '2024-03-28', '2024-03-28'),
      snapshotJsonl: bytes,
    }, target.repository);
    expect(result).toMatchObject({ status: 'IMPORTED', persistence: { insertedRecords: 2 } });
    expect(target.imports).toHaveLength(1);
  });

  it('rejects a changed snapshot, non-LF framing, malformed row, and invalid source fields without persistence', () => {
    const validBytes = bytesFor([row(4, '2024-03-28')]);
    const target = fakeRepository();
    const changed = new TextEncoder().encode(new TextDecoder().decode(validBytes) + ' ');
    expect(importPublicHistory({ manifest: manifestFor(validBytes, 1, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: changed }, target.repository))
      .toMatchObject({ status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'SNAPSHOT_HASH_MISMATCH' })]) });
    expect(importPublicHistory({ manifest: manifestFor(validBytes, 1, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: new TextEncoder().encode(new TextDecoder().decode(validBytes).replaceAll('\n', '\r\n')) }, target.repository))
      .toMatchObject({ status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_JSONL_FRAMING' })]) });
    const malformed = bytesFor([{ ...row(4, '2024-03-28'), hours_sale: [0] }]);
    expect(importPublicHistory({ manifest: manifestFor(malformed, 1, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: malformed }, target.repository))
      .toMatchObject({ status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SOURCE_ROW' })]) });
    expect(target.imports).toHaveLength(0);
  });

  it('reports duplicate natural keys and coverage mismatches rather than silently importing', () => {
    const bytes = bytesFor([row(4, '2024-03-28'), row(4, '2024-03-28')]);
    const target = fakeRepository();
    const result = importPublicHistory({ manifest: manifestFor(bytes, 2, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: bytes }, target.repository);
    expect(result).toMatchObject({ status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_INPUT_KEY' })]) });
    expect(target.imports).toHaveLength(0);
  });

  it('rejects BOM, altered source-column order, and rows outside the extraction sort order', () => {
    const target = fakeRepository();
    const valid = bytesFor([row(4, '2024-03-28')]);
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...valid]);
    expect(importPublicHistory({
      manifest: manifestFor(withBom, 1, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: withBom,
    }, target.repository)).toMatchObject({
      status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_JSONL_FRAMING' })]),
    });

    const reorderedColumns = bytesFor([Object.fromEntries(Object.entries(row(4, '2024-03-28')).reverse())]);
    expect(importPublicHistory({
      manifest: manifestFor(reorderedColumns, 1, 1, '2024-03-28', '2024-03-28'), snapshotJsonl: reorderedColumns,
    }, target.repository)).toMatchObject({
      status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SOURCE_COLUMNS' })]),
    });

    const unsortedRows = bytesFor([row(6, '2024-03-28'), row(4, '2024-03-28')]);
    expect(importPublicHistory({
      manifest: manifestFor(unsortedRows, 2, 2, '2024-03-28', '2024-03-28'), snapshotJsonl: unsortedRows,
    }, target.repository)).toMatchObject({
      status: 'REJECTED', issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_JSONL_ORDER' })]),
    });
    expect(target.imports).toHaveLength(0);
  });
});
