import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteBatchRepository } from '../../../../src/adapters/persistence/sqlite/batch-repository.js';
import { CorruptPersistedEntityError, InvalidDomainEntityError, openRetailOpsDatabase, withRetailOpsTransaction } from '../../../../src/adapters/persistence/sqlite/database.js';
import { SqliteDraftRepository } from '../../../../src/adapters/persistence/sqlite/draft-repository.js';
import { SqliteEvidenceRepository } from '../../../../src/adapters/persistence/sqlite/evidence-repository.js';
import { SqliteOperationRepository } from '../../../../src/adapters/persistence/sqlite/operation-repository.js';
import { SqlitePolicyRepository } from '../../../../src/adapters/persistence/sqlite/policy-repository.js';
import { SqliteProductRepository } from '../../../../src/adapters/persistence/sqlite/product-repository.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function evidence() {
  return {
    contractVersion: '0.3.0' as const,
    id: 'evidence-01',
    snapshotId: 'snapshot-01',
    locator: 'fixture://source/01',
    observedAt: '2026-11-27T12:00:00.123456Z',
    sourceKind: 'SIMULATED' as const,
    scenarioId: 'scenario-01',
    seed: 'seed-999999999999999999',
    generatorVersion: 'fixture-1',
  };
}

function product(evidenceIds = ['evidence-01']) {
  return {
    contractVersion: '0.3.0' as const,
    id: 'product-01',
    baseUnitCode: 'each',
    evidenceIds,
  };
}

function policy() {
  return {
    contractVersion: '0.3.0' as const,
    id: 'policy-01',
    revision: 'revision-2026-11-27',
    evidenceIds: ['evidence-01'],
  };
}

function batch() {
  return {
    contractVersion: '0.3.0' as const,
    id: 'batch-01',
    productId: 'product-01',
    expiry: { basis: 'DATE_ONLY' as const, value: '2026-11-30', timeZone: 'Asia/Shanghai' },
    qualityStatus: 'PASS' as const,
    stockBalance: {
      physicalOnHand: { value: '100.0000000000001', unitCode: 'each' },
      unavailable: { value: '0.0000000000001', unitCode: 'each' },
      availableToSell: { value: '99', unitCode: 'each' },
      reserved: { value: '1', unitCode: 'each' },
    },
    evidenceIds: ['evidence-01'],
  };
}

function draft() {
  return {
    contractVersion: '0.3.0' as const,
    id: 'draft-01',
    draftDigest: 'sha256:immutable-draft',
    status: 'DRAFTED' as const,
    inputSnapshot: {
      id: 'snapshot-01',
      productIds: ['product-01'],
      batchIds: ['batch-01'],
      evidenceIds: ['evidence-01'],
      policyId: 'policy-01',
      policyRevision: 'revision-2026-11-27',
    },
    operationIds: ['operation-01'],
  };
}

function operation() {
  return {
    contractVersion: '0.3.0' as const,
    id: 'operation-01',
    draftId: 'draft-01',
    productId: 'product-01',
    batchId: 'batch-01',
    quantity: { value: '999999999999999999999999.000000000000000001', unitCode: 'each' },
    status: 'PROPOSED' as const,
    evidenceIds: ['evidence-01'],
    kind: 'MARKDOWN_PROPOSAL' as const,
    proposedPrice: { minorUnits: '123456789012345678901234567890', currencyCode: 'CNY', minorUnitScale: 2 },
  };
}

function repositories(database: ReturnType<typeof openRetailOpsDatabase>) {
  return {
    evidence: new SqliteEvidenceRepository(database),
    products: new SqliteProductRepository(database),
    policies: new SqlitePolicyRepository(database),
    batches: new SqliteBatchRepository(database),
    drafts: new SqliteDraftRepository(database),
    operations: new SqliteOperationRepository(database),
  };
}

function seed(database: ReturnType<typeof openRetailOpsDatabase>) {
  const repos = repositories(database);
  const e = evidence();
  const p = product(['evidence-01', 'evidence-01']);
  const pol = policy();
  const b = batch();
  const d = draft();
  const op = operation();

  repos.evidence.save(e);
  repos.products.save(p);
  repos.policies.save(pol);
  repos.batches.save(b);
  withRetailOpsTransaction(database, () => {
    repos.drafts.save(d);
    repos.operations.save(op);
  });

  return { repos, entities: { evidence: e, product: p, policy: pol, batch: b, draft: d, operation: op } };
}

