import type Database from 'better-sqlite3';
import { batchSchema, type Batch } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  InvalidDomainRelationError,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredBatch = {
  id: string; product_id: string; contract_version: string; quality_status: string;
  expiry_basis: string; expiry_value: string; expiry_time_zone: string | null; payload: string;
};

export class SqliteBatchRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Batch {
    const { entity, payload } = validateForStorage(batchSchema, value, "Batch");
    withRetailOpsTransaction(this.database, () => {
      const existing = this.findById(entity.id);
      if (existing !== undefined && existing.productId !== entity.productId) {
        throw new InvalidDomainRelationError("Batch " + entity.id + " cannot change its owning Product");
      }
      this.database.prepare(
        "INSERT INTO batches(id, product_id, contract_version, quality_status, expiry_basis, expiry_value, expiry_time_zone, payload) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, " +
        "contract_version=excluded.contract_version, quality_status=excluded.quality_status, expiry_basis=excluded.expiry_basis, " +
        "expiry_value=excluded.expiry_value, expiry_time_zone=excluded.expiry_time_zone, payload=excluded.payload",
      ).run(entity.id, entity.productId, entity.contractVersion, entity.qualityStatus, entity.expiry.basis, entity.expiry.value,
        entity.expiry.basis === "DATE_ONLY" ? entity.expiry.timeZone : null, payload);
      replaceOrderedReferences(this.database, "batch_evidence", "batch_id", entity.id, "evidence_id", entity.evidenceIds);
    });
    return entity;
  }

  findById(id: string): Batch | undefined {
    const row = this.database.prepare(
      "SELECT id, product_id, contract_version, quality_status, expiry_basis, expiry_value, expiry_time_zone, payload FROM batches WHERE id = ?",
    ).get(id) as StoredBatch | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(batchSchema, row.payload, "Batch", id);
    assertStoredFields(row, {
      id: entity.id,
      product_id: entity.productId,
      contract_version: entity.contractVersion,
      quality_status: entity.qualityStatus,
      expiry_basis: entity.expiry.basis,
      expiry_value: entity.expiry.value,
      expiry_time_zone: entity.expiry.basis === "DATE_ONLY" ? entity.expiry.timeZone : null,
    }, "Batch", id);
    const actual = readOrderedReferences(this.database, "batch_evidence", "batch_id", id, "evidence_id");
    assertReferences(actual, entity.evidenceIds, "Batch", id, "evidenceIds");
    return entity;
  }
}
