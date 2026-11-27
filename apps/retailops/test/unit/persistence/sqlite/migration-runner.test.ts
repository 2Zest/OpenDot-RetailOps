import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteProductRepository } from '../../../../src/adapters/persistence/sqlite/product-repository.js';
import { migrateRetailOpsDatabase } from '../../../../src/adapters/persistence/sqlite/migration-runner.js';

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

      expect(database.prepare('SELECT MAX(version) AS version FROM retailops_schema_migrations').get()).toEqual({ version: 1 });
      expect(new SqliteProductRepository(database).findById('product-synthetic-01')).toEqual({
        contractVersion: '0.3.0',
        id: 'product-synthetic-01',
        baseUnitCode: 'each',
        evidenceIds: ['evidence-synthetic-01'],
      });
      expect(database.prepare('SELECT id FROM evidence').get()).toEqual({ id: 'evidence-synthetic-01' });
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_records'").all()).toHaveLength(0);
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
});