describe('RetailOps SQLite repositories', () => {
  it('round-trips all six v0.3.0 contracts without changing decimal, money, time, or source strings', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const { repos, entities } = seed(database);

      expect(repos.evidence.findById(entities.evidence.id)).toEqual(entities.evidence);
      expect(repos.products.findById(entities.product.id)).toEqual(entities.product);
      expect(repos.policies.findByIdAndRevision(entities.policy.id, entities.policy.revision)).toEqual(entities.policy);
      expect(repos.batches.findById(entities.batch.id)).toEqual(entities.batch);
      expect(repos.drafts.findById(entities.draft.id)).toEqual(entities.draft);
      expect(repos.operations.findById(entities.operation.id)).toEqual(entities.operation);
    } finally {
      database.close();
    }
  });

  it('retains all six contracts after the database is closed and reopened', () => {
    const directory = mkdtempSync(join(tmpdir(), 'retailops-reopen-contracts-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'business.sqlite');
    const first = openRetailOpsDatabase(filePath);
    const firstSeed = seed(first);
    first.close();

    const reopened = openRetailOpsDatabase(filePath);
    try {
      const repos = repositories(reopened);
      expect(repos.evidence.findById(firstSeed.entities.evidence.id)).toEqual(firstSeed.entities.evidence);
      expect(repos.products.findById(firstSeed.entities.product.id)).toEqual(firstSeed.entities.product);
      expect(repos.policies.findByIdAndRevision(firstSeed.entities.policy.id, firstSeed.entities.policy.revision)).toEqual(firstSeed.entities.policy);
      expect(repos.batches.findById(firstSeed.entities.batch.id)).toEqual(firstSeed.entities.batch);
      expect(repos.drafts.findById(firstSeed.entities.draft.id)).toEqual(firstSeed.entities.draft);
      expect(repos.operations.findById(firstSeed.entities.operation.id)).toEqual(firstSeed.entities.operation);
    } finally {
      reopened.close();
    }
  });

  it('rejects invalid domain input before writing and rolls back a foreign-key failure', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      expect(() => repos.products.save({ ...product(), id: '   ' })).toThrow(InvalidDomainEntityError);
      expect(database.prepare('SELECT COUNT(*) AS count FROM products').get()).toEqual({ count: 0 });

      expect(() => repos.products.save(product(['missing-evidence']))).toThrow();
      expect(database.prepare('SELECT COUNT(*) AS count FROM products').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('enforces primary-key uniqueness for direct duplicate persistence writes', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      repos.evidence.save(evidence());
      repos.products.save(product());

      expect(() => database.prepare(
        'INSERT INTO products(id, contract_version, base_unit_code, payload) VALUES (?, ?, ?, ?)',
      ).run('product-01', '0.3.0', 'each', JSON.stringify(product()))).toThrow(/UNIQUE constraint failed: products\.id/);
    } finally {
      database.close();
    }
  });

  it('rolls back changes from multiple repositories when a later step throws', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      expect(() => withRetailOpsTransaction(database, () => {
        repos.evidence.save(evidence());
        repos.products.save(product());
        throw new Error('injected cross-repository failure');
      })).toThrow('injected cross-repository failure');

      expect(database.prepare('SELECT COUNT(*) AS count FROM evidence').get()).toEqual({ count: 0 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM products').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('rejects normalized-column corruption that disagrees with the validated payload', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      repos.evidence.save(evidence());
      repos.products.save(product());
      database.prepare('UPDATE products SET base_unit_code = ? WHERE id = ?').run('case', 'product-01');

      expect(() => repos.products.findById('product-01')).toThrow(CorruptPersistedEntityError);
    } finally {
      database.close();
    }
  });

  it('rejects corrupted JSON payloads when reading persisted data', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      repos.evidence.save(evidence());
      repos.products.save(product());
      database.pragma('ignore_check_constraints = ON');
      database.prepare('UPDATE products SET payload = ? WHERE id = ?').run('{not-json', 'product-01');

      expect(() => repos.products.findById('product-01')).toThrow(CorruptPersistedEntityError);
    } finally {
      database.close();
    }
  });

  it('rejects relation-table drift rather than returning a partial contract', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repos = repositories(database);
      repos.evidence.save(evidence());
      repos.products.save(product());
      database.prepare('DELETE FROM product_evidence WHERE product_id = ?').run('product-01');

      expect(() => repos.products.findById('product-01')).toThrow(CorruptPersistedEntityError);
    } finally {
      database.close();
    }
  });
});
