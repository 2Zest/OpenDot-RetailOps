import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteDraftRevisionRepository } from '../../../../src/adapters/persistence/sqlite/draft-revision-repository.js';
import {
  CorruptPersistedEntityError,
  ImmutableEntityConflictError,
  InvalidDomainEntityError,
  openRetailOpsDatabase,
} from '../../../../src/adapters/persistence/sqlite/database.js';
import {
  DRAFT_REVISION_CANONICALIZATION_VERSION,
  calculateDraftRevisionDigest,
  type DraftRevisionSeed,
  type DraftRevisionStatusEvent,
} from '../../../../src/domain/decision/draft-revision.js';

const databases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function makeSeed(eventId = 'create-01', draftId = 'draft-01'): DraftRevisionSeed {
  const content: DraftRevisionSeed['content'] = {
    inputSnapshot: {
      id: 'snapshot-01', productIds: ['product-01'], batchIds: ['batch-01'], evidenceIds: ['evidence-01'],
      policyId: 'policy-01', policyRevision: 'policy-revision-01',
    },
    products: [{ contractVersion: '0.3.0', id: 'product-01', baseUnitCode: 'each', evidenceIds: ['evidence-01'] }],
    batches: [{
      contractVersion: '0.3.0', id: 'batch-01', productId: 'product-01',
      expiry: { basis: 'DATE_ONLY' as const, value: '2027-01-01', timeZone: 'Asia/Shanghai' },
      qualityStatus: 'PASS' as const,
      stockBalance: {
        physicalOnHand: { value: '10', unitCode: 'each' }, unavailable: { value: '0', unitCode: 'each' },
        availableToSell: { value: '10', unitCode: 'each' }, reserved: { value: '0', unitCode: 'each' },
      },
      evidenceIds: ['evidence-01'],
    }],
    operations: [{
      operationId: 'operation-01', draftId, productId: 'product-01', batchId: 'batch-01',
      quantity: { value: '1.00', unitCode: 'each' }, evidenceIds: ['evidence-01'],
      kind: 'MARKDOWN_PROPOSAL' as const,
      proposedPrice: { minorUnits: '1234', currencyCode: 'CNY', minorUnitScale: 2 },
    }],
    evidenceDigests: [{ evidenceId: 'evidence-01', canonicalDigest: 'sha256:' + '1'.repeat(64) }],
    policy: { contractVersion: '0.3.0', id: 'policy-01', revision: 'policy-revision-01', evidenceIds: ['evidence-01'] },
  };
  return {
    kind: 'DRAFT_REVISION_CREATED',
    contractVersion: '0.3.0',
    draftId,
    canonicalizationVersion: DRAFT_REVISION_CANONICALIZATION_VERSION,
    canonicalDigest: calculateDraftRevisionDigest('0.3.0', content),
    content,
    initialStatus: 'DRAFTED',
    eventId,
    trace: { taskId: 'task-01', agentRunId: 'run-01', toolCallIds: ['tool-01'] },
  };
}

function statusEvent(revision: number, toStatus: DraftRevisionStatusEvent['toStatus'], eventId: string): DraftRevisionStatusEvent {
  return {
    kind: 'DRAFT_STATUS_TRANSITIONED', draftId: 'draft-01', revision,
    fromStatus: 'DRAFTED', toStatus, eventId,
    trace: { taskId: 'task-01', agentRunId: 'run-01', toolCallIds: ['tool-01'] },
  };
}

function setup() {
  const database = openRetailOpsDatabase(':memory:');
  databases.push(database);
  return { database, repository: new SqliteDraftRevisionRepository(database) };
}

