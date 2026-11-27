import { describe, expect, it } from 'vitest';
import {
  DRAFT_REVISION_CANONICALIZATION_VERSION,
  draftRevisionEventSchema,
  draftRevisionSchema,
  draftRevisionStatusEventSchema,
} from '../../../../src/domain/decision/draft-revision.js';

const validRevision = {
  kind: 'DRAFT_REVISION_CREATED',
  contractVersion: '0.3.0',
  draftId: 'draft-01',
  revision: 1,
  canonicalizationVersion: DRAFT_REVISION_CANONICALIZATION_VERSION,
  canonicalDigest: 'sha256:' + 'a'.repeat(64),
  content: {
    inputSnapshot: {
      id: 'snapshot-01',
      productIds: ['product-01'],
      batchIds: ['batch-01'],
      evidenceIds: ['evidence-01'],
      policyId: 'policy-01',
      policyRevision: 'revision-01',
    },
    products: [{
      contractVersion: '0.3.0',
      id: 'product-01',
      baseUnitCode: 'each',
      evidenceIds: ['evidence-01'],
    }],
    batches: [{
      contractVersion: '0.3.0',
      id: 'batch-01',
      productId: 'product-01',
      expiry: { basis: 'DATE_ONLY', value: '2027-01-01', timeZone: 'Asia/Shanghai' },
      qualityStatus: 'PASS',
      stockBalance: {
        physicalOnHand: { value: '10', unitCode: 'each' },
        unavailable: { value: '0', unitCode: 'each' },
        availableToSell: { value: '10', unitCode: 'each' },
        reserved: { value: '0', unitCode: 'each' },
      },
      evidenceIds: ['evidence-01'],
    }],
    operations: [{
      operationId: 'operation-01',
      draftId: 'draft-01',
      kind: 'MARKDOWN_PROPOSAL',
      productId: 'product-01',
      batchId: 'batch-01',
      quantity: { value: '2.00', unitCode: 'each' },
      evidenceIds: ['evidence-01'],
      proposedPrice: { minorUnits: '123456', currencyCode: 'CNY', minorUnitScale: 2 },
    }],
    evidenceDigests: [{ evidenceId: 'evidence-01', canonicalDigest: 'sha256:' + 'b'.repeat(64) }],
    policy: { contractVersion: '0.3.0', id: 'policy-01', revision: 'revision-01', evidenceIds: ['evidence-01'] },
  },
  initialStatus: 'DRAFTED',
  eventId: 'event-01',
  trace: { taskId: 'task-01', agentRunId: 'run-01', toolCallIds: ['tool-01'] },
};

describe('Draft revision domain contract', () => {
  it('accepts a v0.3.0 snapshot with exact decimal and money strings', () => {
    expect(draftRevisionSchema.parse(validRevision)).toEqual(validRevision);
  });

  it('requires a versioned canonical digest and rejects a negative candidate price', () => {
    expect(draftRevisionSchema.safeParse({ ...validRevision, canonicalizationVersion: 'v2' }).success).toBe(false);
    expect(draftRevisionSchema.safeParse({ ...validRevision, canonicalDigest: 'agent-says-approved' }).success).toBe(false);
    const content = validRevision.content;
    const operation = content.operations[0];
    expect(draftRevisionSchema.safeParse({
      ...validRevision,
      content: {
        ...content,
        operations: [{ ...operation, proposedPrice: { minorUnits: '-1', currencyCode: 'CNY', minorUnitScale: 2 } }],
      },
    }).success).toBe(false);
  });

  it('does not accept agent approval or hard-rule self-report fields', () => {
    expect(draftRevisionSchema.safeParse({ ...validRevision, approval: 'APPROVED' }).success).toBe(false);
    expect(draftRevisionSchema.safeParse({ ...validRevision, hardRulesPassed: true }).success).toBe(false);
  });

  it('rejects snapshot references that disagree across Product, Batch, Operation, Evidence, and Policy', () => {
    const content = validRevision.content;
    const operation = content.operations[0];
    const mismatchedOperation = {
      ...content,
      operations: [{ ...operation, productId: 'product-other' }],
    };
    expect(draftRevisionSchema.safeParse({ ...validRevision, content: mismatchedOperation }).success).toBe(false);
    expect(draftRevisionSchema.safeParse({
      ...validRevision,
      content: { ...content, operations: [{ ...operation, draftId: 'draft-other' }] },
    }).success).toBe(false);

    const mismatchedPolicy = {
      ...content,
      policy: { ...content.policy, revision: 'revision-other' },
    };
    expect(draftRevisionSchema.safeParse({ ...validRevision, content: mismatchedPolicy }).success).toBe(false);

    const unboundEvidence = {
      ...content,
      evidenceDigests: [{ evidenceId: 'evidence-other', canonicalDigest: 'sha256:' + 'b'.repeat(64) }],
    };
    expect(draftRevisionSchema.safeParse({ ...validRevision, content: unboundEvidence }).success).toBe(false);

    const mismatchedBatch = {
      ...content,
      batches: [{ ...content.batches[0], productId: 'product-other' }],
    };
    expect(draftRevisionSchema.safeParse({ ...validRevision, content: mismatchedBatch }).success).toBe(false);
  });

  it('represents status changes as append-only guarded events', () => {
    const event = {
      kind: 'DRAFT_STATUS_TRANSITIONED',
      draftId: 'draft-01',
      revision: 1,
      fromStatus: 'DRAFTED',
      toStatus: 'RISK_REVIEW',
      eventId: 'event-02',
      trace: { taskId: 'task-01', toolCallIds: [] },
    };
    expect(draftRevisionStatusEventSchema.parse(event)).toEqual(event);
    expect(draftRevisionEventSchema.parse(event)).toEqual(event);
    expect(draftRevisionStatusEventSchema.safeParse({ ...event, approval: 'APPROVED' }).success).toBe(false);
  });
});
