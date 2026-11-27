import { describe, expect, it } from 'vitest';
import { DraftRevisionApplicationService, DraftRevisionServiceError, canonicalizeDraftRevisionValue } from '../../src/application/use-cases/freeze-draft-revision.js';
import type { DraftRevisionRepository } from '../../src/application/ports/draft-revision-repository.js';
import type {
  DraftRevision,
  DraftRevisionEvent,
  DraftRevisionSeed,
  DraftRevisionStatusEvent,
} from '../../src/domain/decision/draft-revision.js';
import type { DraftStatus } from '../../src/domain/decision/draft.js';

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    id: 'draft-01',
    draftDigest: 'agent-provided-digest',
    status: 'DRAFTED',
    inputSnapshot: {
      id: 'snapshot-01',
      productIds: ['product-01'],
      batchIds: ['batch-01'],
      evidenceIds: ['evidence-01'],
      policyId: 'policy-01',
      policyRevision: 'revision-01',
    },
    operationIds: ['operation-01'],
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    id: 'product-01',
    baseUnitCode: 'each',
    evidenceIds: ['evidence-01'],
    ...overrides,
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function makeOperation(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    id: 'operation-01',
    draftId: 'draft-01',
    productId: 'product-01',
    batchId: 'batch-01',
    quantity: { value: '2.00', unitCode: 'each' },
    status: 'PROPOSED',
    evidenceIds: ['evidence-01'],
    kind: 'MARKDOWN_PROPOSAL',
    proposedPrice: { minorUnits: '123456', currencyCode: 'CNY', minorUnitScale: 2 },
    ...overrides,
  };
}

function makeEvidence(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    id: 'evidence-01',
    snapshotId: 'snapshot-01',
    locator: 'fixture://retail/source/01',
    observedAt: '2026-11-27T08:00:00Z',
    sourceKind: 'PUBLIC_HISTORICAL',
    sourceName: 'fixture-source',
    sourceRevision: 'revision-01',
    ...overrides,
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    id: 'policy-01',
    revision: 'revision-01',
    evidenceIds: ['evidence-01'],
    ...overrides,
  };
}

class MemoryDraftRevisionRepository implements DraftRevisionRepository {
  readonly events: DraftRevisionEvent[] = [];

  findEventById(eventId: string): DraftRevisionEvent | undefined {
    return this.events.find((event) => event.eventId === eventId);
  }

  findRevisionByDraftIdAndNumber(draftId: string, revision: number): DraftRevision | undefined {
    return this.events.find((event): event is DraftRevision => event.kind === 'DRAFT_REVISION_CREATED'
      && event.draftId === draftId && event.revision === revision);
  }

  findLatestRevision(draftId: string): DraftRevision | undefined {
    return this.events.filter((event): event is DraftRevision => event.kind === 'DRAFT_REVISION_CREATED'
      && event.draftId === draftId).sort((a, b) => b.revision - a.revision)[0];
  }

  getCurrentStatus(draftId: string, revision: number): DraftStatus | undefined {
    const snapshot = this.findRevisionByDraftIdAndNumber(draftId, revision);
    if (snapshot === undefined) return undefined;
    const latestStatus = [...this.events].reverse().find((event): event is DraftRevisionStatusEvent =>
      event.kind === 'DRAFT_STATUS_TRANSITIONED' && event.draftId === draftId && event.revision === revision);
    return latestStatus?.toStatus ?? snapshot.initialStatus;
  }

  appendRevision(seed: DraftRevisionSeed): DraftRevision {
    const revision = (this.findLatestRevision(seed.draftId)?.revision ?? 0) + 1;
    const event: DraftRevision = { ...seed, revision };
    this.events.push(event);
    return event;
  }

  appendStatusEvent(event: DraftRevisionStatusEvent): DraftRevisionStatusEvent {
    if (this.findEventById(event.eventId) !== undefined) throw new Error('duplicate event id');
    this.events.push(event);
    return event;
  }

