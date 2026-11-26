import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  draftSchema,
  draftStatusSchema,
  operationSchema,
  policySchema,
  productSchema,
} from '../../src/domain/index.js';

describe('RETAIL-01 versioned domain contracts', () => {
  it('pins a required engineering contract version and rejects unsupported versions', () => {
    expect(CONTRACT_VERSION).toBe('0.2.0');
    const product = { contractVersion: '0.2.0', id: 'fixture-product', baseUnitCode: 'fixture-unit', evidenceIds: ['fixture-evidence'] };
    expect(productSchema.safeParse(product).success).toBe(true);
    expect(productSchema.safeParse({ ...product, contractVersion: '0.1.0' }).success).toBe(false);
    expect(productSchema.safeParse({ id: 'fixture-product', baseUnitCode: 'fixture-unit', evidenceIds: ['fixture-evidence'] }).success).toBe(false);
  });

  it('requires an explicit Policy identity, revision, version, and evidence', () => {
    const policy = { contractVersion: '0.2.0', id: 'fixture-policy', revision: 'fixture-revision', evidenceIds: ['fixture-policy-source'] };
    expect(policySchema.safeParse(policy).success).toBe(true);
    expect(policySchema.safeParse({ ...policy, evidenceIds: [] }).success).toBe(false);
    expect(policySchema.safeParse({ contractVersion: '0.2.0', id: 'fixture-policy', evidenceIds: ['fixture-policy-source'] }).success).toBe(false);
  });

  it('rejects missing draft policy/snapshot references and unknown states', () => {
    const draft = {
      contractVersion: '0.2.0',
      id: 'fixture-draft',
      draftDigest: 'fixture-digest-reference',
      status: 'DRAFTED',
      inputSnapshot: {
        id: 'fixture-snapshot',
        productIds: ['fixture-product'],
        batchIds: ['fixture-batch'],
        evidenceIds: ['fixture-evidence'],
        policyId: 'fixture-policy',
        policyRevision: 'fixture-policy-revision',
      },
      operationIds: ['fixture-operation'],
    };
    expect(draftSchema.safeParse(draft).success).toBe(true);
    expect(draftSchema.safeParse({ ...draft, status: 'UNKNOWN' }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, inputSnapshot: { ...draft.inputSnapshot, policyId: undefined } }).success).toBe(false);
    expect(draftStatusSchema.safeParse('UNRECOGNIZED').success).toBe(false);
  });

  it('accepts only the bounded V0 operation proposal kinds with explicit business values', () => {
    const markdownProposal = {
      contractVersion: '0.2.0',
      id: 'fixture-operation',
      draftId: 'fixture-draft',
      productId: 'fixture-product',
      batchId: 'fixture-batch',
      quantity: { value: '2', unitCode: 'fixture-unit' },
      status: 'PROPOSED',
      evidenceIds: ['fixture-evidence'],
      kind: 'MARKDOWN_PROPOSAL',
      proposedPrice: { minorUnits: '100', currencyCode: 'USD', minorUnitScale: 2 },
    };
    expect(operationSchema.safeParse(markdownProposal).success).toBe(true);
    expect(operationSchema.safeParse({ ...markdownProposal, kind: 'REPLENISHMENT_ORDER' }).success).toBe(false);
    expect(operationSchema.safeParse({ ...markdownProposal, proposedPrice: { minorUnits: '100', currencyCode: 'USD' } }).success).toBe(false);
  });
});
