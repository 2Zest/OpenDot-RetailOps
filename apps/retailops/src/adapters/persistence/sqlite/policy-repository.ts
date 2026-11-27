import type Database from 'better-sqlite3';
import { policySchema, type Policy } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  ImmutableEntityConflictError,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredPolicy = { id: string; revision: string; contract_version: string; payload: string };

export class SqlitePolicyRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Policy {
    const { entity, payload } = validateForStorage(policySchema, value, "Policy");
    withRetailOpsTransaction(this.database, () => {
      const existing = this.database.prepare(
        "SELECT id, revision, contract_version, payload FROM policies WHERE id = ? AND revision = ?",
      ).get(entity.id, entity.revision) as StoredPolicy | undefined;
      if (existing !== undefined) {
        const prior = parseStoredEntity(policySchema, existing.payload, "Policy", entity.id + "@" + entity.revision);
        assertStoredFields(existing, {
          id: prior.id,
          revision: prior.revision,
          contract_version: prior.contractVersion,
        }, "Policy", entity.id + "@" + entity.revision);
        const actual = readOrderedReferences(this.database, "policy_evidence", "policy_id", entity.id, "evidence_id",
          "policy_revision", entity.revision);
        assertReferences(actual, prior.evidenceIds, "Policy", entity.id + "@" + entity.revision, "evidenceIds");
        if (JSON.stringify(prior) !== payload) {
          throw new ImmutableEntityConflictError("Policy revision", entity.id + "@" + entity.revision);
        }
        return;
      }
      this.database.prepare(
        "INSERT INTO policies(id, revision, contract_version, payload) VALUES (?, ?, ?, ?)",
      ).run(entity.id, entity.revision, entity.contractVersion, payload);
      replaceOrderedReferences(this.database, "policy_evidence", "policy_id", entity.id, "evidence_id", entity.evidenceIds,
        ["policy_revision"], [entity.revision]);
    });
    return entity;
  }

  findByIdAndRevision(id: string, revision: string): Policy | undefined {
    const row = this.database.prepare(
      "SELECT id, revision, contract_version, payload FROM policies WHERE id = ? AND revision = ?",
    ).get(id, revision) as StoredPolicy | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(policySchema, row.payload, "Policy", id + "@" + revision);
    assertStoredFields(row, {
      id: entity.id,
      revision: entity.revision,
      contract_version: entity.contractVersion,
    }, "Policy", id + "@" + revision);
    const actual = readOrderedReferences(this.database, "policy_evidence", "policy_id", id, "evidence_id", "policy_revision", revision);
    assertReferences(actual, entity.evidenceIds, "Policy", id + "@" + revision, "evidenceIds");
    return entity;
  }
}
