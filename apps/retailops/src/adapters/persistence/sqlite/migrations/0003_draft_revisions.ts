import type Database from 'better-sqlite3';
import type { RetailOpsMigration } from './0001_initial.js';

/**
 * Stores immutable, content-addressed Draft revisions and append-only trace
 * events in the application schema. Status events record only transitions
 * accepted by the repository's domain guard; this migration grants no approval
 * or execution authority.
 */
export const draftRevisionMigration: RetailOpsMigration = {
  version: 3,
  name: 'draft-revision-append-only-storage',
  up(database: Database.Database) {
    database.exec([
      'CREATE TABLE draft_revisions (',
      '  draft_id TEXT NOT NULL,',
      '  revision INTEGER NOT NULL CHECK (revision > 0),',
      "  contract_version TEXT NOT NULL CHECK (contract_version = '0.3.0'),",
      "  canonicalization_version TEXT NOT NULL CHECK (canonicalization_version = 'retail-draft-canonical-json-v1'),",
      "  canonical_digest TEXT NOT NULL CHECK (length(canonical_digest) = 71 AND substr(canonical_digest, 1, 7) = 'sha256:' AND substr(canonical_digest, 8) NOT GLOB '*[^0-9a-f]*'),",
      "  initial_status TEXT NOT NULL CHECK (initial_status = 'DRAFTED'),",
      '  payload TEXT NOT NULL CHECK (json_valid(payload)),',
      '  PRIMARY KEY (draft_id, revision)',
      ');',
      'CREATE INDEX idx_draft_revisions_latest ON draft_revisions(draft_id, revision DESC);',
      'CREATE TABLE draft_revision_events (',
      '  sequence INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  event_id TEXT NOT NULL UNIQUE,',
      '  draft_id TEXT NOT NULL,',
      '  revision INTEGER NOT NULL,',
      "  kind TEXT NOT NULL CHECK (kind IN ('DRAFT_REVISION_CREATED', 'DRAFT_STATUS_TRANSITIONED')),",
      '  payload TEXT NOT NULL CHECK (json_valid(payload)),',
      '  FOREIGN KEY (draft_id, revision) REFERENCES draft_revisions(draft_id, revision) ON DELETE RESTRICT',
      ');',
      'CREATE INDEX idx_draft_revision_events_order ON draft_revision_events(draft_id, revision, sequence);',
      "CREATE TRIGGER draft_revisions_immutable_update BEFORE UPDATE ON draft_revisions BEGIN SELECT RAISE(ABORT, 'frozen draft revision is immutable'); END;",
      "CREATE TRIGGER draft_revisions_immutable_delete BEFORE DELETE ON draft_revisions BEGIN SELECT RAISE(ABORT, 'frozen draft revision is immutable'); END;",
      "CREATE TRIGGER draft_revision_events_immutable_update BEFORE UPDATE ON draft_revision_events BEGIN SELECT RAISE(ABORT, 'draft revision events are append-only'); END;",
      "CREATE TRIGGER draft_revision_events_immutable_delete BEFORE DELETE ON draft_revision_events BEGIN SELECT RAISE(ABORT, 'draft revision events are append-only'); END;",
    ].join('\n'));
  },
};
