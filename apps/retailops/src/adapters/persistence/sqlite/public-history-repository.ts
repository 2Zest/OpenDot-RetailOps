import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import {
  canonicalSha256,
  freshRetailNetImportManifestSchema,
  publicHistoryImportId,
  publicHistoryRecordSha256,
  type FreshRetailNetImportManifest,
} from '../../../domain/history/fresh-retailnet-manifest.js';
import {
  freshRetailNetRecordSchema,
  freshRetailNetSourceRowSchema,
  freshRetailNetSourceColumnOrder,
  type FreshRetailNetRecord,
} from '../../../domain/history/fresh-retailnet-record.js';
import type {
  PublicHistoryImportResult,
  PublicHistoryQuery,
  PublicHistoryRecordWithProvenance,
  PublicHistoryRepository,
} from '../../../application/ports/public-history-repository.js';
import {
  dateOnlySchema,
} from '../../../domain/shared/primitives.js';
import {
  CorruptPersistedEntityError,
  ImmutableEntityConflictError,
  InvalidDomainEntityError,
  assertStoredFields,
  parseStoredEntity,
  withRetailOpsTransaction,
} from './database.js';

interface StoredHistoryRow {
  dataset: string;
  dataset_revision: string;
  source_split: string;
  store_id: number;
  product_id: number;
  dt: string;
  record_sha256: string;
  payload: string;
}

function manifestColumns(manifest: FreshRetailNetImportManifest): readonly (string | number)[] {
  return [manifest.dataset, manifest.datasetRevision, manifest.license, manifest.sourceSplit,
    manifest.sourcePath, manifest.sourceBytes, manifest.sourceLfsObjectSha256,
    manifest.sourceResponseBodySha256, manifest.sourceLocalFileSha256, manifest.rowCount,
    manifest.selectedStoreId, manifest.selectedSkuCount, manifest.firstDate, manifest.lastDate,
    manifest.snapshotJsonlSha256];
}

function validateQuery(query: PublicHistoryQuery): void {
  if (!query || query.datasetRevision !== 'c374e85975c82816c495acfa904cc55ab14a47d3'
    || (query.sourceSplit !== 'train' && query.sourceSplit !== 'eval')
    || !Number.isSafeInteger(query.storeId) || query.storeId < 0
    || (query.productId !== undefined && (!Number.isSafeInteger(query.productId) || query.productId < 0))
    || (query.fromDate !== undefined && !dateOnlySchema.safeParse(query.fromDate).success)
    || (query.throughDate !== undefined && !dateOnlySchema.safeParse(query.throughDate).success)
    || (query.fromDate !== undefined && query.throughDate !== undefined && query.fromDate > query.throughDate)) {
    throw new TypeError('Invalid public history query');
  }
}

export class SqlitePublicHistoryRepository implements PublicHistoryRepository {
  constructor(private readonly database: Database.Database) {}

