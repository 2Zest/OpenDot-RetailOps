import type Database from 'better-sqlite3';
import { initialRetailOpsMigration } from './migrations/0001_initial.js';
import { publicHistoryMigration } from './migrations/0002_public_history.js';

const migrations = [initialRetailOpsMigration, publicHistoryMigration] as const;
const syntheticLegacyVersionName = 'synthetic-v0-record-envelope';

const v1RequiredColumns: Readonly<Record<string, readonly string[]>> = {
  retailops_schema_migrations: ['version', 'name', 'applied_at'],
  evidence: ['id', 'contract_version', 'source_kind', 'snapshot_id', 'observed_at', 'payload'],
  evidence_parent_references: ['evidence_id', 'parent_evidence_id', 'position'],
  products: ['id', 'contract_version', 'base_unit_code', 'payload'],
  product_evidence: ['product_id', 'evidence_id', 'position'],
  policies: ['id', 'revision', 'contract_version', 'payload'],
  policy_evidence: ['policy_id', 'policy_revision', 'evidence_id', 'position'],
  batches: ['id', 'product_id', 'contract_version', 'quality_status', 'expiry_basis', 'expiry_value', 'expiry_time_zone', 'payload'],
  batch_evidence: ['batch_id', 'evidence_id', 'position'],
  drafts: ['id', 'contract_version', 'draft_digest', 'status', 'input_snapshot_id', 'policy_id', 'policy_revision', 'payload'],
  draft_products: ['draft_id', 'product_id', 'position'],
  draft_batches: ['draft_id', 'batch_id', 'position'],
  draft_evidence: ['draft_id', 'evidence_id', 'position'],
  operations: ['id', 'draft_id', 'product_id', 'batch_id', 'contract_version', 'kind', 'status', 'payload'],
  operation_evidence: ['operation_id', 'evidence_id', 'position'],
  draft_operations: ['draft_id', 'operation_id', 'position'],
};

const v1RequiredUniqueKeys: Readonly<Record<string, readonly (readonly string[])[]>> = {
  retailops_schema_migrations: [['version'], ['name']],
  evidence: [['id']],
  evidence_parent_references: [['evidence_id', 'parent_evidence_id'], ['evidence_id', 'position']],
  products: [['id']],
  product_evidence: [['product_id', 'position']],
  policies: [['id', 'revision']],
  policy_evidence: [['policy_id', 'policy_revision', 'position']],
  batches: [['id']],
  batch_evidence: [['batch_id', 'position']],
  drafts: [['id']],
  draft_products: [['draft_id', 'position']],
  draft_batches: [['draft_id', 'position']],
  draft_evidence: [['draft_id', 'position']],
  operations: [['id']],
  operation_evidence: [['operation_id', 'position']],
  draft_operations: [['draft_id', 'position'], ['operation_id']],
};

