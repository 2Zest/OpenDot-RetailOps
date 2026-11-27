import { createHash } from 'node:crypto';
import {
  freshRetailNetNaturalKey,
  freshRetailNetRecordSchema,
  freshRetailNetSourceRowSchema,
  freshRetailNetSourceColumnOrder,
  type FreshRetailNetRecord,
} from '../../domain/history/fresh-retailnet-record.js';
import {
  freshRetailNetImportManifestSchema,
  type FreshRetailNetImportManifest,
} from '../../domain/history/fresh-retailnet-manifest.js';
import type { PublicHistoryImportResult, PublicHistoryRepository } from '../ports/public-history-repository.js';

export interface ImportPublicHistoryInput {
  readonly manifest: unknown;
  /**
   * Exact UTF-8 JSONL bytes emitted by the fixed-revision extraction step:
   * source Parquet column order, product_id/dt ascending, one compact object
   * per LF-terminated line, no BOM/CRLF/blank lines. The manifest hash covers
   * every byte including the final LF.
   */
  readonly snapshotJsonl: Uint8Array;
}

export interface ImportPublicHistoryIssue {
  readonly index: number | null;
  readonly code: string;
  readonly message: string;
}

export type ImportPublicHistoryResult =
  | { readonly status: 'IMPORTED'; readonly persistence: PublicHistoryImportResult }
  | { readonly status: 'REJECTED'; readonly issues: readonly ImportPublicHistoryIssue[] };

export type ValidatePublicHistorySnapshotResult =
  | { readonly status: 'VALIDATED'; readonly manifest: FreshRetailNetImportManifest; readonly records: readonly FreshRetailNetRecord[] }
  | { readonly status: 'REJECTED'; readonly issues: readonly ImportPublicHistoryIssue[] };

const acceptedSnapshotMetadata = {
  train: {
    sha256: '4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005',
    rowCount: 6_660,
    selectedStoreId: 0,
    selectedSkuCount: 74,
    skuSetSha256: '1797d24e2e407ce6ab82531549a5508e6ea257c5cd0b9853af2d2e606796834b',
    firstDate: '2024-03-28',
    lastDate: '2024-06-25',
  },
  eval: {
    sha256: '0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2',
    rowCount: 518,
    selectedStoreId: 0,
    selectedSkuCount: 74,
    skuSetSha256: '1797d24e2e407ce6ab82531549a5508e6ea257c5cd0b9853af2d2e606796834b',
    firstDate: '2024-06-26',
    lastDate: '2024-07-02',
  },
} as const;

/**
 * Validates JSONL structure and its manifest without asserting that the bytes
 * came from the accepted public snapshot. Synthetic contract tests may use
 * this parser, but only importPublicHistory is the trusted import route.
 */
