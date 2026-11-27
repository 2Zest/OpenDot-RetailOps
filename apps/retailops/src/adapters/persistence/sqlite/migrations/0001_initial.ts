import type Database from 'better-sqlite3';
import {
  batchSchema,
  draftSchema,
  evidenceSchema,
  operationSchema,
  productSchema,
  policySchema,
} from '../../../../domain/index.js';
import type { Batch, Draft, Evidence, Operation, Product, Policy } from '../../../../domain/index.js';

export interface RetailOpsMigration {
  readonly version: number;
  readonly name: string;
  up(database: Database.Database): void;
}

const schemaSql = [
  "CREATE TABLE IF NOT EXISTS evidence (",
  "  id TEXT PRIMARY KEY,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  source_kind TEXT NOT NULL CHECK (source_kind IN ('PUBLIC_HISTORICAL', 'DERIVED', 'SIMULATED', 'LIVE_DEVICE')),",
  "  snapshot_id TEXT NOT NULL,",
  "  observed_at TEXT NOT NULL,",
  "  payload TEXT NOT NULL CHECK (json_valid(payload))",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_evidence_snapshot_time ON evidence(snapshot_id, observed_at);",
  "CREATE INDEX IF NOT EXISTS idx_evidence_source_kind ON evidence(source_kind);",
  "CREATE TABLE IF NOT EXISTS evidence_parent_references (",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  parent_evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (evidence_id, parent_evidence_id),",
  "  UNIQUE (evidence_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_evidence_parent_reference ON evidence_parent_references(parent_evidence_id);",
  "CREATE TABLE IF NOT EXISTS products (",
  "  id TEXT PRIMARY KEY,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  base_unit_code TEXT NOT NULL,",
  "  payload TEXT NOT NULL CHECK (json_valid(payload))",
  ");",
  "CREATE TABLE IF NOT EXISTS product_evidence (",
  "  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (product_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_product_evidence_reference ON product_evidence(evidence_id);",
  "CREATE TABLE IF NOT EXISTS policies (",
  "  id TEXT NOT NULL,",
  "  revision TEXT NOT NULL,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  payload TEXT NOT NULL CHECK (json_valid(payload)),",
  "  PRIMARY KEY (id, revision)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_policies_id ON policies(id);",
  "CREATE TABLE IF NOT EXISTS policy_evidence (",
  "  policy_id TEXT NOT NULL,",
  "  policy_revision TEXT NOT NULL,",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (policy_id, policy_revision, position),",
  "  UNIQUE (policy_id, policy_revision, position),",
  "  FOREIGN KEY (policy_id, policy_revision) REFERENCES policies(id, revision) ON DELETE CASCADE",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_policy_evidence_reference ON policy_evidence(evidence_id);",
  "CREATE TABLE IF NOT EXISTS batches (",
  "  id TEXT PRIMARY KEY,",
  "  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  quality_status TEXT NOT NULL CHECK (quality_status IN ('PASS', 'FAIL', 'UNKNOWN')),",
  "  expiry_basis TEXT NOT NULL CHECK (expiry_basis IN ('DATE_ONLY', 'INSTANT')),",
  "  expiry_value TEXT NOT NULL,",
  "  expiry_time_zone TEXT,",
  "  payload TEXT NOT NULL CHECK (json_valid(payload)),",
  "  CHECK ((expiry_basis = 'DATE_ONLY' AND expiry_time_zone IS NOT NULL) OR (expiry_basis = 'INSTANT' AND expiry_time_zone IS NULL))",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);",
  "CREATE INDEX IF NOT EXISTS idx_batches_quality_expiry ON batches(quality_status, expiry_value);",
  "CREATE TABLE IF NOT EXISTS batch_evidence (",
  "  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (batch_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_batch_evidence_reference ON batch_evidence(evidence_id);",
  "CREATE TABLE IF NOT EXISTS drafts (",
  "  id TEXT PRIMARY KEY,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  draft_digest TEXT NOT NULL,",
  "  status TEXT NOT NULL,",
  "  input_snapshot_id TEXT NOT NULL,",
  "  policy_id TEXT NOT NULL,",
  "  policy_revision TEXT NOT NULL,",
  "  payload TEXT NOT NULL CHECK (json_valid(payload)),",
  "  FOREIGN KEY (policy_id, policy_revision) REFERENCES policies(id, revision) ON DELETE RESTRICT",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_drafts_policy ON drafts(policy_id, policy_revision);",
  "CREATE TABLE IF NOT EXISTS draft_products (",
  "  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,",
  "  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (draft_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_draft_products_reference ON draft_products(product_id);",
  "CREATE TABLE IF NOT EXISTS draft_batches (",
  "  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,",
  "  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (draft_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_draft_batches_reference ON draft_batches(batch_id);",
  "CREATE TABLE IF NOT EXISTS draft_evidence (",
  "  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (draft_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_draft_evidence_reference ON draft_evidence(evidence_id);",
  "CREATE TABLE IF NOT EXISTS operations (",
  "  id TEXT PRIMARY KEY,",
  "  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE RESTRICT,",
  "  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,",
  "  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,",
  "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
  "  kind TEXT NOT NULL CHECK (kind IN ('MARKDOWN_PROPOSAL', 'DISPOSAL_PROPOSAL')),",
  "  status TEXT NOT NULL,",
  "  payload TEXT NOT NULL CHECK (json_valid(payload))",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_operations_draft ON operations(draft_id);",
  "CREATE INDEX IF NOT EXISTS idx_operations_batch_status ON operations(batch_id, status);",
  "CREATE TABLE IF NOT EXISTS operation_evidence (",
  "  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,",
  "  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (operation_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_operation_evidence_reference ON operation_evidence(evidence_id);",
  "CREATE TABLE IF NOT EXISTS draft_operations (",
  "  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,",
  "  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,",
  "  position INTEGER NOT NULL CHECK (position >= 0),",
  "  PRIMARY KEY (draft_id, position)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_draft_operations_reference ON draft_operations(operation_id);",
].join('\n');