type ExpectedForeignKey = { table: string; from: string; targetTable: string; to: string; group?: string };
const v1RequiredForeignKeys: readonly ExpectedForeignKey[] = [
  { table: 'evidence_parent_references', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'evidence_parent_references', from: 'parent_evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'product_evidence', from: 'product_id', targetTable: 'products', to: 'id' },
  { table: 'product_evidence', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'policy_evidence', group: 'policy-revision', from: 'policy_id', targetTable: 'policies', to: 'id' },
  { table: 'policy_evidence', group: 'policy-revision', from: 'policy_revision', targetTable: 'policies', to: 'revision' },
  { table: 'policy_evidence', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'batches', from: 'product_id', targetTable: 'products', to: 'id' },
  { table: 'batch_evidence', from: 'batch_id', targetTable: 'batches', to: 'id' },
  { table: 'batch_evidence', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'drafts', group: 'draft-policy-revision', from: 'policy_id', targetTable: 'policies', to: 'id' },
  { table: 'drafts', group: 'draft-policy-revision', from: 'policy_revision', targetTable: 'policies', to: 'revision' },
  { table: 'draft_products', from: 'draft_id', targetTable: 'drafts', to: 'id' },
  { table: 'draft_products', from: 'product_id', targetTable: 'products', to: 'id' },
  { table: 'draft_batches', from: 'draft_id', targetTable: 'drafts', to: 'id' },
  { table: 'draft_batches', from: 'batch_id', targetTable: 'batches', to: 'id' },
  { table: 'draft_evidence', from: 'draft_id', targetTable: 'drafts', to: 'id' },
  { table: 'draft_evidence', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'operations', from: 'draft_id', targetTable: 'drafts', to: 'id' },
  { table: 'operations', from: 'product_id', targetTable: 'products', to: 'id' },
  { table: 'operations', from: 'batch_id', targetTable: 'batches', to: 'id' },
  { table: 'operation_evidence', from: 'operation_id', targetTable: 'operations', to: 'id' },
  { table: 'operation_evidence', from: 'evidence_id', targetTable: 'evidence', to: 'id' },
  { table: 'draft_operations', from: 'draft_id', targetTable: 'drafts', to: 'id' },
  { table: 'draft_operations', from: 'operation_id', targetTable: 'operations', to: 'id' },
];

const v2RequiredColumns: Readonly<Record<string, readonly string[]>> = {
  public_history_imports: [
    'id', 'dataset', 'dataset_revision', 'license', 'source_split', 'source_path', 'source_bytes',
    'source_lfs_object_sha256', 'source_response_body_sha256', 'source_local_file_sha256', 'row_count',
    'selected_store_id', 'selected_sku_count', 'first_date', 'last_date', 'snapshot_jsonl_sha256', 'payload',
  ],
  public_history_records: [
    'dataset', 'dataset_revision', 'source_split', 'store_id', 'product_id', 'dt', 'record_sha256', 'payload',
  ],
  public_history_import_rows: [
    'import_id', 'dataset', 'dataset_revision', 'source_split', 'store_id', 'product_id', 'dt',
  ],
};

const v2RequiredUniqueKeys: Readonly<Record<string, readonly (readonly string[])[]>> = {
  public_history_imports: [['id']],
  public_history_records: [['dataset', 'dataset_revision', 'source_split', 'store_id', 'product_id', 'dt']],
  public_history_import_rows: [['import_id', 'dataset', 'dataset_revision', 'source_split', 'store_id', 'product_id', 'dt']],
};

const v2RequiredForeignKeys: readonly ExpectedForeignKey[] = [
  { table: 'public_history_import_rows', from: 'import_id', targetTable: 'public_history_imports', to: 'id' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'dataset', targetTable: 'public_history_records', to: 'dataset' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'dataset_revision', targetTable: 'public_history_records', to: 'dataset_revision' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'source_split', targetTable: 'public_history_records', to: 'source_split' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'store_id', targetTable: 'public_history_records', to: 'store_id' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'product_id', targetTable: 'public_history_records', to: 'product_id' },
  { table: 'public_history_import_rows', group: 'history-record', from: 'dt', targetTable: 'public_history_records', to: 'dt' },
];

type LedgerRow = { version: number; name: string };

function tableExists(database: Database.Database, tableName: string): boolean {
  return database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName) !== undefined;
}

function readLedger(database: Database.Database): LedgerRow[] {
  return database.prepare("SELECT version, name FROM retailops_schema_migrations ORDER BY version").all() as LedgerRow[];
}

