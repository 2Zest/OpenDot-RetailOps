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
('PRODUCT', 'product-synthetic-01', '{"contractVersion":"0.3.0","id":"product-synthetic-01","baseUnitCode":"each","evidenceIds":["evidence-synthetic-01"]}');
