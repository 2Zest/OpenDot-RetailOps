import type { Batch } from '../../domain/inventory/batch.js';
import type { Evidence } from '../../domain/evidence/evidence.js';
import type { Draft } from '../../domain/decision/draft.js';
import type { Operation } from '../../domain/inventory/operation.js';
import type { Product } from '../../domain/product/product.js';
import type { Policy } from '../../domain/policy/policy.js';
import type {
  DraftRevision,
  DraftRevisionEvent,
  DraftRevisionSeed,
  DraftRevisionStatusEvent,
} from '../../domain/decision/draft-revision.js';

export interface DraftRevisionSources {
  readonly drafts: { findById(id: string): Draft | unknown | undefined };
  readonly products: { findById(id: string): Product | unknown | undefined };
  readonly batches: { findById(id: string): Batch | unknown | undefined };
  readonly operations: { findById(id: string): Operation | unknown | undefined };
  readonly evidence: { findById(id: string): Evidence | unknown | undefined };
  readonly policies: {
    findByIdAndRevision(id: string, revision: string): Policy | unknown | undefined;
  };
}

/**
 * Append-only storage boundary for immutable content revisions and status events.
 * Implementations allocate the next revision and append it atomically, and
 * enforce global eventId and (draftId, revision) uniqueness. Status is derived
 * from the revision's DRAFTED initial state plus its ordered transition events.
 */
export interface DraftRevisionRepository {
  findEventById(eventId: string): DraftRevisionEvent | undefined;
  findRevisionByDraftIdAndNumber(draftId: string, revision: number): DraftRevision | undefined;
  findLatestRevision(draftId: string): DraftRevision | undefined;
  getCurrentStatus(draftId: string, revision: number): DraftRevision['initialStatus'] | DraftRevisionStatusEvent['toStatus'] | undefined;
  appendRevision(seed: DraftRevisionSeed): DraftRevision;
  appendStatusEvent(event: DraftRevisionStatusEvent): DraftRevisionStatusEvent;
}