export function validatePublicHistorySnapshot(input: ImportPublicHistoryInput): ValidatePublicHistorySnapshotResult {
  const issues: ImportPublicHistoryIssue[] = [];
  const manifestResult = freshRetailNetImportManifestSchema.safeParse(input.manifest);
  if (!manifestResult.success) {
    issues.push({ index: null, code: 'INVALID_MANIFEST', message: manifestResult.error.message });
  }
  let decodedLines: string[] = [];
  if (!(input.snapshotJsonl instanceof Uint8Array) || input.snapshotJsonl.byteLength === 0) {
    issues.push({ index: null, code: 'EMPTY_SNAPSHOT', message: 'A non-empty UTF-8 JSONL snapshot is required' });
  } else {
    if (input.snapshotJsonl.byteLength >= 3 && input.snapshotJsonl[0] === 0xef
      && input.snapshotJsonl[1] === 0xbb && input.snapshotJsonl[2] === 0xbf) {
      issues.push({ index: null, code: 'INVALID_JSONL_FRAMING', message: 'Snapshot must not contain a UTF-8 BOM' });
    }
    const actualHash = createHash('sha256').update(input.snapshotJsonl).digest('hex');
    if (manifestResult.success && actualHash !== manifestResult.data.snapshotJsonlSha256) {
      issues.push({ index: null, code: 'SNAPSHOT_HASH_MISMATCH', message: 'JSONL bytes do not match the manifest SHA-256' });
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(input.snapshotJsonl);
      if (!text.endsWith('\n') || text.includes('\r')) {
        issues.push({ index: null, code: 'INVALID_JSONL_FRAMING', message: 'Snapshot must use LF-delimited, newline-terminated JSONL' });
      } else {
        decodedLines = text.slice(0, -1).split('\n');
        if (decodedLines.some((line) => line.length === 0)) {
          issues.push({ index: null, code: 'INVALID_JSONL_FRAMING', message: 'Snapshot must not contain empty JSONL rows' });
        }
      }
    } catch (error) {
      issues.push({ index: null, code: 'INVALID_UTF8', message: error instanceof Error ? error.message : 'Snapshot is not valid UTF-8' });
    }
  }

  const records: FreshRetailNetRecord[] = [];
  if (manifestResult.success) {
    let previousOrderKey: { productId: number; dt: string } | undefined;
    decodedLines.forEach((line, index) => {
      let candidate: unknown;
      try {
        candidate = JSON.parse(line);
      } catch (error) {
        issues.push({ index, code: 'INVALID_JSONL_ROW', message: error instanceof Error ? error.message : 'Row is invalid JSON' });
        return;
      }
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
        || !freshRetailNetSourceColumnOrder.every((name, columnIndex) => Object.keys(candidate).at(columnIndex) === name)
        || Object.keys(candidate).length !== freshRetailNetSourceColumnOrder.length) {
        issues.push({ index, code: 'INVALID_SOURCE_COLUMNS', message: 'JSONL object keys must match the Parquet field order exactly' });
        return;
      }
      const parsed = freshRetailNetSourceRowSchema.safeParse(candidate);
      if (!parsed.success) {
        issues.push({ index, code: 'INVALID_SOURCE_ROW', message: parsed.error.message });
        return;
      }
      const orderKey = { productId: parsed.data.product_id, dt: parsed.data.dt };
      if (previousOrderKey !== undefined
        && (orderKey.productId < previousOrderKey.productId
          || (orderKey.productId === previousOrderKey.productId && orderKey.dt <= previousOrderKey.dt))) {
        issues.push({ index, code: 'INVALID_JSONL_ORDER', message: 'Rows must be ordered by product_id then dt with unique natural keys' });
      }
      previousOrderKey = orderKey;
      records.push({
        contractVersion: '0.3.0',
        dataset: manifestResult.data.dataset,
        datasetRevision: manifestResult.data.datasetRevision,
        license: manifestResult.data.license,
        sourceSplit: manifestResult.data.sourceSplit,
        source: parsed.data,
      });
    });
  }

  if (manifestResult.success) {
    const manifest: FreshRetailNetImportManifest = manifestResult.data;
    if (records.length !== decodedLines.length || manifest.rowCount !== decodedLines.length) {
      issues.push({ index: null, code: 'ROW_COUNT_MISMATCH', message: 'Validated row count does not match the source manifest' });
    }
    const seen = new Set<string>();
    records.forEach((record, index) => {
      if (record.datasetRevision !== manifest.datasetRevision || record.sourceSplit !== manifest.sourceSplit
        || record.license !== manifest.license) {
        issues.push({ index, code: 'SOURCE_MANIFEST_MISMATCH', message: 'Row source revision, split, or license differs from manifest' });
      }
      if (record.source.store_id !== manifest.selectedStoreId) {
        issues.push({ index, code: 'STORE_SCOPE_MISMATCH', message: 'Row store_id differs from manifest selection' });
      }
      const key = freshRetailNetNaturalKey(record);
      if (seen.has(key)) issues.push({ index, code: 'DUPLICATE_INPUT_KEY', message: 'Source batch contains a duplicate natural key' });
      seen.add(key);
    });
    if (new Set(records.map((record) => record.source.product_id)).size !== manifest.selectedSkuCount) {
      issues.push({ index: null, code: 'SKU_COUNT_MISMATCH', message: 'Distinct product_id count does not match manifest' });
    }
    const dates = records.map((record) => record.source.dt).sort();
    if (dates[0] !== manifest.firstDate || dates.at(-1) !== manifest.lastDate) {
      issues.push({ index: null, code: 'DATE_RANGE_MISMATCH', message: 'Record date range does not match manifest' });
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
        issues.push({ index: null, code: 'INCOMPLETE_SKU_COVERAGE', message: 'SKU ' + productId + ' does not cover each manifest date exactly once' });
      }
    }
  }

  if (issues.length > 0 || !manifestResult.success) return { status: 'REJECTED', issues };
  return { status: 'VALIDATED', manifest: manifestResult.data, records };
}

export function importPublicHistory(
  input: ImportPublicHistoryInput,
  repository: PublicHistoryRepository,
): ImportPublicHistoryResult {
  const validated = validatePublicHistorySnapshot(input);
  if (validated.status === 'REJECTED') return validated;

  const expected = acceptedSnapshotMetadata[validated.manifest.sourceSplit];
  const skuIds = [...new Set(validated.records.map((record) => record.source.product_id))].sort((left, right) => left - right);
  const skuSetSha256 = createHash('sha256').update(JSON.stringify(skuIds), 'utf8').digest('hex');
  const manifest = validated.manifest;
  if (manifest.snapshotJsonlSha256 !== expected.sha256
    || manifest.rowCount !== expected.rowCount
    || manifest.selectedStoreId !== expected.selectedStoreId
    || manifest.selectedSkuCount !== expected.selectedSkuCount
    || manifest.firstDate !== expected.firstDate
    || manifest.lastDate !== expected.lastDate
    || skuSetSha256 !== expected.skuSetSha256) {
    return {
      status: 'REJECTED',
      issues: [{
        index: null,
        code: 'UNAPPROVED_PUBLIC_SNAPSHOT',
        message: 'Formal import requires the accepted fixed-revision split, exact JSONL digest, store, SKU set, row count, and date range',
      }],
    };
  }

  return {
    status: 'IMPORTED',
    persistence: repository.importSnapshot(manifest, validated.records, input.snapshotJsonl),
  };
}
