import { afterEach, describe, expect, it } from 'vitest';
import {
  CorruptPersistedEntityError,
  openRetailOpsDatabase,
  withRetailOpsTransaction,
} from '../../../../src/adapters/persistence/sqlite/database.js';
import { SqliteBatchRepository } from '../../../../src/adapters/persistence/sqlite/batch-repository.js';
import { SqliteDraftRepository } from '../../../../src/adapters/persistence/sqlite/draft-repository.js';
import { SqliteEvidenceRepository } from '../../../../src/adapters/persistence/sqlite/evidence-repository.js';
import { SqliteOperationRepository } from '../../../../src/adapters/persistence/sqlite/operation-repository.js';
import { SqlitePolicyRepository } from '../../../../src/adapters/persistence/sqlite/policy-repository.js';
import { SqliteProductRepository } from '../../../../src/adapters/persistence/sqlite/product-repository.js';

const databases: ReturnType<typeof openRetailOpsDatabase>[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('v0.3.0 repository contract', () => {
  it('round-trips all six validated domain entities and rejects corrupted persistence', () => {
    const database = openRetailOpsDatabase(':memory:');
    databases.push(database);
    const evidence = new SqliteEvidenceRepository(database);
    const products = new SqliteProductRepository(database);
    const policies = new SqlitePolicyRepository(database);
    const batches = new SqliteBatchRepository(database);
    const drafts = new SqliteDraftRepository(database);
    const operations = new SqliteOperationRepository(database);

    const source = {
      contractVersion: '0.3.0' as const,
      id: 'e-contract-01',
      snapshotId: 'snapshot-contract-01',
      locator: 'fixture://contract/source-01',
      observedAt: '2026-11-27T12:00:00.123456Z',
      sourceKind: 'SIMULATED' as const,
      scenarioId: 'scenario-contract-01',
      seed: 'seed-000000000000000001',
      generatorVersion: 'contract-fixture-1',
    };
    const product = {
      contractVersion: '0.3.0' as const, id: 'p-contract-01', baseUnitCode: 'each', evidenceIds: [source.id],
    };
    const policy = {
      contractVersion: '0.3.0' as const, id: 'policy-contract-01', revision: 'revision-01', evidenceIds: [source.id],
    };
    const batch = {
      contractVersion: '0.3.0' as const,
      id: 'batch-contract-01', productId: product.id,
      expiry: { basis: 'DATE_ONLY' as const, value: '2026-11-30', timeZone: 'Asia/Shanghai' },
      qualityStatus: 'PASS' as const,
      stockBalance: {
        physicalOnHand: { value: '100.0000000000001', unitCode: 'each' },
        unavailable: { value: '0.0000000000001', unitCode: 'each' },
        availableToSell: { value: '99', unitCode: 'each' },
        reserved: { value: '1', unitCode: 'each' },
      },
      evidenceIds: [source.id],
    };
    const draft = {
      contractVersion: '0.3.0' as const, id: 'draft-contract-01', draftDigest: 'sha256:contract-fixture', status: 'DRAFTED' as const,
      inputSnapshot: {
        id: 'snapshot-contract-01', productIds: [product.id], batchIds: [batch.id], evidenceIds: [source.id],
        policyId: policy.id, policyRevision: policy.revision,
      },
      operationIds: ['operation-contract-01'],
    };
    const operation = {
      contractVersion: '0.3.0' as const, id: 'operation-contract-01', draftId: draft.id,
      productId: product.id, batchId: batch.id,
      quantity: { value: '999999999999999999999999.000000000000000001', unitCode: 'each' },
      status: 'PROPOSED' as const, evidenceIds: [source.id], kind: 'MARKDOWN_PROPOSAL' as const,
      proposedPrice: { minorUnits: '123456789012345678901234567890', currencyCode: 'CNY', minorUnitScale: 2 },
    };

    evidence.save(source);
    products.save(product);
    policies.save(policy);
    batches.save(batch);
    withRetailOpsTransaction(database, () => {
      drafts.save(draft);
      operations.save(operation);
    });

    expect(evidence.findById(source.id)).toEqual(source);
    expect(products.findById(product.id)).toEqual(product);
    expect(policies.findByIdAndRevision(policy.id, policy.revision)).toEqual(policy);
    expect(batches.findById(batch.id)).toEqual(batch);
    expect(drafts.findById(draft.id)).toEqual(draft);
    expect(operations.findById(operation.id)).toEqual(operation);

    database.prepare('UPDATE batches SET quality_status = ? WHERE id = ?').run('UNKNOWN', batch.id);
    expect(() => batches.findById(batch.id)).toThrow(CorruptPersistedEntityError);
  });
});
