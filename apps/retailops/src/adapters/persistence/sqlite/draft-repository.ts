import type Database from 'better-sqlite3';
import { draftSchema, type Draft } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredDraft = {
  id: string; contract_version: string; draft_digest: string; status: string;
  input_snapshot_id: string; policy_id: string; policy_revision: string; payload: string;
};

export class SqliteDraftRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Draft {
    const { entity, payload } = validateForStorage(draftSchema, value, "Draft");
    withRetailOpsTransaction(this.database, () => {
      this.database.prepare(
        "INSERT INTO drafts(id, contract_version, draft_digest, status, input_snapshot_id, policy_id, policy_revision, payload) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET contract_version=excluded.contract_version, " +
        "draft_digest=excluded.draft_digest, status=excluded.status, input_snapshot_id=excluded.input_snapshot_id, " +
        "policy_id=excluded.policy_id, policy_revision=excluded.policy_revision, payload=excluded.payload",
      ).run(entity.id, entity.contractVersion, entity.draftDigest, entity.status, entity.inputSnapshot.id,
        entity.inputSnapshot.policyId, entity.inputSnapshot.policyRevision, payload);
      replaceOrderedReferences(this.database, "draft_products", "draft_id", entity.id, "product_id", entity.inputSnapshot.productIds);
      replaceOrderedReferences(this.database, "draft_batches", "draft_id", entity.id, "batch_id", entity.inputSnapshot.batchIds);
      replaceOrderedReferences(this.database, "draft_evidence", "draft_id", entity.id, "evidence_id", entity.inputSnapshot.evidenceIds);
      replaceOrderedReferences(this.database, "draft_operations", "draft_id", entity.id, "operation_id", entity.operationIds);
    });
    return entity;
  }

  findById(id: string): Draft | undefined {
    const row = this.database.prepare(
      "SELECT id, contract_version, draft_digest, status, input_snapshot_id, policy_id, policy_revision, payload FROM drafts WHERE id = ?",
    ).get(id) as StoredDraft | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(draftSchema, row.payload, "Draft", id);
    assertStoredFields(row, {
      id: entity.id,
      contract_version: entity.contractVersion,
      draft_digest: entity.draftDigest,
      status: entity.status,
      input_snapshot_id: entity.inputSnapshot.id,
      policy_id: entity.inputSnapshot.policyId,
      policy_revision: entity.inputSnapshot.policyRevision,
    }, "Draft", id);
    assertReferences(readOrderedReferences(this.database, "draft_products", "draft_id", id, "product_id"),
      entity.inputSnapshot.productIds, "Draft", id, "inputSnapshot.productIds");
    assertReferences(readOrderedReferences(this.database, "draft_batches", "draft_id", id, "batch_id"),
      entity.inputSnapshot.batchIds, "Draft", id, "inputSnapshot.batchIds");
    assertReferences(readOrderedReferences(this.database, "draft_evidence", "draft_id", id, "evidence_id"),
      entity.inputSnapshot.evidenceIds, "Draft", id, "inputSnapshot.evidenceIds");
    assertReferences(readOrderedReferences(this.database, "draft_operations", "draft_id", id, "operation_id"),
      entity.operationIds, "Draft", id, "operationIds");
    return entity;
  }
}