describe('SQLite Draft revision repository (formal application schema)', () => {
  it('allocates monotonically within the append transaction and keeps frozen history immutable', () => {
    const { database, repository } = setup();
    const first = repository.appendRevision(makeSeed('create-01'));
    const second = repository.appendRevision(makeSeed('create-02'));

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(repository.findRevisionByDraftIdAndNumber('draft-01', 1)).toEqual(first);
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revisions').get()).toEqual({ count: 2 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revision_events').get()).toEqual({ count: 2 });
    expect(() => database.prepare('UPDATE draft_revisions SET canonical_digest = ? WHERE draft_id = ? AND revision = 1')
      .run('sha256:' + '0'.repeat(64), 'draft-01')).toThrow(/immutable/);
    expect(() => database.prepare('DELETE FROM draft_revisions WHERE draft_id = ? AND revision = 1').run('draft-01'))
      .toThrow(/immutable/);
    expect(() => database.prepare('UPDATE draft_revision_events SET payload = ? WHERE event_id = ?')
      .run('{}', 'create-01')).toThrow(/append-only/);
    expect(() => database.prepare('DELETE FROM draft_revision_events WHERE event_id = ?').run('create-01'))
      .toThrow(/append-only/);
    expect(() => database.prepare(
      "INSERT INTO draft_revision_events(event_id, draft_id, revision, kind, payload) VALUES ('orphan', 'missing', 1, 'DRAFT_STATUS_TRANSITIONED', '{}')",
    ).run()).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('enforces eventId uniqueness globally and makes an identical create request idempotent', () => {
    const { database, repository } = setup();
    const seed = makeSeed();
    const first = repository.appendRevision(seed);
    expect(repository.appendRevision(seed)).toEqual(first);
    expect(() => repository.appendRevision(makeSeed('create-01', 'draft-02'))).toThrow(ImmutableEntityConflictError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revision_events WHERE event_id = ?').get('create-01'))
      .toEqual({ count: 1 });
  });

  it('recomputes the digest on reads and refuses changed frozen content', () => {
    const { database, repository } = setup();
    const revision = repository.appendRevision(makeSeed());
    database.exec('DROP TRIGGER draft_revisions_immutable_update');
    const stored = database.prepare('SELECT payload FROM draft_revisions WHERE draft_id = ? AND revision = 1')
      .get('draft-01') as { payload: string };
    const tampered = JSON.parse(stored.payload);
    tampered.content.operations[0].quantity.value = '9';
    database.prepare('UPDATE draft_revisions SET payload = ? WHERE draft_id = ? AND revision = 1')
      .run(JSON.stringify(tampered), 'draft-01');

    expect(() => repository.findRevisionByDraftIdAndNumber('draft-01', revision.revision))
      .toThrow(CorruptPersistedEntityError);
  });

  it('rolls revision allocation and the revision row back if event append fails', () => {
    const { database, repository } = setup();
    database.exec(`CREATE TRIGGER fail_revision_event BEFORE INSERT ON draft_revision_events
      WHEN NEW.kind = 'DRAFT_REVISION_CREATED' BEGIN SELECT RAISE(ABORT, 'injected event insert failure'); END;`);

    expect(() => repository.appendRevision(makeSeed())).toThrow(/injected event insert failure/);
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revisions').get()).toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revision_events').get()).toEqual({ count: 0 });
  });

  it('uses canTransitionDraft at repository boundary and refuses approval or execution without evidence', () => {
    const { database, repository } = setup();
    repository.appendRevision(makeSeed());

    expect(() => repository.appendStatusEvent(statusEvent(1, 'APPROVED', 'approve-01')))
      .toThrow(InvalidDomainEntityError);
    expect(() => repository.appendStatusEvent(statusEvent(1, 'EXECUTING', 'execute-01')))
      .toThrow(InvalidDomainEntityError);
    expect(database.prepare('SELECT COUNT(*) AS count FROM draft_revision_events').get()).toEqual({ count: 1 });
    expect(repository.getCurrentStatus('draft-01', 1)).toBe('DRAFTED');
  });

  it('persists ordered status trace and frozen revision across close and reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'retailops-draft-revision-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'draft-revisions.sqlite');
    const firstDatabase = openRetailOpsDatabase(databasePath);
    databases.push(firstDatabase);
    const firstRepository = new SqliteDraftRevisionRepository(firstDatabase);
    const revision = firstRepository.appendRevision(makeSeed());
    const event = statusEvent(revision.revision, 'RISK_REVIEW', 'review-01');
    firstRepository.appendStatusEvent(event);
    firstDatabase.close();
    databases.splice(databases.indexOf(firstDatabase), 1);

    const reopened = openRetailOpsDatabase(databasePath);
    databases.push(reopened);
    const repository = new SqliteDraftRevisionRepository(reopened);
    expect(repository.findRevisionByDraftIdAndNumber('draft-01', 1)).toEqual(revision);
    expect(repository.getCurrentStatus('draft-01', 1)).toBe('RISK_REVIEW');
    expect(repository.findEventById('review-01')).toEqual(event);
    expect(repository.findEventById('create-01')).toEqual(revision);
  });
});
