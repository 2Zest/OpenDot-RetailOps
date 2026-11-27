import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateRetailOpsDatabase } from '../../../../src/adapters/persistence/sqlite/migration-runner.js';
import { openRetailOpsDatabase } from '../../../../src/adapters/persistence/sqlite/database.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('RetailOps SQLite database boundary', () => {
  it('migrates an empty temporary database and safely repeats migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'retailops-empty-'));
    temporaryDirectories.push(directory);
    const database = openRetailOpsDatabase(join(directory, 'test.sqlite'));

    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(database.prepare('SELECT MAX(version) AS version FROM retailops_schema_migrations').get()).toEqual({ version: 1 });
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").all()).toHaveLength(1);

    migrateRetailOpsDatabase(database);
    migrateRetailOpsDatabase(database);

    expect(database.prepare('SELECT version FROM retailops_schema_migrations ORDER BY version').all()).toEqual([{ version: 1 }]);
    database.close();
  });

  it('reopens a temporary file database without losing committed rows', () => {
    const directory = mkdtempSync(join(tmpdir(), 'retailops-reopen-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'test.sqlite');
    const first = openRetailOpsDatabase(filePath);
    first.prepare("INSERT INTO evidence(id, contract_version, source_kind, snapshot_id, observed_at, payload) VALUES (?, ?, ?, ?, ?, ?)")
      .run('e-1', '0.3.0', 'SIMULATED', 'snap-1', '2026-11-27T00:00:00Z',
        '{"contractVersion":"0.3.0","id":"e-1","snapshotId":"snap-1","locator":"fixture://reopen","observedAt":"2026-11-27T00:00:00Z","sourceKind":"SIMULATED","scenarioId":"scenario-1","seed":"seed-1","generatorVersion":"fixture-1"}');
    first.close();

    const reopened = openRetailOpsDatabase(filePath);
    expect(reopened.prepare('SELECT id, snapshot_id FROM evidence').get()).toEqual({ id: 'e-1', snapshot_id: 'snap-1' });
    reopened.close();
  });

  it('rejects opening without an explicit database path', () => {
    expect(() => openRetailOpsDatabase('')).toThrow(TypeError);
  });

  it('keeps test database files under a temporary directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'retailops-scope-'));
    temporaryDirectories.push(directory);
    const database = new Database(join(directory, 'scope.sqlite'));
    expect(database.name).toContain(directory);
    database.close();
  });
});
