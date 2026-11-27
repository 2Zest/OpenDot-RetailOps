import type Database from 'better-sqlite3';
import { evidenceSchema, type Evidence } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredEvidence = {
  id: string;
  contract_version: string;
  source_kind: string;
  snapshot_id: string;
  observed_at: string;
  payload: string;
};

export class SqliteEvidenceRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Evidence {
    const { entity, payload } = validateForStorage(evidenceSchema, value, "Evidence");
    withRetailOpsTransaction(this.database, () => {
      this.database.prepare(
        "INSERT INTO evidence(id, contract_version, source_kind, snapshot_id, observed_at, payload) VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET contract_version=excluded.contract_version, source_kind=excluded.source_kind, " +
        "snapshot_id=excluded.snapshot_id, observed_at=excluded.observed_at, payload=excluded.payload",
      ).run(entity.id, entity.contractVersion, entity.sourceKind, entity.snapshotId, entity.observedAt, payload);
      this.database.prepare("DELETE FROM evidence_parent_references WHERE evidence_id = ?").run(entity.id);
      if (entity.sourceKind === "DERIVED") {
        replaceOrderedReferences(this.database, "evidence_parent_references", "evidence_id", entity.id,
          "parent_evidence_id", entity.parentEvidenceIds);
      }
    });
    return entity;
  }

  findById(id: string): Evidence | undefined {
    const row = this.database.prepare(
      "SELECT id, contract_version, source_kind, snapshot_id, observed_at, payload FROM evidence WHERE id = ?",
    ).get(id) as StoredEvidence | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(evidenceSchema, row.payload, "Evidence", id);
    assertStoredFields(row, {
      id: entity.id,
      contract_version: entity.contractVersion,
      source_kind: entity.sourceKind,
      snapshot_id: entity.snapshotId,
      observed_at: entity.observedAt,
    }, "Evidence", id);
    const actual = readOrderedReferences(this.database, "evidence_parent_references", "evidence_id", id, "parent_evidence_id");
    const expected = entity.sourceKind === "DERIVED" ? entity.parentEvidenceIds : [];
    assertReferences(actual, expected, "Evidence", id, "parentEvidenceIds");
    return entity;
  }
}