function assertLedger(database: Database.Database): LedgerRow[] {
  const rows = readLedger(database);
  const names = new Map<number, string>([
    [0, syntheticLegacyVersionName],
    ...migrations.map((migration) => [migration.version, migration.name] as [number, string]),
  ]);
  for (const row of rows) {
    const expectedName = names.get(row.version);
    if (expectedName === undefined) {
      throw new Error("RetailOps migration ledger contains unsupported version " + row.version);
    }
    if (row.name !== expectedName) {
      throw new Error("RetailOps migration ledger name does not match version " + row.version);
    }
  }

  const latest = rows.reduce((maximum, row) => Math.max(maximum, row.version), 0);
  const maxSupportedVersion = migrations[migrations.length - 1]?.version ?? 0;
  if (latest > maxSupportedVersion) {
    throw new Error("RetailOps database schema version " + latest + " is newer than supported version " + maxSupportedVersion);
  }
  for (const migration of migrations) {
    if (migration.version <= latest && !rows.some((row) => row.version === migration.version)) {
      throw new Error("RetailOps migration ledger is missing applied version " + migration.version);
    }
  }
  if (rows.some((row) => row.version === 0) && latest === 0 && !tableExists(database, 'legacy_records')) {
    throw new Error("Synthetic v0 migration marker requires its legacy_records source table");
  }
  return rows;
}

function assertSchemaColumns(database: Database.Database, requiredColumns: Readonly<Record<string, readonly string[]>>): void {
  for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
    if (!tableExists(database, table)) throw new Error("RetailOps schema is missing required table " + table);
    const actualColumns = database.pragma("table_info(" + table + ")") as { name: string }[];
    const actualNames = actualColumns.map((column) => column.name);
    if (actualNames.length !== expectedColumns.length || actualNames.some((name, index) => name !== expectedColumns[index])) {
      throw new Error("RetailOps schema columns do not match the migration contract for table " + table);
    }
  }
}