  seedEventForTest(event: DraftRevisionEvent): void {
    this.events.push(event);
  }
}

function setup() {
  const records = {
    drafts: new Map<string, unknown>([['draft-01', makeDraft()]]),
    products: new Map<string, unknown>([['product-01', makeProduct()]]),
    batches: new Map<string, unknown>([['batch-01', makeBatch()]]),
    operations: new Map<string, unknown>([['operation-01', makeOperation()]]),
    evidence: new Map<string, unknown>([['evidence-01', makeEvidence()]]),
    policies: new Map<string, unknown>([['policy-01|revision-01', makePolicy()]]),
  };
  const sources = {
    drafts: { findById: (id: string) => records.drafts.get(id) },
    products: { findById: (id: string) => records.products.get(id) },
    batches: { findById: (id: string) => records.batches.get(id) },
    operations: { findById: (id: string) => records.operations.get(id) },
    evidence: { findById: (id: string) => records.evidence.get(id) },
    policies: { findByIdAndRevision: (id: string, revision: string) => records.policies.get(id + '|' + revision) },
  };
  const repository = new MemoryDraftRevisionRepository();
  const service = new DraftRevisionApplicationService(sources, repository);
  const command = (eventId: string, taskId = 'task-01') => ({
    draftId: 'draft-01',
    eventId,
    trace: { taskId, agentRunId: 'run-01', toolCallIds: ['tool-01'] },
  });
  return { records, repository, service, command };
}

function expectCode(action: () => unknown, code: string): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DraftRevisionServiceError);
  expect(caught).toMatchObject({ code });
}