function tableExists(database: Database.Database, tableName: string): boolean {
  return database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName) !== undefined;
}

type LegacyRow = { aggregate_type: string; entity_id: string; payload: string };

function insertOrderedReferences(
  database: Database.Database,
  table: string,
  ownerColumn: string,
  ownerId: string,
  referenceColumn: string,
  references: readonly string[],
  extraColumns: readonly string[] = [],
  extraValues: readonly string[] = [],
): void {
  const columns = [ownerColumn, ...extraColumns, referenceColumn, "position"];
  const statement = database.prepare(
    "INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES (" + columns.map(() => "?").join(", ") + ")",
  );
  references.forEach((reference, position) => statement.run(ownerId, ...extraValues, reference, position));
}

function parseLegacy<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } } },
  row: LegacyRow,
): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.payload);
  } catch (error) {
    throw new Error("Synthetic legacy record " + row.aggregate_type + "/" + row.entity_id + " is invalid JSON", { cause: error });
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Synthetic legacy record " + row.aggregate_type + "/" + row.entity_id + " violates contract: " + parsed.error.message);
  }
  return parsed.data;
}

function migrateSyntheticLegacyRecords(database: Database.Database): void {
  if (!tableExists(database, "legacy_records")) return;
  const rows = database.prepare(
    "SELECT aggregate_type, entity_id, payload FROM legacy_records ORDER BY rowid",
  ).all() as LegacyRow[];
  const groups = new Map<string, LegacyRow[]>();
  for (const row of rows) {
    const group = groups.get(row.aggregate_type) ?? [];
    group.push(row);
    groups.set(row.aggregate_type, group);
  }

  const evidence = (groups.get("EVIDENCE") ?? []).map((row) => ({ row, value: parseLegacy(evidenceSchema, row) }));
  const products = (groups.get("PRODUCT") ?? []).map((row) => ({ row, value: parseLegacy(productSchema, row) }));
  const policies = (groups.get("POLICY") ?? []).map((row) => ({ row, value: parseLegacy(policySchema, row) }));
  const batches = (groups.get("BATCH") ?? []).map((row) => ({ row, value: parseLegacy(batchSchema, row) }));
  const drafts = (groups.get("DRAFT") ?? []).map((row) => ({ row, value: parseLegacy(draftSchema, row) }));
  const operations = (groups.get("OPERATION") ?? []).map((row) => ({ row, value: parseLegacy(operationSchema, row) }));
  const supported = new Set(["EVIDENCE", "PRODUCT", "POLICY", "BATCH", "DRAFT", "OPERATION"]);
  for (const aggregateType of groups.keys()) {
    if (!supported.has(aggregateType)) throw new Error("Unsupported synthetic legacy aggregate type: " + aggregateType);
  }

  const insertEvidence = database.prepare(
    "INSERT INTO evidence (id, contract_version, source_kind, snapshot_id, observed_at, payload) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const { value } of evidence) {
    const entity = value as Evidence;
    insertEvidence.run(entity.id, entity.contractVersion, entity.sourceKind, entity.snapshotId, entity.observedAt, JSON.stringify(entity));
  }
  const insertProduct = database.prepare(
    "INSERT INTO products (id, contract_version, base_unit_code, payload) VALUES (?, ?, ?, ?)",
  );
  for (const { value } of products) {
    const entity = value as Product;
    insertProduct.run(entity.id, entity.contractVersion, entity.baseUnitCode, JSON.stringify(entity));
  }
  const insertPolicy = database.prepare(
    "INSERT INTO policies (id, revision, contract_version, payload) VALUES (?, ?, ?, ?)",
  );
  for (const { value } of policies) {
    const entity = value as Policy;
    insertPolicy.run(entity.id, entity.revision, entity.contractVersion, JSON.stringify(entity));
  }
  const insertBatch = database.prepare(
    "INSERT INTO batches (id, product_id, contract_version, quality_status, expiry_basis, expiry_value, expiry_time_zone, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const { value } of batches) {
    const entity = value as Batch;
    insertBatch.run(entity.id, entity.productId, entity.contractVersion, entity.qualityStatus, entity.expiry.basis, entity.expiry.value,
      entity.expiry.basis === "DATE_ONLY" ? entity.expiry.timeZone : null, JSON.stringify(entity));
  }
  const insertDraft = database.prepare(
    "INSERT INTO drafts (id, contract_version, draft_digest, status, input_snapshot_id, policy_id, policy_revision, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const { value } of drafts) {
    const entity = value as Draft;
    insertDraft.run(entity.id, entity.contractVersion, entity.draftDigest, entity.status, entity.inputSnapshot.id,
      entity.inputSnapshot.policyId, entity.inputSnapshot.policyRevision, JSON.stringify(entity));
  }
  const insertOperation = database.prepare(
    "INSERT INTO operations (id, draft_id, product_id, batch_id, contract_version, kind, status, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const { value } of operations) {
    const entity = value as Operation;
    insertOperation.run(entity.id, entity.draftId, entity.productId, entity.batchId, entity.contractVersion, entity.kind, entity.status, JSON.stringify(entity));
  }

  for (const { value } of evidence) {
    const entity = value as Evidence;
    if (entity.sourceKind === "DERIVED") {
      insertOrderedReferences(database, "evidence_parent_references", "evidence_id", entity.id, "parent_evidence_id", entity.parentEvidenceIds);
    }
  }
  for (const { value } of products) {
    const entity = value as Product;
    insertOrderedReferences(database, "product_evidence", "product_id", entity.id, "evidence_id", entity.evidenceIds);
  }
  for (const { value } of policies) {
    const entity = value as Policy;
    insertOrderedReferences(database, "policy_evidence", "policy_id", entity.id, "evidence_id", entity.evidenceIds, ["policy_revision"], [entity.revision]);
  }
  for (const { value } of batches) {
    const entity = value as Batch;
    insertOrderedReferences(database, "batch_evidence", "batch_id", entity.id, "evidence_id", entity.evidenceIds);
  }
  for (const { value } of drafts) {
    const entity = value as Draft;
    insertOrderedReferences(database, "draft_products", "draft_id", entity.id, "product_id", entity.inputSnapshot.productIds);
    insertOrderedReferences(database, "draft_batches", "draft_id", entity.id, "batch_id", entity.inputSnapshot.batchIds);
    insertOrderedReferences(database, "draft_evidence", "draft_id", entity.id, "evidence_id", entity.inputSnapshot.evidenceIds);
    insertOrderedReferences(database, "draft_operations", "draft_id", entity.id, "operation_id", entity.operationIds);
  }
  for (const { value } of operations) {
    const entity = value as Operation;
    insertOrderedReferences(database, "operation_evidence", "operation_id", entity.id, "evidence_id", entity.evidenceIds);
  }

  database.exec("DROP TABLE legacy_records");
}

export const initialRetailOpsMigration: RetailOpsMigration = {
  version: 1,
  name: "initial-retailops-contract-storage",
  up(database) {
    database.exec(schemaSql);
    migrateSyntheticLegacyRecords(database);
  },
};
