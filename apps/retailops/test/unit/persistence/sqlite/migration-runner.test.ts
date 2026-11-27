import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteBatchRepository } from '../../../../src/adapters/persistence/sqlite/batch-repository.js';
import { SqliteDraftRepository } from '../../../../src/adapters/persistence/sqlite/draft-repository.js';
import { SqliteEvidenceRepository } from '../../../../src/adapters/persistence/sqlite/evidence-repository.js';
import { SqliteOperationRepository } from '../../../../src/adapters/persistence/sqlite/operation-repository.js';
import { SqlitePolicyRepository } from '../../../../src/adapters/persistence/sqlite/policy-repository.js';
import { SqliteProductRepository } from '../../../../src/adapters/persistence/sqlite/product-repository.js';
import { migrateRetailOpsDatabase } from '../../../../src/adapters/persistence/sqlite/migration-runner.js';
import { initialRetailOpsMigration } from '../../../../src/adapters/persistence/sqlite/migrations/0001_initial.js';
import { publicHistoryMigration } from '../../../../src/adapters/persistence/sqlite/migrations/0002_public_history.js';

const syntheticLegacySchema = readFileSync(
  new URL('../../../fixtures/persistence/sqlite/legacy-retailops-v0.sql', import.meta.url),
  'utf8',
);

