import { AsyncLocalStorage } from 'node:async_hooks';
import Database from 'better-sqlite3';
import { migrateRetailOpsDatabase } from './migration-runner.js';

export class InvalidDomainEntityError extends Error {
  readonly code = "INVALID_DOMAIN_ENTITY";

  constructor(entityType: string, message: string) {
    super(entityType + " rejected by its domain contract: " + message);
    this.name = "InvalidDomainEntityError";
  }
}

export class CorruptPersistedEntityError extends Error {
  readonly code = "CORRUPT_PERSISTED_ENTITY";

  constructor(entityType: string, entityId: string, message: string, cause?: unknown) {
    super("Persisted " + entityType + "/" + entityId + " is corrupt: " + message, { cause });
    this.name = "CorruptPersistedEntityError";
  }
}

export class ImmutableEntityConflictError extends Error {
  readonly code = "IMMUTABLE_ENTITY_CONFLICT";

  constructor(entityType: string, entityId: string) {
    super(entityType + " is immutable for identity " + entityId);
    this.name = "ImmutableEntityConflictError";
  }
}

export class InvalidDomainRelationError extends Error {
  readonly code = "INVALID_DOMAIN_RELATION";

  constructor(message: string) {
    super(message);
    this.name = "InvalidDomainRelationError";
  }
}

export interface RuntimeSchema<T> {
  safeParse(value: unknown):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly message: string } };
}

export function validateForStorage<T>(schema: RuntimeSchema<T>, value: unknown, entityType: string): { entity: T; payload: string } {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InvalidDomainEntityError(entityType, parsed.error.message);
  return { entity: parsed.data, payload: JSON.stringify(parsed.data) };
}

export function parseStoredEntity<T>(
  schema: RuntimeSchema<T>,
  payload: string,
  entityType: string,
  entityId: string,
): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch (error) {
    throw new CorruptPersistedEntityError(entityType, entityId, "payload is not valid JSON", error);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new CorruptPersistedEntityError(entityType, entityId, parsed.error.message);
  }
  return parsed.data;
}

export function replaceOrderedReferences(
  database: Database.Database,
  table: string,
  ownerColumn: string,
  ownerId: string,
  referenceColumn: string,
  references: readonly string[],
  extraColumns: readonly string[] = [],
  extraValues: readonly string[] = [],
): void {
  if (![table, ownerColumn, referenceColumn, ...extraColumns].every((name) => /^[a-z_]+$/.test(name))) {
    throw new Error("Invalid internal SQLite identifier");
  }
  if (extraColumns.length !== extraValues.length) throw new Error("Invalid relation metadata");
  database.prepare("DELETE FROM " + table + " WHERE " + ownerColumn + " = ?"
    + extraColumns.map((column) => " AND " + column + " = ?").join("")).run(ownerId, ...extraValues);
  const columns = [ownerColumn, ...extraColumns, referenceColumn, "position"];
  const placeholders = columns.map(() => "?").join(", ");
  const statement = database.prepare("INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES (" + placeholders + ")");
  references.forEach((reference, position) => {
    statement.run(ownerId, ...extraValues, reference, position);
  });
}

export function readOrderedReferences(
  database: Database.Database,
  table: string,
  ownerColumn: string,
  ownerId: string,
  referenceColumn: string,
  extraColumn?: string,
  extraValue?: string,
): string[] {
  const identifiers = [table, ownerColumn, referenceColumn, ...(extraColumn === undefined ? [] : [extraColumn])];
  if (!identifiers.every((name) => /^[a-z_]+$/.test(name))) throw new Error("Invalid internal SQLite identifier");
  const whereExtra = extraColumn === undefined ? "" : " AND " + extraColumn + " = ?";
  const parameters = extraColumn === undefined ? [ownerId] : [ownerId, extraValue];
  const rows = database.prepare(
    "SELECT " + referenceColumn + " AS reference_id FROM " + table + " WHERE " + ownerColumn + " = ?" + whereExtra + " ORDER BY position",
  ).all(...parameters) as { reference_id: string }[];
  return rows.map((row) => row.reference_id);
}

export function assertStoredFields(
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
  entityType: string,
  entityId: string,
): void {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (actual[field] !== expectedValue) {
      throw new CorruptPersistedEntityError(entityType, entityId, "normalized column " + field + " does not match payload");
    }
  }
}

export function assertReferences(
  actual: readonly string[],
  expected: readonly string[],
  entityType: string,
  entityId: string,
  relation: string,
): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new CorruptPersistedEntityError(entityType, entityId, relation + " rows do not match payload references");
  }
}

type SynchronousTransactionResult<T> = T extends PromiseLike<unknown> ? never : T;

interface RetailOpsTransactionScope {
  readonly database: Database.Database;
  active: boolean;
  readonly parent: RetailOpsTransactionScope | undefined;
}

const transactionScope = new AsyncLocalStorage<RetailOpsTransactionScope>();

function rejectExpiredRepositoryTransaction(database: Database.Database): void {
  for (let scope = transactionScope.getStore(); scope !== undefined; scope = scope.parent) {
    if (scope.database === database && !scope.active) {
      throw new TypeError("RetailOps Repository write attempted after its transaction callback returned");
    }
  }
}

/**
 * Runs a synchronous callback in a SQLite transaction. Callbacks must not start
 * fire-and-forget work. Async functions are rejected before invocation; any
 * thenable result from a regular function is rejected before commit. Repository
 * transactions scheduled in this callback's async context are rejected after
 * it returns. Direct SQLite calls that bypass RetailOps Repositories cannot be
 * intercepted by this guard.
 */
export function withRetailOpsTransaction<T>(
  database: Database.Database,
  action: () => SynchronousTransactionResult<T>,
): T {
  rejectExpiredRepositoryTransaction(database);
  if (action.constructor.name === "AsyncFunction") {
    throw new TypeError("RetailOps SQLite transactions require a synchronous callback");
  }
  const scope: RetailOpsTransactionScope = {
    database,
    active: true,
    parent: transactionScope.getStore(),
  };
  try {
    return transactionScope.run(scope, () => {
      const run = database.transaction(() => {
        const result = action();
        if (result !== null && (typeof result === "object" || typeof result === "function")
          && typeof (result as { then?: unknown }).then === "function") {
          throw new TypeError("RetailOps SQLite transaction callbacks must not return a thenable");
        }
        return result as T;
      });
      return run();
    });
  } finally {
    scope.active = false;
  }
}

export function openRetailOpsDatabase(filePath: string): Database.Database {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new TypeError("A SQLite file path or :memory: is required");
  }
  const database = new Database(filePath);
  try {
    migrateRetailOpsDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