  importSnapshot(
    manifestInput: FreshRetailNetImportManifest,
    recordInputs: readonly FreshRetailNetRecord[],
    sourceSnapshotJsonl: Uint8Array,
  ): PublicHistoryImportResult {
    const parsedManifest = freshRetailNetImportManifestSchema.safeParse(manifestInput);
    if (!parsedManifest.success) throw new InvalidDomainEntityError('FreshRetailNetImportManifest', parsedManifest.error.message);
    const manifest = parsedManifest.data;
    if (!(sourceSnapshotJsonl instanceof Uint8Array) || sourceSnapshotJsonl.byteLength === 0
      || createHash('sha256').update(sourceSnapshotJsonl).digest('hex') !== manifest.snapshotJsonlSha256) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL bytes do not match manifest SHA-256');
    }
    if (sourceSnapshotJsonl[0] === 0xef && sourceSnapshotJsonl[1] === 0xbb && sourceSnapshotJsonl[2] === 0xbf) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL must not contain a UTF-8 BOM');
    }
    let snapshotText: string;
    try {
      snapshotText = new TextDecoder('utf-8', { fatal: true }).decode(sourceSnapshotJsonl);
    } catch (error) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL is not valid UTF-8: ' + String(error));
    }
    if (snapshotText.startsWith('\uFEFF') || !snapshotText.endsWith('\n') || snapshotText.includes('\r')) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL framing is invalid');
    }
    const sourceLines = snapshotText.slice(0, -1).split('\n');
    if (sourceLines.length !== recordInputs.length || sourceLines.some((line) => line.length === 0)) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL row count or framing differs from records');
    }
    if (recordInputs.length !== manifest.rowCount) throw new InvalidDomainEntityError('FreshRetailNetImport', 'row count differs from manifest');

    const records = recordInputs.map((input, index) => {
      const parsed = freshRetailNetRecordSchema.safeParse(input);
      if (!parsed.success) throw new InvalidDomainEntityError('FreshRetailNetRecord[' + index + ']', parsed.error.message);
      const record = parsed.data;
      if (record.datasetRevision !== manifest.datasetRevision || record.sourceSplit !== manifest.sourceSplit
        || record.license !== manifest.license || record.source.store_id !== manifest.selectedStoreId) {
        throw new InvalidDomainEntityError('FreshRetailNetRecord[' + index + ']', 'source metadata differs from import manifest');
      }
      let sourceCandidate: unknown;
      try {
        sourceCandidate = JSON.parse(sourceLines[index] ?? '');
      } catch (error) {
        throw new InvalidDomainEntityError('FreshRetailNetImport', 'invalid JSONL source row ' + index + ': ' + String(error));
      }
      const parsedSource = freshRetailNetSourceRowSchema.safeParse(sourceCandidate);
      if (!parsedSource.success
        || Object.keys(sourceCandidate as Record<string, unknown>).length !== freshRetailNetSourceColumnOrder.length
        || !freshRetailNetSourceColumnOrder.every((name, columnIndex) => Object.keys(sourceCandidate as Record<string, unknown>).at(columnIndex) === name)
        || canonicalSha256(parsedSource.data) !== canonicalSha256(record.source)) {
        throw new InvalidDomainEntityError('FreshRetailNetRecord[' + index + ']', 'validated record differs from the corresponding raw JSONL row');
      }
      const previous = recordInputs[index - 1]?.source;
      if (previous !== undefined && (record.source.product_id < previous.product_id
        || (record.source.product_id === previous.product_id && record.source.dt <= previous.dt))) {
        throw new InvalidDomainEntityError('FreshRetailNetImport', 'raw JSONL rows are not ordered by product_id then dt');
      }
      return record;
    });

    const distinctKeys = new Set(records.map((record) => [record.source.store_id, record.source.product_id, record.source.dt].join('\u001f')));
    const skuCount = new Set(records.map((record) => record.source.product_id)).size;
    const dates = records.map((record) => record.source.dt).sort();
    if (distinctKeys.size !== records.length || skuCount !== manifest.selectedSkuCount
      || dates[0] !== manifest.firstDate || dates.at(-1) !== manifest.lastDate) {
      throw new InvalidDomainEntityError('FreshRetailNetImport', 'natural keys, SKU count, or date range differ from manifest');
    }
    const expectedDays = (Date.parse(manifest.lastDate + 'T00:00:00Z') - Date.parse(manifest.firstDate + 'T00:00:00Z')) / 86_400_000 + 1;
    const datesByProduct = new Map<number, string[]>();
    for (const record of records) {
      const productDates = datesByProduct.get(record.source.product_id) ?? [];
      productDates.push(record.source.dt);
      datesByProduct.set(record.source.product_id, productDates);
    }
    const expectedSkuDates = Array.from({ length: expectedDays }, (_, day) =>
      new Date(Date.parse(manifest.firstDate + 'T00:00:00Z') + day * 86_400_000).toISOString().slice(0, 10));
    for (const [productId, productDates] of datesByProduct) {
      if (productDates.sort().length !== expectedDays || productDates.some((value, index) => value !== expectedSkuDates[index])) {
        throw new InvalidDomainEntityError('FreshRetailNetImport', 'SKU ' + productId + ' does not cover each manifest date exactly once');
      }
    }

    const importId = publicHistoryImportId(manifest);
    const manifestPayload = JSON.stringify(manifest);
    return withRetailOpsTransaction(this.database, () => {
      const existingImport = this.database.prepare(
        'SELECT * FROM public_history_imports WHERE id = ?',
      ).get(importId) as Record<string, unknown> | undefined;
      if (existingImport !== undefined) {
        let storedManifest: unknown;
        try {
          storedManifest = JSON.parse(String(existingImport.payload));
        } catch (error) {
          throw new CorruptPersistedEntityError('PublicHistoryImport', importId, 'payload is not valid JSON', error);
        }
        const storedParsed = freshRetailNetImportManifestSchema.safeParse(storedManifest);
        if (!storedParsed.success || canonicalSha256(storedParsed.data) !== importId
          || existingImport.row_count !== manifest.rowCount) {
          throw new CorruptPersistedEntityError('PublicHistoryImport', importId, 'stored manifest does not match its identity or row count');
        }
        assertStoredFields(existingImport, {
          id: importId,
          dataset: manifest.dataset,
          dataset_revision: manifest.datasetRevision,
          license: manifest.license,
          source_split: manifest.sourceSplit,
          source_path: manifest.sourcePath,
          source_bytes: manifest.sourceBytes,
          source_lfs_object_sha256: manifest.sourceLfsObjectSha256,
          source_response_body_sha256: manifest.sourceResponseBodySha256,
          source_local_file_sha256: manifest.sourceLocalFileSha256,
          row_count: manifest.rowCount,
          selected_store_id: manifest.selectedStoreId,
          selected_sku_count: manifest.selectedSkuCount,
          first_date: manifest.firstDate,
          last_date: manifest.lastDate,
          snapshot_jsonl_sha256: manifest.snapshotJsonlSha256,
        }, 'PublicHistoryImport', importId);
      }
      if (existingImport === undefined) {
        this.database.prepare([
          'INSERT INTO public_history_imports (id, dataset, dataset_revision, license, source_split, source_path, source_bytes,',
          'source_lfs_object_sha256, source_response_body_sha256, source_local_file_sha256, row_count, selected_store_id,',
          'selected_sku_count, first_date, last_date, snapshot_jsonl_sha256, payload)',
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ].join(' ')).run(importId, ...manifestColumns(manifest), manifestPayload);
      }

      const findExisting = this.database.prepare([
        'SELECT record_sha256, payload FROM public_history_records',
        'WHERE dataset = ? AND dataset_revision = ? AND source_split = ? AND store_id = ? AND product_id = ? AND dt = ?',
      ].join(' '));
      const insertRecord = this.database.prepare([
        'INSERT INTO public_history_records(dataset, dataset_revision, source_split, store_id, product_id, dt, record_sha256, payload)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ].join(' '));
      const attachImport = this.database.prepare([
        'INSERT OR IGNORE INTO public_history_import_rows(import_id, dataset, dataset_revision, source_split, store_id, product_id, dt)',
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
      ].join(' '));

      let insertedRecords = 0;
      let unchangedRecords = 0;
      for (const record of records) {
        const recordPayload = JSON.stringify(record);
        const recordHash = publicHistoryRecordSha256(record);
        const key = [record.dataset, record.datasetRevision, record.sourceSplit, record.source.store_id,
          record.source.product_id, record.source.dt] as const;
        const existing = findExisting.get(...key) as { record_sha256: string; payload: string } | undefined;
        if (existing === undefined) {
          insertRecord.run(...key, recordHash, recordPayload);
          insertedRecords += 1;
        } else {
          const existingRecord = parseStoredEntity(freshRetailNetRecordSchema, existing.payload,
            'FreshRetailNetRecord', record.source.product_id + '/' + record.source.dt);
          if (existing.record_sha256 !== publicHistoryRecordSha256(existingRecord)
            || existing.record_sha256 !== recordHash) {
            if (existing.record_sha256 !== publicHistoryRecordSha256(existingRecord)) {
              throw new CorruptPersistedEntityError('FreshRetailNetRecord', record.source.product_id + '/' + record.source.dt,
                'record SHA-256 does not match payload');
            }
            throw new ImmutableEntityConflictError('FreshRetailNetRecord', key.join('/'));
          }
          unchangedRecords += 1;
        }
        attachImport.run(importId, ...key);
      }
      return { insertedRecords, unchangedRecords, importId };
    });
  }

  find(query: PublicHistoryQuery): readonly PublicHistoryRecordWithProvenance[] {
    validateQuery(query);
    const clauses = ['record.dataset = ?', 'record.dataset_revision = ?', 'record.source_split = ?', 'record.store_id = ?'];
    const parameters: (string | number)[] = ['Dingdong-Inc/FreshRetailNet-50K', query.datasetRevision, query.sourceSplit, query.storeId];
    if (query.productId !== undefined) {
      clauses.push('record.product_id = ?');
      parameters.push(query.productId);
    }
    if (query.fromDate !== undefined) {
      clauses.push('record.dt >= ?');
      parameters.push(query.fromDate);
    }
    if (query.throughDate !== undefined) {
      clauses.push('record.dt <= ?');
      parameters.push(query.throughDate);
    }
    const rows = this.database.prepare([
      'SELECT record.dataset, record.dataset_revision, record.source_split, record.store_id, record.product_id, record.dt,',
      'record.record_sha256, record.payload,',
      'import_record.import_id AS provenance_id, imports.dataset AS provenance_dataset,',
      'imports.dataset_revision AS provenance_revision, imports.license AS provenance_license,',
      'imports.source_split AS provenance_split, imports.source_path AS provenance_path, imports.source_bytes AS provenance_bytes,',
      'imports.source_lfs_object_sha256 AS provenance_lfs_sha256, imports.source_response_body_sha256 AS provenance_response_sha256,',
      'imports.source_local_file_sha256 AS provenance_local_sha256, imports.row_count AS provenance_row_count,',
      'imports.selected_store_id AS provenance_store_id, imports.selected_sku_count AS provenance_sku_count,',
      'imports.first_date AS provenance_first_date, imports.last_date AS provenance_last_date,',
      'imports.snapshot_jsonl_sha256 AS provenance_snapshot_sha256, imports.payload AS provenance_payload',
      'FROM public_history_records AS record',
      'LEFT JOIN public_history_import_rows AS import_record ON',
      'import_record.dataset = record.dataset AND import_record.dataset_revision = record.dataset_revision',
      'AND import_record.source_split = record.source_split AND import_record.store_id = record.store_id',
      'AND import_record.product_id = record.product_id AND import_record.dt = record.dt',
      'LEFT JOIN public_history_imports AS imports ON imports.id = import_record.import_id',
      'WHERE ' + clauses.join(' AND '),
      'ORDER BY record.dt, record.product_id, import_record.import_id',
    ].join(' ')).all(...parameters) as (StoredHistoryRow & {
      provenance_id: string | null;
      provenance_dataset: string | null;
      provenance_revision: string | null;
      provenance_license: string | null;
      provenance_split: string | null;
      provenance_path: string | null;
      provenance_bytes: number | null;
      provenance_lfs_sha256: string | null;
      provenance_response_sha256: string | null;
      provenance_local_sha256: string | null;
      provenance_row_count: number | null;
      provenance_store_id: number | null;
      provenance_sku_count: number | null;
      provenance_first_date: string | null;
      provenance_last_date: string | null;
      provenance_snapshot_sha256: string | null;
      provenance_payload: string | null;
    })[];

    const result = new Map<string, { record: FreshRetailNetRecord; manifests: Map<string, FreshRetailNetImportManifest> }>();
    for (const row of rows) {
      const rowIdentity = row.dataset + '\u001f' + row.dataset_revision + '\u001f' + row.source_split
        + '\u001f' + row.store_id + '\u001f' + row.product_id + '\u001f' + row.dt;
      const record = parseStoredEntity(freshRetailNetRecordSchema, row.payload, 'FreshRetailNetRecord', row.product_id + '/' + row.dt);
      assertStoredFields({ ...row }, {
        dataset: record.dataset,
        dataset_revision: record.datasetRevision,
        source_split: record.sourceSplit,
        store_id: record.source.store_id,
        product_id: record.source.product_id,
        dt: record.source.dt,
      }, 'FreshRetailNetRecord', row.product_id + '/' + row.dt);
      if (row.record_sha256 !== publicHistoryRecordSha256(record)) {
        throw new CorruptPersistedEntityError('FreshRetailNetRecord', row.product_id + '/' + row.dt, 'record SHA-256 does not match payload');
      }
      if (row.provenance_id === null || row.provenance_payload === null) {
        throw new CorruptPersistedEntityError('FreshRetailNetRecord', row.product_id + '/' + row.dt, 'source manifest association is missing');
      }
      let manifestCandidate: unknown;
      try {
        manifestCandidate = JSON.parse(row.provenance_payload);
      } catch (error) {
        throw new CorruptPersistedEntityError('PublicHistoryImport', row.provenance_id, 'payload is not valid JSON', error);
      }
      const parsedManifest = freshRetailNetImportManifestSchema.safeParse(manifestCandidate);
      if (!parsedManifest.success || publicHistoryImportId(parsedManifest.data) !== row.provenance_id) {
        throw new CorruptPersistedEntityError('PublicHistoryImport', row.provenance_id, 'manifest payload does not match its identity');
      }
      assertStoredFields({ ...row }, {
        provenance_dataset: parsedManifest.data.dataset,
        provenance_revision: parsedManifest.data.datasetRevision,
        provenance_license: parsedManifest.data.license,
        provenance_split: parsedManifest.data.sourceSplit,
        provenance_path: parsedManifest.data.sourcePath,
        provenance_bytes: parsedManifest.data.sourceBytes,
        provenance_lfs_sha256: parsedManifest.data.sourceLfsObjectSha256,
        provenance_response_sha256: parsedManifest.data.sourceResponseBodySha256,
        provenance_local_sha256: parsedManifest.data.sourceLocalFileSha256,
        provenance_row_count: parsedManifest.data.rowCount,
        provenance_store_id: parsedManifest.data.selectedStoreId,
        provenance_sku_count: parsedManifest.data.selectedSkuCount,
        provenance_first_date: parsedManifest.data.firstDate,
        provenance_last_date: parsedManifest.data.lastDate,
        provenance_snapshot_sha256: parsedManifest.data.snapshotJsonlSha256,
      }, 'PublicHistoryImport', row.provenance_id);
      if (parsedManifest.data.datasetRevision !== record.datasetRevision
        || parsedManifest.data.sourceSplit !== record.sourceSplit
        || parsedManifest.data.selectedStoreId !== record.source.store_id
        || record.source.dt < parsedManifest.data.firstDate || record.source.dt > parsedManifest.data.lastDate) {
        throw new CorruptPersistedEntityError('PublicHistoryImport', row.provenance_id, 'manifest is inconsistent with its linked row');
      }
      const existing = result.get(rowIdentity) ?? { record, manifests: new Map<string, FreshRetailNetImportManifest>() };
      if (!existing.manifests.has(row.provenance_id)) existing.manifests.set(row.provenance_id, parsedManifest.data);
      result.set(rowIdentity, existing);
    }
    return [...result.values()].map((entry) => ({ record: entry.record, importManifests: [...entry.manifests.values()] }));
  }
}
