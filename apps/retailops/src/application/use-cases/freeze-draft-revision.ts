import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canTransitionDraft, draftSchema, draftStatusSchema } from '../../domain/decision/draft.js';
import {
  DRAFT_REVISION_CANONICALIZATION_VERSION,
  draftRevisionEventSchema,
  draftRevisionSchema,
  draftRevisionTraceSchema,
  type DraftRevision,
  type DraftRevisionEvent,
  type DraftRevisionStatusEvent,
} from '../../domain/decision/draft-revision.js';
import { evidenceSchema } from '../../domain/evidence/evidence.js';
import { batchSchema } from '../../domain/inventory/batch.js';
import { productSchema } from '../../domain/product/product.js';
import { operationSchema, type Operation } from '../../domain/inventory/operation.js';
import { policySchema } from '../../domain/policy/policy.js';
import { opaqueReferenceSchema } from '../../domain/shared/primitives.js';
import type { DraftRevisionRepository, DraftRevisionSources } from '../ports/draft-revision-repository.js';

const freezeCommandSchema = z.object({
  draftId: opaqueReferenceSchema,
  eventId: opaqueReferenceSchema,
  trace: draftRevisionTraceSchema,
}).strict();

const transitionCommandSchema = z.object({
  draftId: opaqueReferenceSchema,
  revision: z.number().int().positive().safe(),
  eventId: opaqueReferenceSchema,
  toStatus: draftStatusSchema,
  trace: draftRevisionTraceSchema,
}).strict();

export type DraftRevisionServiceErrorCode =
  | 'INVALID_COMMAND'
  | 'DRAFT_NOT_FOUND'
  | 'OPERATION_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'BATCH_NOT_FOUND'
  | 'POLICY_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND'
  | 'INVALID_SOURCE_CONTRACT'
  | 'INVALID_RELATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REVISION_NOT_FOUND'
  | 'ILLEGAL_STATUS_TRANSITION'
  | 'STORAGE_CONFLICT';

export class DraftRevisionServiceError extends Error {
  constructor(readonly code: DraftRevisionServiceErrorCode, message: string) {
    super(message);
    this.name = 'DraftRevisionServiceError';
  }
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const b = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

/** Canonical JSON v1: recursively code-point-sort object keys and preserve all array order. */
export function canonicalizeDraftRevisionValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('Canonical draft values may contain only safe integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((entry) => canonicalizeDraftRevisionValue(entry)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical draft values must be plain JSON objects');
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodePoints);
    return '{' + keys.map((key) => {
      const entry = record[key];
      if (entry === undefined) throw new TypeError('Canonical draft values cannot contain undefined');
      return JSON.stringify(key) + ':' + canonicalizeDraftRevisionValue(entry);
    }).join(',') + '}';
  }
  throw new TypeError('Canonical draft values must be JSON data');
}

