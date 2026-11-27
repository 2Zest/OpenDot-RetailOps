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

  it('treats identical Evidence writes as idempotent and rejects ID collisions without changing provenance', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const repo = new SqliteEvidenceRepository(database);
      const original = evidence();
      const secondParent = { ...evidence(), id: 'evidence-02', snapshotId: 'snapshot-02' };
      const derived = {
        contractVersion: '0.3.0' as const,
        id: 'derived-01',
        snapshotId: 'derived-snapshot-01',
        locator: 'fixture://derived/01',
        observedAt: '2026-11-27T12:00:00.123456Z',
        sourceKind: 'DERIVED' as const,
        parentEvidenceIds: [original.id],
        methodVersion: 'derive-1',
      };
      repo.save(original);
      repo.save(secondParent);
      repo.save(derived);

      const reordered = {
        generatorVersion: original.generatorVersion,
        seed: original.seed,
        scenarioId: original.scenarioId,
        sourceKind: original.sourceKind,
        observedAt: original.observedAt,
        locator: original.locator,
        snapshotId: original.snapshotId,
        id: original.id,
        contractVersion: original.contractVersion,
      };
      expect(repo.save(reordered)).toEqual(original);
      expect(() => repo.save({ ...derived, locator: 'fixture://tampered/01', parentEvidenceIds: [secondParent.id] })).toThrow();
      expect(repo.findById(derived.id)).toEqual(derived);
      expect(database.prepare('SELECT parent_evidence_id FROM evidence_parent_references WHERE evidence_id = ?').all(derived.id))
        .toEqual([{ parent_evidence_id: original.id }]);
    } finally {
      database.close();
    }
  });

  it('keeps a Policy ID and revision immutable while allowing a new revision', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const evidenceRepo = new SqliteEvidenceRepository(database);
      const repo = new SqlitePolicyRepository(database);
      evidenceRepo.save(evidence());
      evidenceRepo.save({ ...evidence(), id: 'evidence-02', snapshotId: 'snapshot-02' });
      const original = policy();
      repo.save(original);

      expect(repo.save({ ...original })).toEqual(original);
      expect(() => repo.save({ ...original, evidenceIds: ['evidence-02'] })).toThrow();
      expect(repo.findByIdAndRevision(original.id, original.revision)).toEqual(original);
      expect(repo.save({ ...original, revision: 'revision-2026-11-28', evidenceIds: ['evidence-02'] }))
        .toEqual({ ...original, revision: 'revision-2026-11-28', evidenceIds: ['evidence-02'] });
      expect(repo.findByIdAndRevision(original.id, original.revision)).toEqual(original);
    } finally {
      database.close();
    }
  });

  it('rejects an Operation rebound to a second Draft that also references it', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const { repos, entities } = seed(database);
      const secondDraft = { ...entities.draft, id: 'draft-02', draftDigest: 'sha256:second-draft' };
      expect(() => repos.drafts.save(secondDraft)).toThrow();
      expect(repos.operations.findById(entities.operation.id)).toEqual(entities.operation);

      const unboundDraft = { ...secondDraft, operationIds: ['operation-02'] };
      expect(() => withRetailOpsTransaction(database, () => {
        repos.drafts.save(unboundDraft);
        repos.operations.save({ ...entities.operation, id: 'operation-02' });
      })).toThrow();
      expect(database.prepare('SELECT COUNT(*) AS count FROM drafts WHERE id = ?').get(unboundDraft.id)).toEqual({ count: 0 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM operations WHERE id = ?').get('operation-02')).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('rejects Draft and Operation snapshots whose Batch belongs to a different Product', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const { repos, entities } = seed(database);
      const secondProduct = { ...entities.product, id: 'product-02' };
      const secondBatch = { ...entities.batch, id: 'batch-02', productId: secondProduct.id };
      repos.products.save(secondProduct);
      repos.batches.save(secondBatch);

      const invalidDraft = {
        ...entities.draft,
        id: 'draft-02',
        draftDigest: 'sha256:cross-product-draft',
        inputSnapshot: { ...entities.draft.inputSnapshot, productIds: [secondProduct.id], batchIds: [entities.batch.id] },
        operationIds: ['operation-02'],
      };
      expect(() => repos.drafts.save(invalidDraft)).toThrow();
      expect(database.prepare('SELECT COUNT(*) AS count FROM drafts WHERE id = ?').get(invalidDraft.id)).toEqual({ count: 0 });

      const validSecondDraft = {
        ...invalidDraft,
        inputSnapshot: { ...invalidDraft.inputSnapshot, batchIds: [secondBatch.id] },
      };
      expect(() => withRetailOpsTransaction(database, () => {
        repos.drafts.save(validSecondDraft);
        repos.operations.save({
          ...entities.operation,
          id: 'operation-02',
          draftId: validSecondDraft.id,
          productId: secondProduct.id,
          batchId: entities.batch.id,
        });
      })).toThrow();
      expect(database.prepare('SELECT COUNT(*) AS count FROM drafts WHERE id = ?').get(validSecondDraft.id)).toEqual({ count: 0 });
      expect(database.prepare('SELECT COUNT(*) AS count FROM operations WHERE id = ?').get('operation-02')).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('rejects async transaction callbacks before invoking them', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      let callbackStarted = false;
      const action = (async () => {
        callbackStarted = true;
        database.prepare('INSERT INTO evidence(id, contract_version, source_kind, snapshot_id, observed_at, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run('async-write', '0.3.0', 'SIMULATED', 'async-snapshot', '2026-11-27T12:00:00Z', '{}');
      }) as () => unknown;
      expect(() => withRetailOpsTransaction(database, action)).toThrow();
      expect(callbackStarted).toBe(false);
      expect(database.prepare('SELECT COUNT(*) AS count FROM evidence').get()).toEqual({ count: 0 });

      if (false) {
        // @ts-expect-error Async transaction callbacks are not part of the synchronous API.
        withRetailOpsTransaction(database, async () => undefined);
      }
    } finally {
      database.close();
    }
  });

  it('rejects a promise-returning callback and rolls back its synchronous writes', () => {
    const database = openRetailOpsDatabase(':memory:');
    try {
      const action = () => {
        database.prepare('INSERT INTO evidence(id, contract_version, source_kind, snapshot_id, observed_at, payload) VALUES (?, ?, ?, ?, ?, ?)')
          .run('promise-write', '0.3.0', 'SIMULATED', 'promise-snapshot', '2026-11-27T12:00:00Z', '{}');
        return { then: () => undefined };
      };
      expect(() => withRetailOpsTransaction(database, action)).toThrow();
      expect(database.prepare('SELECT COUNT(*) AS count FROM evidence').get()).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
});
