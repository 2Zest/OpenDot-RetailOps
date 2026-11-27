import type Database from 'better-sqlite3';
import { canTransitionDraft } from '../../../domain/decision/draft.js';
import {
  calculateDraftRevisionDigest,
  draftRevisionEventSchema,
  draftRevisionSchema,
  draftRevisionSeedSchema,
  draftRevisionStatusEventSchema,
  type DraftRevision,
  type DraftRevisionEvent,
  type DraftRevisionSeed,
  type DraftRevisionStatusEvent,
} from '../../../domain/decision/draft-revision.js';
import type { DraftRevisionRepository } from '../../../application/ports/draft-revision-repository.js';
import {
  CorruptPersistedEntityError,
  ImmutableEntityConflictError,
  InvalidDomainEntityError,
  InvalidDomainRelationError,
  assertStoredFields,
  parseStoredEntity,
  withRetailOpsTransaction,
} from './database.js';

interface StoredRevision {
  draft_id: string;
  revision: number;
  contract_version: string;
  canonicalization_version: string;
  canonical_digest: string;
  initial_status: string;
  payload: string;
}

interface StoredEvent {
  sequence: number;
  event_id: string;
  draft_id: string;
  revision: number;
  kind: string;
  payload: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') + '}';
}

function assertRevisionDigest(revision: DraftRevision, identity: string): void {
  const expected = calculateDraftRevisionDigest(revision.contractVersion, revision.content);
  if (revision.canonicalDigest !== expected) {
    throw new CorruptPersistedEntityError('DraftRevision', identity, 'canonical digest does not match frozen content');
  }
}

function parseRevision(row: StoredRevision): DraftRevision {
  const identity = row.draft_id + '/' + row.revision;
  const revision = parseStoredEntity(draftRevisionSchema, row.payload, 'DraftRevision', identity);
  assertStoredFields({ ...row }, {
    draft_id: revision.draftId,
    revision: revision.revision,
    contract_version: revision.contractVersion,
    canonicalization_version: revision.canonicalizationVersion,
    canonical_digest: revision.canonicalDigest,
    initial_status: revision.initialStatus,
  }, 'DraftRevision', identity);
  assertRevisionDigest(revision, identity);
  return revision;
}

function parseEvent(row: StoredEvent): DraftRevisionEvent {
  const identity = row.draft_id + '/' + row.revision + '/' + row.event_id;
  const event = parseStoredEntity(draftRevisionEventSchema, row.payload, 'DraftRevisionEvent', identity);
  assertStoredFields({ ...row }, {
    event_id: event.eventId,
    draft_id: event.draftId,
    revision: event.revision,
    kind: event.kind,
  }, 'DraftRevisionEvent', identity);
  if (event.kind === 'DRAFT_REVISION_CREATED') assertRevisionDigest(event, identity);
  return event;
}

/**
 * Expects `draft_revisions` (UNIQUE draft_id/revision) and
 * `draft_revision_events` (globally UNIQUE event_id, ordered sequence, FK to
 * the revision). The migration is intentionally owned by the task holding
 * the shared SQLite migration lock; this adapter does not create schema.
 */
export class SqliteDraftRevisionRepository implements DraftRevisionRepository {
  constructor(private readonly database: Database.Database) {}

  findEventById(eventId: string): DraftRevisionEvent | undefined {
    const row = this.database.prepare(
      'SELECT sequence, event_id, draft_id, revision, kind, payload FROM draft_revision_events WHERE event_id = ?',
    ).get(eventId) as StoredEvent | undefined;
    return row === undefined ? undefined : parseEvent(row);
  }

  findRevisionByDraftIdAndNumber(draftId: string, revision: number): DraftRevision | undefined {
    const row = this.database.prepare(
      `SELECT draft_id, revision, contract_version, canonicalization_version,
        canonical_digest, initial_status, payload
       FROM draft_revisions WHERE draft_id = ? AND revision = ?`,
    ).get(draftId, revision) as StoredRevision | undefined;
    return row === undefined ? undefined : parseRevision(row);
  }

  findLatestRevision(draftId: string): DraftRevision | undefined {
    const row = this.database.prepare(
      `SELECT draft_id, revision, contract_version, canonicalization_version,
        canonical_digest, initial_status, payload
       FROM draft_revisions WHERE draft_id = ? ORDER BY revision DESC LIMIT 1`,
    ).get(draftId) as StoredRevision | undefined;
    return row === undefined ? undefined : parseRevision(row);
  }

