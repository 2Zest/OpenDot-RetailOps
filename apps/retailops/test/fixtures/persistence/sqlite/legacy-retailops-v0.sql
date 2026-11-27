-- SYNTHETIC TEST FIXTURE ONLY.
-- This is a constructed schema used to exercise upgrade code; it is not a recovered or real legacy RetailOps database.
CREATE TABLE retailops_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
INSERT INTO retailops_schema_migrations(version, name, applied_at)
VALUES (0, 'synthetic-v0-record-envelope', '2026-11-27T00:00:00.000Z');

CREATE TABLE legacy_records (
  aggregate_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (aggregate_type, entity_id)
);
INSERT INTO legacy_records(aggregate_type, entity_id, payload) VALUES
('EVIDENCE', 'evidence-synthetic-01', '{"contractVersion":"0.3.0","id":"evidence-synthetic-01","snapshotId":"snapshot-synthetic-01","locator":"fixture://synthetic/01","observedAt":"2026-11-27T00:00:00Z","sourceKind":"SIMULATED","scenarioId":"scenario-synthetic-01","seed":"seed-01","generatorVersion":"fixture-0"}'),
('PRODUCT', 'product-synthetic-01', '{"contractVersion":"0.3.0","id":"product-synthetic-01","baseUnitCode":"each","evidenceIds":["evidence-synthetic-01"]}'),
('POLICY', 'policy-synthetic-01', '{"contractVersion":"0.3.0","id":"policy-synthetic-01","revision":"revision-synthetic-01","evidenceIds":["evidence-synthetic-01"]}'),
('BATCH', 'batch-synthetic-01', '{"contractVersion":"0.3.0","id":"batch-synthetic-01","productId":"product-synthetic-01","expiry":{"basis":"DATE_ONLY","value":"2026-11-30","timeZone":"Asia/Shanghai"},"qualityStatus":"PASS","stockBalance":{"physicalOnHand":{"value":"10.0000000000001","unitCode":"each"},"unavailable":{"value":"0","unitCode":"each"},"availableToSell":{"value":"10.0000000000001","unitCode":"each"},"reserved":{"value":"0","unitCode":"each"}},"evidenceIds":["evidence-synthetic-01"]}'),
('DRAFT', 'draft-synthetic-01', '{"contractVersion":"0.3.0","id":"draft-synthetic-01","draftDigest":"sha256:synthetic-draft","status":"DRAFTED","inputSnapshot":{"id":"snapshot-synthetic-01","productIds":["product-synthetic-01"],"batchIds":["batch-synthetic-01"],"evidenceIds":["evidence-synthetic-01"],"policyId":"policy-synthetic-01","policyRevision":"revision-synthetic-01"},"operationIds":["operation-synthetic-01"]}'),
('OPERATION', 'operation-synthetic-01', '{"contractVersion":"0.3.0","id":"operation-synthetic-01","draftId":"draft-synthetic-01","productId":"product-synthetic-01","batchId":"batch-synthetic-01","quantity":{"value":"1.000000000000000001","unitCode":"each"},"status":"PROPOSED","evidenceIds":["evidence-synthetic-01"],"kind":"DISPOSAL_PROPOSAL","reasonCode":"fixture-reason"}');