describe('freeze draft revision application service', () => {
  it('recomputes SHA-256 and excludes agent digest, lifecycle state, and trace IDs', () => {
    const first = setup();
    const revision1 = first.service.freeze(first.command('event-01'));
    first.records.drafts.set('draft-01', makeDraft({ draftDigest: 'another-agent-digest', status: 'APPROVED' }));
    first.records.operations.set('operation-01', makeOperation({ status: 'APPROVED' }));
    const revision2 = first.service.freeze(first.command('event-02', 'task-02'));
    expect(revision1.canonicalDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(revision1.canonicalDigest).not.toBe('agent-provided-digest');
    expect(revision2.canonicalDigest).toBe(revision1.canonicalDigest);
    expect(revision2.initialStatus).toBe('DRAFTED');
    expect(revision2.trace.taskId).toBe('task-02');
  });

  it('changes the digest for business, input, Evidence, Policy, Product, and Batch snapshot changes', () => {
    const { records, service, command, repository } = setup();
    const first = service.freeze(command('event-01'));
    records.operations.set('operation-01', makeOperation({
      proposedPrice: { minorUnits: '123457', currencyCode: 'CNY', minorUnitScale: 2 },
      quantity: { value: '2.000', unitCode: 'each' },
    }));
    records.evidence.set('evidence-01', makeEvidence({ snapshotId: 'snapshot-02', observedAt: '2026-11-27T09:00:00Z' }));
    records.policies.set('policy-01|revision-02', makePolicy({ revision: 'revision-02' }));
    records.drafts.set('draft-01', makeDraft({
      inputSnapshot: {
        id: 'snapshot-02',
        productIds: ['product-01'],
        batchIds: ['batch-01'],
        evidenceIds: ['evidence-01'],
        policyId: 'policy-01',
        policyRevision: 'revision-02',
      },
    }));
    const second = service.freeze(command('event-02'));
    expect(second.revision).toBe(2);
    expect(second.canonicalDigest).not.toBe(first.canonicalDigest);
    expect(first.content.operations[0]?.quantity.value).toBe('2.00');
    expect(first.content.operations[0]?.kind === 'MARKDOWN_PROPOSAL' && first.content.operations[0].proposedPrice.minorUnits)
      .toBe('123456');
    expect(second.content.operations[0]?.quantity.value).toBe('2.000');
    expect(second.content.operations[0]?.kind === 'MARKDOWN_PROPOSAL' && second.content.operations[0].proposedPrice.minorUnits)
      .toBe('123457');
    expect(repository.findRevisionByDraftIdAndNumber('draft-01', 1)).toEqual(first);
    expect(repository.events).toHaveLength(2);
  });

  it('uses code point ordering for object keys and preserves business array order', () => {
    const value: Record<string, number> = {};
    value['\u{10000}'] = 2;
    value['\uE000'] = 1;
    const codePointOrdered = '{"\uE000":1,"\u{10000}":2}';
    expect(canonicalizeDraftRevisionValue(value)).toBe(codePointOrdered);
    expect(canonicalizeDraftRevisionValue({ ids: ['a', 'b'] }))
      .not.toBe(canonicalizeDraftRevisionValue({ ids: ['b', 'a'] }));
  });

  it('returns the same revision for a duplicate event and rejects eventId reuse with changed semantics', () => {
    const { records, service, command, repository } = setup();
    const first = service.freeze(command('event-01'));
    expect(service.freeze(command('event-01'))).toEqual(first);
    records.operations.set('operation-01', makeOperation({ proposedPrice: { minorUnits: '1', currencyCode: 'CNY', minorUnitScale: 2 } }));
    expect(service.freeze(command('event-01'))).toEqual(first);
    expectCode(() => service.freeze({
      ...command('event-01'),
      trace: { taskId: 'different-task', agentRunId: 'run-01', toolCallIds: ['tool-01'] },
    }), 'IDEMPOTENCY_CONFLICT');
    expect(repository.events).toHaveLength(1);
  });

  it('replays a successful freeze event idempotently after source data changes', () => {
    const { records, service, command, repository } = setup();
    const request = command('create-after-source-change');
    const first = service.freeze(request);
    records.products.set('product-01', makeProduct({ baseUnitCode: 'case' }));

    expect(service.freeze(request)).toEqual(first);
    expect(repository.events).toHaveLength(1);
  });

  it('rejects conflicting or missing Product, Batch, Operation, Evidence, and Policy references', () => {
    const missingOperation = setup();
    missingOperation.records.drafts.set('draft-01', makeDraft({ operationIds: ['missing-operation'] }));
    expectCode(() => missingOperation.service.freeze(missingOperation.command('event-01')), 'OPERATION_NOT_FOUND');

    const mismatch = setup();
    mismatch.records.operations.set('operation-01', makeOperation({ draftId: 'other-draft' }));
    expectCode(() => mismatch.service.freeze(mismatch.command('event-01')), 'INVALID_RELATION');

    const wrongBatch = setup();
    wrongBatch.records.batches.set('batch-01', makeBatch({ productId: 'other-product' }));
    expectCode(() => wrongBatch.service.freeze(wrongBatch.command('event-01')), 'INVALID_SOURCE_CONTRACT');

    const missingEvidence = setup();
    missingEvidence.records.evidence.clear();
    expectCode(() => missingEvidence.service.freeze(missingEvidence.command('event-01')), 'EVIDENCE_NOT_FOUND');

    const unboundEvidence = setup();
    unboundEvidence.records.operations.set('operation-01', makeOperation({ evidenceIds: ['other-evidence'] }));
    expectCode(() => unboundEvidence.service.freeze(unboundEvidence.command('event-01')), 'INVALID_RELATION');

    const evidenceForOtherSnapshot = setup();
    evidenceForOtherSnapshot.records.evidence.set('evidence-01', makeEvidence({ snapshotId: 'other-snapshot' }));
    expectCode(() => evidenceForOtherSnapshot.service.freeze(evidenceForOtherSnapshot.command('event-01')), 'INVALID_RELATION');

    const missingPolicy = setup();
    missingPolicy.records.policies.clear();
    expectCode(() => missingPolicy.service.freeze(missingPolicy.command('event-01')), 'POLICY_NOT_FOUND');
  });

  it('uses canTransitionDraft and refuses agent-supplied approval or hard-rule evidence', () => {
    const { service, command } = setup();
    const revision = service.freeze(command('create-01'));
    const trace = { taskId: 'task-01', agentRunId: 'run-01', toolCallIds: ['tool-01'] };
    const enteredReview = service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-01',
      toStatus: 'RISK_REVIEW', trace,
    });
    expect(enteredReview.fromStatus).toBe('DRAFTED');
    expect(enteredReview.toStatus).toBe('RISK_REVIEW');

    expectCode(() => service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-02',
      toStatus: 'AWAITING_MANAGER', trace, riskReview: 'PASS',
    }), 'INVALID_COMMAND');
    expectCode(() => service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-03',
      toStatus: 'APPROVED', trace, approval: 'APPROVED',
    }), 'INVALID_COMMAND');
    expectCode(() => service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-04',
      toStatus: 'EXECUTING', trace, precheck: { hardRules: 'PASS' },
    }), 'INVALID_COMMAND');
    expectCode(() => service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-05',
      toStatus: 'APPROVED', trace,
    }), 'ILLEGAL_STATUS_TRANSITION');
  });

  it('refuses transitions that require risk, approval, precheck, execution, or reconciliation evidence', () => {
    const missingEvidenceTransitions = [
      ['RISK_REVIEW', 'AWAITING_MANAGER'],
      ['AWAITING_MANAGER', 'APPROVED'],
      ['APPROVED', 'PRECHECK'],
      ['APPROVED', 'APPROVAL_REVOKED'],
      ['APPROVED', 'APPROVAL_EXPIRED'],
      ['PRECHECK', 'EXECUTING'],
      ['PRECHECK', 'FAILED'],
      ['PRECHECK', 'CANCELLED'],
      ['PRECHECK', 'UNCERTAIN'],
      ['EXECUTING', 'COMPLETED'],
      ['EXECUTING', 'FAILED'],
      ['EXECUTING', 'CANCELLED'],
      ['EXECUTING', 'UNCERTAIN'],
      ['UNCERTAIN', 'COMPLETED'],
      ['UNCERTAIN', 'FAILED'],
    ] as const;

    for (const [fromStatus, toStatus] of missingEvidenceTransitions) {
      const { service, command, repository } = setup();
      const revision = service.freeze(command('create-01'));
      repository.seedEventForTest({
        kind: 'DRAFT_STATUS_TRANSITIONED',
        draftId: revision.draftId,
        revision: revision.revision,
        fromStatus: revision.initialStatus,
        toStatus: fromStatus,
        eventId: 'seed-' + fromStatus,
        trace: { taskId: 'trusted-state-fixture', toolCallIds: [] },
      });

      expectCode(() => service.transition({
        draftId: revision.draftId,
        revision: revision.revision,
        eventId: 'attempt-' + fromStatus + '-' + toStatus,
        toStatus,
        trace: { taskId: 'task-01', toolCallIds: [] },
      }), 'ILLEGAL_STATUS_TRANSITION');
    }
  });

  it('makes status event replay idempotent and rejects a conflicting reuse', () => {
    const { service, command } = setup();
    const revision = service.freeze(command('create-01'));
    const transition = {
      draftId: revision.draftId, revision: revision.revision, eventId: 'transition-01',
      toStatus: 'RISK_REVIEW', trace: { taskId: 'task-01', toolCallIds: [] },
    };
    const first = service.transition(transition);
    expect(service.transition(transition)).toEqual(first);
    expectCode(() => service.transition({ ...transition, toStatus: 'CANCELLED' }), 'IDEMPOTENCY_CONFLICT');
  });

  it('rejects unknown runtime statuses without mutating the event log', () => {
    const { service, command, repository } = setup();
    const revision = service.freeze(command('create-01'));
    expectCode(() => service.transition({
      draftId: revision.draftId, revision: revision.revision, eventId: 'bad-state',
      toStatus: 'UNKNOWN', trace: { taskId: 'task-01', toolCallIds: [] },
    }), 'INVALID_COMMAND');
    expect(repository.events).toHaveLength(1);
  });
});