function sha256Canonical(value: unknown): string {
  const canonical = canonicalizeDraftRevisionValue(value);
  return 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function invalidSource(label: string, detail: string): DraftRevisionServiceError {
  return new DraftRevisionServiceError('INVALID_SOURCE_CONTRACT', label + ': ' + detail);
}

function toOperationSnapshot(operation: Operation) {
  const base = {
    operationId: operation.id,
    draftId: operation.draftId,
    productId: operation.productId,
    batchId: operation.batchId,
    quantity: operation.quantity,
    evidenceIds: operation.evidenceIds,
  };
  if (operation.kind === 'MARKDOWN_PROPOSAL') {
    return { ...base, kind: operation.kind, proposedPrice: operation.proposedPrice };
  }
  return { ...base, kind: operation.kind, reasonCode: operation.reasonCode };
}

function traceEquals(left: z.infer<typeof draftRevisionTraceSchema>, right: z.infer<typeof draftRevisionTraceSchema>): boolean {
  return canonicalizeDraftRevisionValue(left) === canonicalizeDraftRevisionValue(right);
}

export class DraftRevisionApplicationService {
  constructor(
    private readonly sources: DraftRevisionSources,
    private readonly revisions: DraftRevisionRepository,
  ) {}

  freeze(rawCommand: unknown): DraftRevision {
    const commandResult = freezeCommandSchema.safeParse(rawCommand);
    if (!commandResult.success) {
      throw new DraftRevisionServiceError('INVALID_COMMAND', commandResult.error.message);
    }
    const command = commandResult.data;

    const draftValue = this.sources.drafts.findById(command.draftId);
    if (draftValue === undefined) {
      throw new DraftRevisionServiceError('DRAFT_NOT_FOUND', 'Draft ' + command.draftId + ' was not found');
    }
    const draftResult = draftSchema.safeParse(draftValue);
    if (!draftResult.success || draftResult.data.id !== command.draftId) {
      throw invalidSource('Draft', draftResult.success ? 'repository returned a different identity' : draftResult.error.message);
    }
    const draft = draftResult.data;

    const snapshotProductIds = new Set(draft.inputSnapshot.productIds);
    const snapshotBatchIds = new Set(draft.inputSnapshot.batchIds);
    const snapshotEvidenceIds = new Set(draft.inputSnapshot.evidenceIds);
    const products = draft.inputSnapshot.productIds.map((id) => {
      const value = this.sources.products.findById(id);
      if (value === undefined) throw new DraftRevisionServiceError('PRODUCT_NOT_FOUND', 'Product ' + id + ' was not found');
      const result = productSchema.safeParse(value);
      if (!result.success || result.data.id !== id || result.data.contractVersion !== draft.contractVersion) {
        throw invalidSource('Product ' + id, result.success ? 'identity or contract version mismatch' : result.error.message);
      }
      return result.data;
    });
    const batches = draft.inputSnapshot.batchIds.map((id) => {
      const value = this.sources.batches.findById(id);
      if (value === undefined) throw new DraftRevisionServiceError('BATCH_NOT_FOUND', 'Batch ' + id + ' was not found');
      const result = batchSchema.safeParse(value);
      if (!result.success || result.data.id !== id || result.data.contractVersion !== draft.contractVersion
        || !snapshotProductIds.has(result.data.productId)) {
        throw invalidSource('Batch ' + id, result.success ? 'identity, contract version, or Product reference mismatch' : result.error.message);
      }
      return result.data;
    });
    const assertEvidenceInSnapshot = (owner: string, ids: readonly string[]) => {
      const missing = ids.find((id) => !snapshotEvidenceIds.has(id));
      if (missing !== undefined) {
        throw new DraftRevisionServiceError('INVALID_RELATION', owner + ' Evidence ' + missing + ' is outside the Draft input snapshot');
      }
    };
    for (const product of products) assertEvidenceInSnapshot('Product ' + product.id, product.evidenceIds);
    for (const batch of batches) assertEvidenceInSnapshot('Batch ' + batch.id, batch.evidenceIds);

    const operations = draft.operationIds.map((id) => {
      const value = this.sources.operations.findById(id);
      if (value === undefined) {
        throw new DraftRevisionServiceError('OPERATION_NOT_FOUND', 'Operation ' + id + ' was not found');
      }
      const result = operationSchema.safeParse(value);
      if (!result.success || result.data.id !== id || result.data.contractVersion !== draft.contractVersion) {
        throw invalidSource('Operation ' + id, result.success ? 'identity or contract version mismatch' : result.error.message);
      }
      const operation = result.data;
      const batch = batches.find((candidate) => candidate.id === operation.batchId);
      if (operation.draftId !== draft.id
        || !snapshotProductIds.has(operation.productId)
        || !snapshotBatchIds.has(operation.batchId)
        || batch?.productId !== operation.productId) {
        throw new DraftRevisionServiceError('INVALID_RELATION', 'Operation ' + id + ' does not match the Draft Product/Batch snapshot');
      }
      assertEvidenceInSnapshot('Operation ' + id, operation.evidenceIds);
      return operation;
    });

    const policyValue = this.sources.policies.findByIdAndRevision(
      draft.inputSnapshot.policyId,
      draft.inputSnapshot.policyRevision,
    );
    if (policyValue === undefined) {
      throw new DraftRevisionServiceError('POLICY_NOT_FOUND', 'Policy revision was not found');
    }
    const policyResult = policySchema.safeParse(policyValue);
    if (!policyResult.success
      || policyResult.data.id !== draft.inputSnapshot.policyId
      || policyResult.data.revision !== draft.inputSnapshot.policyRevision
      || policyResult.data.contractVersion !== draft.contractVersion) {
      throw invalidSource('Policy', policyResult.success ? 'policy identity does not match the input snapshot' : policyResult.error.message);
    }
    const policy = policyResult.data;
    assertEvidenceInSnapshot('Policy ' + policy.id + '/' + policy.revision, policy.evidenceIds);

    const evidence = draft.inputSnapshot.evidenceIds.map((id) => {
      const value = this.sources.evidence.findById(id);
      if (value === undefined) {
        throw new DraftRevisionServiceError('EVIDENCE_NOT_FOUND', 'Evidence ' + id + ' was not found');
      }
      const result = evidenceSchema.safeParse(value);
      if (!result.success || result.data.id !== id || result.data.contractVersion !== draft.contractVersion) {
        throw invalidSource('Evidence ' + id, result.success ? 'identity or contract version mismatch' : result.error.message);
      }
      if (result.data.snapshotId !== draft.inputSnapshot.id) {
        throw new DraftRevisionServiceError('INVALID_RELATION', 'Evidence ' + id + ' belongs to a different input snapshot');
      }
      return result.data;
    });

    const content = {
      inputSnapshot: draft.inputSnapshot,
      products,
      batches,
      operations: operations.map(toOperationSnapshot),
      evidenceDigests: evidence.map((item) => ({
        evidenceId: item.id,
        canonicalDigest: sha256Canonical(item),
      })),
      policy,
    };
    const digestInput = {
      canonicalizationVersion: DRAFT_REVISION_CANONICALIZATION_VERSION,
      contractVersion: draft.contractVersion,
      content,
    };
    const canonicalDigest = sha256Canonical(digestInput);

    const existingEvent = this.revisions.findEventById(command.eventId);
    if (existingEvent !== undefined) {
      if (existingEvent.kind === 'DRAFT_REVISION_CREATED'
        && existingEvent.draftId === draft.id
        && existingEvent.canonicalDigest === canonicalDigest
        && traceEquals(existingEvent.trace, command.trace)) return existingEvent;
      throw new DraftRevisionServiceError('IDEMPOTENCY_CONFLICT', 'eventId was already used for a different event');
    }

    const latest = this.revisions.findLatestRevision(draft.id);
    const revision = (latest?.revision ?? 0) + 1;
    const eventResult = draftRevisionSchema.safeParse({
      kind: 'DRAFT_REVISION_CREATED',
      contractVersion: draft.contractVersion,
      draftId: draft.id,
      revision,
      canonicalizationVersion: DRAFT_REVISION_CANONICALIZATION_VERSION,
      canonicalDigest,
      content,
      initialStatus: 'DRAFTED',
      eventId: command.eventId,
      trace: command.trace,
    });
    if (!eventResult.success) throw invalidSource('DraftRevision', eventResult.error.message);

    const appended = this.revisions.appendEvent(eventResult.data);
    const parsed = draftRevisionEventSchema.safeParse(appended);
    if (!parsed.success || parsed.data.kind !== 'DRAFT_REVISION_CREATED') {
      throw new DraftRevisionServiceError('STORAGE_CONFLICT', 'Repository returned an invalid revision event');
    }
    return parsed.data;
  }

  transition(rawCommand: unknown): DraftRevisionStatusEvent {
    const commandResult = transitionCommandSchema.safeParse(rawCommand);
    if (!commandResult.success) {
      throw new DraftRevisionServiceError('INVALID_COMMAND', commandResult.error.message);
    }
    const command = commandResult.data;

    const existingEvent = this.revisions.findEventById(command.eventId);
    if (existingEvent !== undefined) {
      if (existingEvent.kind === 'DRAFT_STATUS_TRANSITIONED'
        && existingEvent.draftId === command.draftId
        && existingEvent.revision === command.revision
        && existingEvent.toStatus === command.toStatus
        && traceEquals(existingEvent.trace, command.trace)) return existingEvent;
      throw new DraftRevisionServiceError('IDEMPOTENCY_CONFLICT', 'eventId was already used for a different event');
    }

    const revision = this.revisions.findRevisionByDraftIdAndNumber(command.draftId, command.revision);
    if (revision === undefined) {
      throw new DraftRevisionServiceError('REVISION_NOT_FOUND', 'Draft revision was not found');
    }
    const currentStatus = this.revisions.getCurrentStatus(command.draftId, command.revision) ?? revision.initialStatus;
    if (!canTransitionDraft(currentStatus, command.toStatus, {})) {
      throw new DraftRevisionServiceError(
        'ILLEGAL_STATUS_TRANSITION',
        'Draft status transition ' + currentStatus + ' -> ' + command.toStatus + ' lacks trusted transition evidence or is not allowed',
      );
    }
    const event = {
      kind: 'DRAFT_STATUS_TRANSITIONED' as const,
      draftId: command.draftId,
      revision: command.revision,
      fromStatus: currentStatus,
      toStatus: command.toStatus,
      eventId: command.eventId,
      trace: command.trace,
    };
    const eventResult = draftRevisionEventSchema.safeParse(event);
    if (!eventResult.success || eventResult.data.kind !== 'DRAFT_STATUS_TRANSITIONED') {
      throw invalidSource('DraftRevisionStatusEvent', eventResult.success ? 'unexpected event type' : eventResult.error.message);
    }
    const appended = this.revisions.appendEvent(eventResult.data);
    const parsed = draftRevisionEventSchema.safeParse(appended);
    if (!parsed.success || parsed.data.kind !== 'DRAFT_STATUS_TRANSITIONED') {
      throw new DraftRevisionServiceError('STORAGE_CONFLICT', 'Repository returned an invalid status event');
    }
    return parsed.data;
  }
}
