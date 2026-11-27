import type Database from 'better-sqlite3';
import { operationSchema, type Operation } from '../../../domain/index.js';
import { SqliteBatchRepository } from './batch-repository.js';
import { SqliteDraftRepository } from './draft-repository.js';
import {
  assertReferences,
  assertStoredFields,
  CorruptPersistedEntityError,
  InvalidDomainRelationError,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

function assertOperationRelations(database: Database.Database, entity: Operation, persisted: boolean): void {
  const reject = (message: string): never => {
    if (persisted) throw new CorruptPersistedEntityError("Operation", entity.id, message);
    throw new InvalidDomainRelationError(message);
  };
  const draft = new SqliteDraftRepository(database).findById(entity.draftId);
  if (draft === undefined) return reject("Operation references missing Draft " + entity.draftId);
  if (!draft.operationIds.includes(entity.id)) reject("Draft " + entity.draftId + " does not reference Operation " + entity.id);
  if (!draft.inputSnapshot.productIds.includes(entity.productId)) reject("Operation Product is outside its Draft snapshot");
  if (!draft.inputSnapshot.batchIds.includes(entity.batchId)) reject("Operation Batch is outside its Draft snapshot");

  const batch = new SqliteBatchRepository(database).findById(entity.batchId);
  if (batch === undefined) return reject("Operation references missing Batch " + entity.batchId);
  if (batch.productId !== entity.productId) reject("Operation Product does not match its Batch Product");

  const owners = database.prepare(
    "SELECT draft_id FROM draft_operations WHERE operation_id = ? ORDER BY position",
  ).all(entity.id) as { draft_id: string }[];
  if (owners.length !== 1 || owners[0]?.draft_id !== entity.draftId) {
    reject("Operation must be referenced by exactly its owning Draft");
  }
}

type StoredOperation = {
  id: string; draft_id: string; product_id: string; batch_id: string;
  contract_version: string; kind: string; status: string; payload: string;
};

export class SqliteOperationRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Operation {
    const { entity, payload } = validateForStorage(operationSchema, value, "Operation");
    withRetailOpsTransaction(this.database, () => {
      assertOperationRelations(this.database, entity, false);
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
    assertOperationRelations(this.database, entity, true);
    return entity;
  }
}
