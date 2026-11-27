import type { FreshRetailNetRecord } from '../../domain/history/fresh-retailnet-record.js';
import type { FreshRetailNetImportManifest } from '../../domain/history/fresh-retailnet-manifest.js';

export interface PublicHistoryQuery {
  readonly datasetRevision: string;
  readonly sourceSplit: 'train' | 'eval';
  readonly storeId: number;
  readonly productId?: number;
  readonly fromDate?: string;
  readonly throughDate?: string;
}

export interface PublicHistoryImportResult {
  readonly insertedRecords: number;
  readonly unchangedRecords: number;
  readonly importId: string;
}

export interface PublicHistoryRecordWithProvenance {
  readonly record: FreshRetailNetRecord;
  readonly importManifests: readonly FreshRetailNetImportManifest[];
}

export interface PublicHistoryRepository {
  importSnapshot(
    manifest: FreshRetailNetImportManifest,
    records: readonly FreshRetailNetRecord[],
    sourceSnapshotJsonl: Uint8Array,
  ): PublicHistoryImportResult;
  find(query: PublicHistoryQuery): readonly PublicHistoryRecordWithProvenance[];
}