function assertUniqueKeys(database: Database.Database, requiredUniqueKeys: Readonly<Record<string, readonly (readonly string[])[]>>): void {
  for (const [table, expectedKeys] of Object.entries(requiredUniqueKeys)) {
    const tableInfo = database.pragma("table_info(" + table + ")") as { name: string; pk: number }[];
    const actualKeys: string[][] = [];
    const primaryKey = tableInfo.filter((column) => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map((column) => column.name);
    if (primaryKey.length > 0) actualKeys.push(primaryKey);

    const indexes = database.pragma("index_list(" + table + ")") as { name: string; unique: number }[];
    for (const index of indexes.filter((candidate) => candidate.unique === 1)) {
      const escapedName = index.name.replaceAll('"', '""');
      const columns = database.pragma('index_info("' + escapedName + '")') as { name: string | null }[];
      const names = columns.map((column) => column.name).filter((name): name is string => name !== null);
      if (names.length > 0) actualKeys.push(names);
    }

    for (const expected of expectedKeys) {
      if (!actualKeys.some((actual) => actual.length === expected.length
        && actual.every((name, index) => name === expected[index]))) {
        throw new Error("RetailOps schema is missing unique key " + table + "(" + expected.join(', ') + ")");
      }
    }
  }
}

function assertForeignKeyDefinitions(database: Database.Database, requiredForeignKeys: readonly ExpectedForeignKey[]): void {
  const tables = [...new Set(requiredForeignKeys.map((foreignKey) => foreignKey.table))];
  for (const table of tables) {
    const foreignKeys = database.pragma("foreign_key_list(" + table + ")") as {
      id: number; seq: number; table: string; from: string; to: string;
    }[];
    const expected = requiredForeignKeys.filter((foreignKey) => foreignKey.table === table);
    for (const foreignKey of foreignKeys) {
      if (!expected.some((item) => item.targetTable === foreignKey.table
        && item.from === foreignKey.from && item.to === foreignKey.to)) {
        throw new Error("RetailOps schema has unexpected foreign key " + table + "." + foreignKey.from);
      }
    }

    const compositeGroups = [...new Set(expected.flatMap((item) => item.group === undefined ? [] : [item.group]))];
    for (const group of compositeGroups) {
      const expectedGroup = expected.filter((item) => item.group === group);
      const targetTable = expectedGroup[0]?.targetTable;
      const candidateIds = [...new Set(foreignKeys.filter((item) => item.table === targetTable).map((item) => item.id))];
      const matchingId = candidateIds.find((id) => {
        const actualGroup = foreignKeys.filter((item) => item.id === id).sort((left, right) => left.seq - right.seq);
        return actualGroup.length === expectedGroup.length
          && actualGroup.every((item, index) => item.table === expectedGroup[index]?.targetTable
            && item.from === expectedGroup[index]?.from && item.to === expectedGroup[index]?.to && item.seq === index);
      });
      if (matchingId === undefined) throw new Error("RetailOps schema composite foreign key is incomplete: " + table + "/" + group);
    }

    for (const item of expected) {
      if (item.group !== undefined) continue;
      if (!foreignKeys.some((foreignKey) => foreignKey.table === item.targetTable
        && foreignKey.from === item.from && foreignKey.to === item.to)) {
        throw new Error("RetailOps schema is missing foreign key " + table + "." + item.from);
      }
    }

    const columns = database.pragma("table_info(" + table + ")") as { name: string; notnull: number }[];
    for (const item of expected) {
      if (columns.find((column) => column.name === item.from)?.notnull !== 1) {
        throw new Error("RetailOps foreign-key column must be NOT NULL: " + table + "." + item.from);
      }
    }
  }
}

function assertForeignKeyIntegrity(database: Database.Database): void {
  const foreignKeyErrors = database.pragma("foreign_key_check") as unknown[];
  if (foreignKeyErrors.length > 0) {
    throw new Error("RetailOps SQLite schema has " + foreignKeyErrors.length + " foreign key violation(s)");
  }
}

function assertDatabaseMatchesLedger(database: Database.Database): void {
  const rows = assertLedger(database);
  const latest = rows.reduce((maximum, row) => Math.max(maximum, row.version), 0);
  if (latest >= 1) {
    assertSchemaColumns(database, v1RequiredColumns);
    assertUniqueKeys(database, v1RequiredUniqueKeys);
    assertForeignKeyDefinitions(database, v1RequiredForeignKeys);
    assertForeignKeyIntegrity(database);
  }
  if (latest >= 2) {
    assertSchemaColumns(database, v2RequiredColumns);
    assertUniqueKeys(database, v2RequiredUniqueKeys);
    assertForeignKeyDefinitions(database, v2RequiredForeignKeys);
    assertForeignKeyIntegrity(database);
  }
}

function assertNoUnversionedRetailSchema(database: Database.Database, ledger: readonly LedgerRow[]): void {
  if (ledger.some((row) => row.version === 1)) return;
  const existingTables = [...Object.keys(v1RequiredColumns), ...Object.keys(v2RequiredColumns)]
    .filter((table) => table !== 'retailops_schema_migrations' && tableExists(database, table));
  if (existingTables.length > 0) {
    throw new Error("RetailOps schema tables exist without the matching migration ledger: " + existingTables.join(', '));
  }
}

export function migrateRetailOpsDatabase(database: Database.Database): void {
  database.pragma("foreign_keys = ON");
  const foreignKeys = database.pragma("foreign_keys", { simple: true }) as number;
  if (foreignKeys !== 1) throw new Error("RetailOps SQLite migrations require foreign key enforcement");

  database.exec([
    "CREATE TABLE IF NOT EXISTS retailops_schema_migrations (",
    "  version INTEGER PRIMARY KEY CHECK (version >= 0),",
    "  name TEXT NOT NULL UNIQUE,",
    "  applied_at TEXT NOT NULL",
    ");",
  ].join('\n'));

  const ledger = assertLedger(database);
  assertNoUnversionedRetailSchema(database, ledger);

  for (const migration of migrations) {
    if (ledger.some((row) => row.version === migration.version)) continue;

    const run = database.transaction(() => {
      migration.up(database);
      database.prepare(
        "INSERT INTO retailops_schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, new Date().toISOString());
      assertDatabaseMatchesLedger(database);
    });
    run();
  }

  assertDatabaseMatchesLedger(database);
}
