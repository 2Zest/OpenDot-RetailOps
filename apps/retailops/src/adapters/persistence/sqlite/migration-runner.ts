import type Database from 'better-sqlite3';
import { initialRetailOpsMigration } from './migrations/0001_initial.js';

const migrations = [initialRetailOpsMigration] as const;

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

  const latest = database.prepare(
    "SELECT COALESCE(MAX(version), 0) AS version FROM retailops_schema_migrations",
  ).get() as { version: number };
  const maxSupportedVersion = migrations[migrations.length - 1]?.version ?? 0;
  if (latest.version > maxSupportedVersion) {
    throw new Error("RetailOps database schema version " + latest.version + " is newer than supported version " + maxSupportedVersion);
  }

  for (const migration of migrations) {
    const applied = database.prepare(
      "SELECT 1 AS present FROM retailops_schema_migrations WHERE version = ?",
    ).get(migration.version);
    if (applied !== undefined) continue;

    const run = database.transaction(() => {
      migration.up(database);
      database.prepare(
        "INSERT INTO retailops_schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, new Date().toISOString());
    });
    run();
  }

  const foreignKeyErrors = database.pragma("foreign_key_check") as unknown[];
  if (foreignKeyErrors.length > 0) {
    throw new Error("RetailOps SQLite migration left " + foreignKeyErrors.length + " foreign key violation(s)");
  }
}