describe('RetailOps SQLite migrations', () => {
  it('upgrades only the explicitly synthetic legacy fixture and preserves contract records', () => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      migrateRetailOpsDatabase(database);

      expect(database.prepare('SELECT MAX(version) AS version FROM retailops_schema_migrations').get()).toEqual({ version: 2 });
      expect(new SqliteProductRepository(database).findById('product-synthetic-01')).toEqual({
        contractVersion: '0.3.0',
        id: 'product-synthetic-01',
        baseUnitCode: 'each',
        evidenceIds: ['evidence-synthetic-01'],
      });
      expect(new SqliteEvidenceRepository(database).findById('evidence-synthetic-01')?.sourceKind).toBe('SIMULATED');
      expect(new SqlitePolicyRepository(database).findByIdAndRevision('policy-synthetic-01', 'revision-synthetic-01'))
        .toMatchObject({ id: 'policy-synthetic-01', evidenceIds: ['evidence-synthetic-01'] });
      expect(new SqliteBatchRepository(database).findById('batch-synthetic-01')?.stockBalance.physicalOnHand.value)
        .toBe('10.0000000000001');
      expect(new SqliteDraftRepository(database).findById('draft-synthetic-01')?.inputSnapshot.batchIds)
        .toEqual(['batch-synthetic-01']);
      expect(new SqliteOperationRepository(database).findById('operation-synthetic-01')?.quantity.value)
        .toBe('1.000000000000000001');
      for (const table of ['evidence', 'products', 'policies', 'batches', 'drafts', 'operations']) {
        expect(database.prepare('SELECT COUNT(*) AS count FROM ' + table).get()).toEqual({ count: 1 });
      }
      expect(database.prepare('SELECT COUNT(*) AS count FROM product_evidence').get()).toEqual({ count: 1 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM draft_operations').get()).toEqual({ count: 1 });
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(0);
    } finally {
      database.close();
    }
  });

  it.each([
    ['Batch Product differs from its Draft snapshot', (database: Database.Database) => {
      database.prepare('INSERT INTO legacy_records(aggregate_type, entity_id, payload) VALUES (?, ?, ?)')
        .run('PRODUCT', 'product-synthetic-02', JSON.stringify({
          contractVersion: '0.3.0', id: 'product-synthetic-02', baseUnitCode: 'each', evidenceIds: ['evidence-synthetic-01'],
        }));
      const row = database.prepare('SELECT payload FROM legacy_records WHERE aggregate_type = ?').get('BATCH') as { payload: string };
      database.prepare('UPDATE legacy_records SET payload = ? WHERE aggregate_type = ?')
        .run(JSON.stringify({ ...JSON.parse(row.payload), productId: 'product-synthetic-02' }), 'BATCH');
    }],
    ['Operation Product differs from its Batch', (database: Database.Database) => {
      database.prepare('INSERT INTO legacy_records(aggregate_type, entity_id, payload) VALUES (?, ?, ?)')
        .run('PRODUCT', 'product-synthetic-02', JSON.stringify({
          contractVersion: '0.3.0', id: 'product-synthetic-02', baseUnitCode: 'each', evidenceIds: ['evidence-synthetic-01'],
        }));
      const row = database.prepare('SELECT payload FROM legacy_records WHERE aggregate_type = ?').get('OPERATION') as { payload: string };
      database.prepare('UPDATE legacy_records SET payload = ? WHERE aggregate_type = ?')
        .run(JSON.stringify({ ...JSON.parse(row.payload), productId: 'product-synthetic-02' }), 'OPERATION');
    }],
    ['Draft omits a persisted Operation', (database: Database.Database) => {
      const operationRow = database.prepare('SELECT payload FROM legacy_records WHERE aggregate_type = ?').get('OPERATION') as { payload: string };
      const operation = JSON.parse(operationRow.payload);
      database.prepare('INSERT INTO legacy_records(aggregate_type, entity_id, payload) VALUES (?, ?, ?)')
        .run('OPERATION', 'operation-synthetic-02', JSON.stringify({ ...operation, id: 'operation-synthetic-02' }));
      const row = database.prepare('SELECT payload FROM legacy_records WHERE aggregate_type = ?').get('DRAFT') as { payload: string };
      database.prepare('UPDATE legacy_records SET payload = ? WHERE aggregate_type = ?')
        .run(JSON.stringify({ ...JSON.parse(row.payload), operationIds: ['operation-synthetic-02'] }), 'DRAFT');
    }],
  ])('rejects synthetic legacy relationship mismatch: %s', (_description, mutate) => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      mutate(database);

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/relationship|Product|Operation/i);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all())
        .toHaveLength(1);
      expect(database.prepare('SELECT version FROM retailops_schema_migrations ORDER BY version DESC LIMIT 1').get())
        .toEqual({ version: 0 });
    } finally {
      database.close();
    }
  });

  it('rolls a failed synthetic upgrade back without dropping its legacy evidence', () => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      database.prepare("UPDATE legacy_records SET payload = 'not-json' WHERE aggregate_type = 'PRODUCT'").run();

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/invalid JSON/);
      expect(database.prepare('SELECT version FROM retailops_schema_migrations').all()).toEqual([{ version: 0 }]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(1);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").all()).toHaveLength(0);
    } finally {
      database.close();
    }
  });

  it('rejects a legacy envelope ID that disagrees with the validated entity ID without dropping source rows', () => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      database.prepare("UPDATE legacy_records SET entity_id = 'product-envelope-mismatch' WHERE aggregate_type = 'PRODUCT'").run();

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/ID mismatch|envelope/i);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(1);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").all()).toHaveLength(0);
      expect(database.prepare('SELECT entity_id FROM legacy_records WHERE aggregate_type = ?').get('PRODUCT'))
        .toEqual({ entity_id: 'product-envelope-mismatch' });
    } finally {
      database.close();
    }
  });

  it('rejects legacy fields unknown to the current contract rather than silently stripping them', () => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      database.prepare('UPDATE legacy_records SET payload = ? WHERE aggregate_type = ?')
        .run('{"contractVersion":"0.3.0","id":"product-synthetic-01","baseUnitCode":"each","evidenceIds":["evidence-synthetic-01"],"historicalField":"must-not-be-lost"}', 'PRODUCT');

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/violates contract|historicalField/i);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(1);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").all()).toHaveLength(0);
    } finally {
      database.close();
    }
  });

  it('rejects unsupported or misnamed migration ledger entries', () => {
    for (const [version, name] of [[1, 'not-initial-retailops'], [9, 'future-migration']] as const) {
      const database = new Database(':memory:');
      try {
        database.exec('CREATE TABLE retailops_schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)');
        database.prepare('INSERT INTO retailops_schema_migrations(version, name, applied_at) VALUES (?, ?, ?)')
          .run(version, name, '2026-11-27T00:00:00Z');
        expect(() => migrateRetailOpsDatabase(database)).toThrow(/migration|ledger|version/i);
      } finally {
        database.close();
      }
    }
  });

  it('rejects a schema version ledger whose required tables are missing', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.exec('DROP TABLE products');
      expect(() => migrateRetailOpsDatabase(database)).toThrow(/schema|table|products/i);
    } finally {
      database.close();
    }
  });

  it('rejects an existing foreign-key violation in a previously migrated database', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.pragma('foreign_keys = OFF');
      database.prepare('INSERT INTO product_evidence(product_id, evidence_id, position) VALUES (?, ?, ?)')
        .run('missing-product', 'missing-evidence', 0);

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/foreign key violation/i);
    } finally {
      database.close();
    }
  });

  it('rolls back the new ledger entry when post-migration schema validation fails', () => {
    const database = new Database(':memory:');
    const originalUp = initialRetailOpsMigration.up;
    try {
      initialRetailOpsMigration.up = (migrationDatabase) => {
        originalUp(migrationDatabase);
        migrationDatabase.exec('DROP TABLE products');
      };

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/products/);
      expect(database.prepare('SELECT version, name FROM retailops_schema_migrations ORDER BY version').all()).toEqual([
      ]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(0);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").all()).toHaveLength(0);
    } finally {
      initialRetailOpsMigration.up = originalUp;
      database.close();
    }
  });

  it('rejects same-named relationship tables whose foreign keys were removed', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.exec('DROP TABLE product_evidence; CREATE TABLE product_evidence(product_id TEXT NOT NULL, evidence_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(product_id, position))');
      expect(() => migrateRetailOpsDatabase(database)).toThrow(/foreign key product_evidence\.(product_id|evidence_id)/i);
    } finally {
      database.close();
    }
  });

  it('upgrades an empty database through v1 and v2 and remains idempotent', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      migrateRetailOpsDatabase(database);
      expect(database.prepare('SELECT version, name FROM retailops_schema_migrations ORDER BY version').all()).toEqual([
        { version: 1, name: 'initial-retailops-contract-storage' },
        { version: 2, name: 'public-history-import-storage' },
      ]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'public_history_%' ORDER BY name").all())
        .toEqual([
          { name: 'public_history_import_rows' },
          { name: 'public_history_imports' },
          { name: 'public_history_records' },
        ]);
    } finally {
      database.close();
    }
  });

  it('upgrades a populated v1 database to v2 without losing v1 records', () => {
    const database = new Database(':memory:');
    try {
      database.exec(syntheticLegacySchema);
      initialRetailOpsMigration.up(database);
      database.prepare('INSERT INTO retailops_schema_migrations(version, name, applied_at) VALUES (?, ?, ?)')
        .run(1, 'initial-retailops-contract-storage', '2026-11-27T00:00:00.000Z');

      expect(database.prepare('SELECT COUNT(*) AS count FROM products').get()).toEqual({ count: 1 });
      migrateRetailOpsDatabase(database);

      expect(database.prepare('SELECT version FROM retailops_schema_migrations ORDER BY version').all())
        .toEqual([{ version: 0 }, { version: 1 }, { version: 2 }]);
      expect(database.prepare('SELECT id FROM products').all()).toEqual([{ id: 'product-synthetic-01' }]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_records'").all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('validates v1 schema without requiring v2 tables before applying v2', () => {
    const database = new Database(':memory:');
    const originalUp = publicHistoryMigration.up;
    try {
      publicHistoryMigration.up = () => { throw new Error('intentional-v2-stop'); };
      expect(() => migrateRetailOpsDatabase(database)).toThrow('intentional-v2-stop');
      expect(database.prepare('SELECT version FROM retailops_schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='public_history_records'").all()).toEqual([]);
      publicHistoryMigration.up = originalUp;
      migrateRetailOpsDatabase(database);
      expect(database.prepare('SELECT MAX(version) AS version FROM retailops_schema_migrations').get()).toEqual({ version: 2 });
    } finally {
      publicHistoryMigration.up = originalUp;
      database.close();
    }
  });

  it('rejects a v2 ledger whose required public-history table is missing', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.exec('DROP TABLE public_history_records');
      expect(() => migrateRetailOpsDatabase(database)).toThrow(/schema is missing required table public_history_records/i);
    } finally {
      database.close();
    }
  });

  it('rejects a v2 relation table whose foreign keys were removed', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.exec([
        'DROP TABLE public_history_import_rows;',
        'CREATE TABLE public_history_import_rows (',
        '  import_id TEXT NOT NULL, dataset TEXT NOT NULL, dataset_revision TEXT NOT NULL,',
        "  source_split TEXT NOT NULL CHECK (source_split IN ('train', 'eval')),",
        '  store_id INTEGER NOT NULL CHECK (store_id >= 0), product_id INTEGER NOT NULL CHECK (product_id >= 0),',
        '  dt TEXT NOT NULL,',
        '  PRIMARY KEY (import_id, dataset, dataset_revision, source_split, store_id, product_id, dt)',
        ');',
      ].join('\n'));

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/foreign key|composite/i);
    } finally {
      database.close();
    }
  });

  it('rolls v2 schema and ledger back when schema validation fails before commit', () => {
    const database = new Database(':memory:');
    const originalUp = publicHistoryMigration.up;
    try {
      publicHistoryMigration.up = (migrationDatabase) => {
        originalUp(migrationDatabase);
        migrationDatabase.exec('DROP TABLE public_history_records');
      };
      expect(() => migrateRetailOpsDatabase(database)).toThrow(/public_history_records/);
      expect(database.prepare('SELECT version FROM retailops_schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }]);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'public_history_%'").all()).toEqual([]);
    } finally {
      publicHistoryMigration.up = originalUp;
      database.close();
    }
  });

  it('rejects a v1 schema missing the unique Operation-to-Draft relationship constraint', () => {
    const database = new Database(':memory:');
    try {
      migrateRetailOpsDatabase(database);
      database.exec([
        'DROP TABLE draft_operations;',
        'CREATE TABLE draft_operations (',
        '  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,',
        '  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,',
        '  position INTEGER NOT NULL CHECK (position >= 0),',
        '  PRIMARY KEY (draft_id, position)',
        ');',
      ].join('\n'));

      expect(() => migrateRetailOpsDatabase(database)).toThrow(/unique key.*draft_operations.*operation_id/i);
    } finally {
      database.close();
    }
  });
});
