import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CONTRACT_VERSION } from '../shared/primitives.js';
import { freshRetailNetDataset, freshRetailNetLicense, freshRetailNetRevision } from './fresh-retailnet-record.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const pinnedSourceFiles = {
  train: {
    sourcePath: 'data/train.parquet',
    sourceBytes: 106_436_287,
    lfsSha256: '6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d',
  },
  eval: {
    sourcePath: 'data/eval.parquet',
    sourceBytes: 8_440_124,
    lfsSha256: '1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e',
  },
} as const;

export const freshRetailNetImportManifestSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  dataset: z.literal(freshRetailNetDataset),
  datasetRevision: z.literal(freshRetailNetRevision),
  license: z.literal(freshRetailNetLicense),
  sourceSplit: z.enum(['train', 'eval']),
  sourcePath: z.string().min(1),
  sourceBytes: z.number().int().safe().positive(),
  sourceLfsObjectSha256: sha256Schema,
  sourceResponseBodySha256: sha256Schema,
  sourceLocalFileSha256: sha256Schema,
  rowCount: z.number().int().safe().positive(),
  selectedStoreId: z.number().int().safe().nonnegative(),
  selectedSkuCount: z.number().int().safe().positive(),
  firstDate: z.string().date(),
  lastDate: z.string().date(),
  snapshotJsonlSha256: sha256Schema,
}).strict().superRefine((manifest, context) => {
  const pinned = pinnedSourceFiles[manifest.sourceSplit];
  if (manifest.sourcePath !== pinned.sourcePath || manifest.sourceBytes !== pinned.sourceBytes
    || manifest.sourceLfsObjectSha256 !== pinned.lfsSha256) {
    context.addIssue({ code: 'custom', path: ['sourcePath'], message: 'Source file identity does not match the fixed dataset revision' });
  }
  if (manifest.sourceLfsObjectSha256 !== manifest.sourceResponseBodySha256
    || manifest.sourceLfsObjectSha256 !== manifest.sourceLocalFileSha256) {
    context.addIssue({ code: 'custom', path: ['sourceLocalFileSha256'], message: 'Downloaded bytes must match pinned LFS object SHA-256' });
  }
  if (manifest.lastDate < manifest.firstDate) {
    context.addIssue({ code: 'custom', path: ['lastDate'], message: 'Manifest date range is reversed' });
  }
});

export type FreshRetailNetImportManifest = z.infer<typeof freshRetailNetImportManifestSchema>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalize(record[key])).join(',') + '}';
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

export function publicHistoryRecordSha256(value: unknown): string {
  return canonicalSha256(value);
}

export function publicHistoryImportId(manifest: FreshRetailNetImportManifest): string {
  return canonicalSha256(manifest);
}
