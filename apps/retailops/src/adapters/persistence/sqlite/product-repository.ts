import type Database from 'better-sqlite3';
import { productSchema, type Product } from '../../../domain/index.js';
import {
  assertReferences,
  assertStoredFields,
  parseStoredEntity,
  readOrderedReferences,
  replaceOrderedReferences,
  validateForStorage,
  withRetailOpsTransaction,
} from './database.js';

type StoredProduct = { id: string; contract_version: string; base_unit_code: string; payload: string };

export class SqliteProductRepository {
  constructor(private readonly database: Database.Database) {}

  save(value: unknown): Product {
    const { entity, payload } = validateForStorage(productSchema, value, "Product");
    withRetailOpsTransaction(this.database, () => {
      this.database.prepare(
        "INSERT INTO products(id, contract_version, base_unit_code, payload) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET contract_version=excluded.contract_version, base_unit_code=excluded.base_unit_code, payload=excluded.payload",
      ).run(entity.id, entity.contractVersion, entity.baseUnitCode, payload);
      replaceOrderedReferences(this.database, "product_evidence", "product_id", entity.id, "evidence_id", entity.evidenceIds);
    });
    return entity;
  }

  findById(id: string): Product | undefined {
    const row = this.database.prepare(
      "SELECT id, contract_version, base_unit_code, payload FROM products WHERE id = ?",
    ).get(id) as StoredProduct | undefined;
    if (row === undefined) return undefined;
    const entity = parseStoredEntity(productSchema, row.payload, "Product", id);
    assertStoredFields(row, {
      id: entity.id,
      contract_version: entity.contractVersion,
      base_unit_code: entity.baseUnitCode,
    }, "Product", id);
    const actual = readOrderedReferences(this.database, "product_evidence", "product_id", id, "evidence_id");
    assertReferences(actual, entity.evidenceIds, "Product", id, "evidenceIds");
    return entity;
  }
}