  getCurrentStatus(draftId: string, revision: number): DraftRevision['initialStatus'] | DraftRevisionStatusEvent['toStatus'] | undefined {
    const snapshot = this.findRevisionByDraftIdAndNumber(draftId, revision);
    if (snapshot === undefined) return undefined;
    const rows = this.database.prepare(
      `SELECT sequence, event_id, draft_id, revision, kind, payload
       FROM draft_revision_events
       WHERE draft_id = ? AND revision = ? AND kind = 'DRAFT_STATUS_TRANSITIONED'
       ORDER BY sequence`,
    ).all(draftId, revision) as StoredEvent[];
    let currentStatus: DraftRevision['initialStatus'] | DraftRevisionStatusEvent['toStatus'] = snapshot.initialStatus;
    for (const row of rows) {
      const event = parseEvent(row);
      if (event.kind !== 'DRAFT_STATUS_TRANSITIONED'
        || event.fromStatus !== currentStatus
        || !canTransitionDraft(currentStatus, event.toStatus, {})) {
        throw new CorruptPersistedEntityError(
          'DraftRevisionEvent', draftId + '/' + revision + '/' + row.event_id,
          'status history is discontinuous or lacks trusted transition evidence',
        );
      }
      currentStatus = event.toStatus;
    }
    return currentStatus;
  }

  appendRevision(seedInput: DraftRevisionSeed): DraftRevision {
    const seedResult = draftRevisionSeedSchema.safeParse(seedInput);
    if (!seedResult.success) throw new InvalidDomainEntityError('DraftRevisionSeed', seedResult.error.message);
    const seed = seedResult.data;
    if (seed.canonicalDigest !== calculateDraftRevisionDigest(seed.contractVersion, seed.content)) {
      throw new InvalidDomainEntityError('DraftRevision', 'canonical digest does not match frozen content');
    }

    return withRetailOpsTransaction(this.database, () => {
      const existing = this.findEventById(seed.eventId);
      if (existing !== undefined) {
        if (existing.kind === 'DRAFT_REVISION_CREATED'
          && existing.draftId === seed.draftId
          && existing.canonicalDigest === seed.canonicalDigest
          && canonicalJson(existing.trace) === canonicalJson(seed.trace)) return existing;
        throw new ImmutableEntityConflictError('DraftRevisionEvent', seed.eventId);
      }

      const latest = this.database.prepare(
        'SELECT MAX(revision) AS revision FROM draft_revisions WHERE draft_id = ?',
      ).get(seed.draftId) as { revision: number | null };
      const nextRevision = (latest.revision ?? 0) + 1;
      const parsedRevision = draftRevisionSchema.safeParse({ ...seed, revision: nextRevision });
      if (!parsedRevision.success) throw new InvalidDomainEntityError('DraftRevision', parsedRevision.error.message);
      const revision = parsedRevision.data;
      this.database.prepare(
        `INSERT INTO draft_revisions(
          draft_id, revision, contract_version, canonicalization_version,
          canonical_digest, initial_status, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(revision.draftId, revision.revision, revision.contractVersion, revision.canonicalizationVersion,
        revision.canonicalDigest, revision.initialStatus, JSON.stringify(revision));
      this.insertEvent(revision);
      return revision;
    });
  }

  appendStatusEvent(eventInput: DraftRevisionStatusEvent): DraftRevisionStatusEvent {
    const parsed = draftRevisionStatusEventSchema.safeParse(eventInput);
    if (!parsed.success) throw new InvalidDomainEntityError('DraftRevisionStatusEvent', parsed.error.message);
    const event = parsed.data;

    return withRetailOpsTransaction(this.database, () => {
      const existing = this.findEventById(event.eventId);
      if (existing !== undefined) {
        if (existing.kind === 'DRAFT_STATUS_TRANSITIONED' && canonicalJson(existing) === canonicalJson(event)) return existing;
        throw new ImmutableEntityConflictError('DraftRevisionEvent', event.eventId);
      }
      const currentStatus = this.getCurrentStatus(event.draftId, event.revision);
      if (currentStatus === undefined) throw new InvalidDomainRelationError('Draft revision does not exist for status event');
      if (event.fromStatus !== currentStatus || !canTransitionDraft(currentStatus, event.toStatus, {})) {
        throw new InvalidDomainEntityError('DraftRevisionStatusEvent', 'transition does not pass canTransitionDraft without trusted evidence');
      }
      this.insertEvent(event);
      return event;
    });
  }

  private insertEvent(event: DraftRevisionEvent): void {
    this.database.prepare(
      `INSERT INTO draft_revision_events(event_id, draft_id, revision, kind, payload)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(event.eventId, event.draftId, event.revision, event.kind, JSON.stringify(event));
  }
}
