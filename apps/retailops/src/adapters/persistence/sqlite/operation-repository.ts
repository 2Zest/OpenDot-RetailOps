import type Database from 'better-sqlite3';
import { operationSchema, type Operation } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredOperation = {
  id: string; draft_id: string; product_id: string; batch_id: string;
  contract_version: string; kind: string; status: string; payload: string;
};

export class SqliteOperationRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Operation {
    const { entity, payload } = validateForStorage(operationSchema, value, "Operation");
    withRetailOpsTransaction(this.database, () => {
      this.database.prepare(
        "INSERT INTO operations(id, draft_id, product_id, batch_id, contract_version, kind, status, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET draft_id=excluded.draft_id, product_id=excluded.product_id, batch_id=excluded.batch_id, " +
        "contract_version=excluded.contract_version, kind=excluded.kind, status=excluded.status, payload=excluded.payload",
      ).run(entity.id, entity.draftId, entity.productId, entity.batchId, entity.contractVersion, entity.kind, entity.status, payload);
      replaceOrderedReferences(this.database, "operation_evidence", "operation_id", entity.id, "evidence_id", entity.evidenceIds);
    });
    return entity;
  }

  findById(id: string): Operation | undefined {
    const row = this.database.prepare(
      "SELECT id, draft_id, product_id, batch_id, contract_version, kind, status, payload FROM operations WHERE id = ?",
    ).get(id) as StoredOperation | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(operationSchema, row.payload, "Operation", id);
    assertStoredFields(row, {
      id: entity.id,
      draft_id: entity.draftId,
      product_id: entity.productId,
      batch_id: entity.batchId,
      contract_version: entity.contractVersion,
      kind: entity.kind,
      status: entity.status,
    }, "Operation", id);
    assertReferences(readOrderedReferences(this.database, "operation_evidence", "operation_id", id, "evidence_id"),
      entity.evidenceIds, "Operation", id, "evidenceIds");
    return entity;
  }
}
