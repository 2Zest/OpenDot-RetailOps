import { calculateMarkdownCandidates } from '../../../src/domain/decision/markdown-calculation.js';
import { SINGLE_SKU_SIMULATOR_VERSION } from '../../../src/domain/simulation/simulator.js';

const scenarioId = 'fixture-simulation-scenario';
const scenarioVersion = 'fixture-scenario-v1';
const productId = 'fixture-product';
const batchId = 'fixture-batch';
const policyId = 'fixture-policy';
const policyRevision = 'fixture-policy-r1';
const unitCode = 'EA';
const currencyCode = 'CNY';

const source = (reference: string) => ({
  sourceKind: 'SIMULATED' as const,
  reference,
  scenarioId,
  scenarioVersion,
});

const money = (minorUnits: string, minorUnitScale = 2) => ({ minorUnits, currencyCode, minorUnitScale });
const quantity = (value: string) => ({ value, unitCode });

export function singleSkuScenarioFixture() {
  const product = {
    contractVersion: '0.3.0',
    id: productId,
    baseUnitCode: unitCode,
    evidenceIds: ['fixture-product-evidence'],
  };
  const batch = {
    contractVersion: '0.3.0',
    id: batchId,
    productId,
    expiry: { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' },
    qualityStatus: 'PASS',
    stockBalance: {
      physicalOnHand: quantity('10'),
      unavailable: quantity('0'),
      availableToSell: quantity('10'),
      reserved: quantity('0'),
    },
    evidenceIds: ['fixture-batch-evidence'],
  };
  const policy = {
    contractVersion: '0.3.0',
    id: policyId,
    revision: policyRevision,
    evidenceIds: ['fixture-policy-evidence'],
  };
  const scenarioSource = source('fixture-scenario');
  const base = {
    contractVersion: '0.3.0',
    simulatorVersion: SINGLE_SKU_SIMULATOR_VERSION,
    scenario: {
      id: scenarioId,
      version: scenarioVersion,
      seed: 17,
      clock: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
      horizon: {
        start: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
        end: { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' },
      },
      source: scenarioSource,
    },
    product,
    batch,
    policy,
    initialStockSource: source('fixture-opening-stock'),
    initialPrice: { value: money('700'), source: source('fixture-opening-price') },
    unitCost: { value: money('500'), source: source('fixture-unit-cost') },
    events: [] as Array<Record<string, unknown>>,
  };
  return { ...base };
}

export function validMarkdownCandidate() {
  const fixture = singleSkuScenarioFixture();
  const policySource = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'POLICY_RULE',
    reference: 'fixture-policy-rule',
    evidenceIds: ['fixture-policy-rule-evidence'],
    policyId,
    policyRevision,
  };
  const countSource = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'UNIT_COUNT',
    reference: 'fixture-demand-input',
    evidenceIds: ['fixture-demand-evidence'],
    unitCode,
    scenarioId,
    scenarioVersion,
  };
  const scenarioEvidence = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'SCENARIO',
    reference: 'fixture-candidate-scenario',
    evidenceIds: ['fixture-candidate-scenario-evidence'],
    scenarioId,
    scenarioVersion,
  };
  const batchSnapshotEvidence = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'BATCH_SNAPSHOT',
    reference: 'fixture-batch-snapshot',
    evidenceIds: ['fixture-batch-snapshot-evidence'],
  };
  const unitPriceSource = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'UNIT_PRICE',
    reference: 'fixture-base-price',
    evidenceIds: ['fixture-base-price-evidence'],
    unitCode,
  };
  const unitCostSource = {
    sourceKind: 'SIMULATED',
    dataMeaning: 'UNIT_COST',
    reference: 'fixture-cost',
    evidenceIds: ['fixture-cost-evidence'],
    unitCode,
  };
  const calculationInput = {
    contractVersion: '0.3.0',
    formulaVersion: 'retailops.markdown-calculation/0.1.0-proposal',
    batch: fixture.batch,
    asOf: fixture.scenario.clock,
    scenario: {
      id: scenarioId,
      version: scenarioVersion,
      source: scenarioEvidence,
      observedWindow: {
        start: { basis: 'DATE_ONLY', value: '2026-11-01', timeZone: 'UTC' },
        end: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
      },
      simulationWindow: {
        start: { basis: 'DATE_ONLY', value: '2026-11-28', timeZone: 'UTC' },
        end: { basis: 'DATE_ONLY', value: '2026-12-30', timeZone: 'UTC' },
      },
    },
    policy: fixture.policy,
    inputSnapshot: {
      id: 'fixture-markdown-snapshot',
      capturedAt: '2026-11-27T12:00:00Z',
      asOf: fixture.scenario.clock,
      scenarioId,
      scenarioVersion,
      batchId,
      batchEvidenceIds: ['fixture-batch-evidence'],
      policyId,
      policyRevision,
      policyEvidenceIds: ['fixture-policy-evidence'],
      evidenceIds: ['fixture-snapshot-evidence'],
      source: batchSnapshotEvidence,
    },
    basePrice: { value: money('700'), source: unitPriceSource },
    unitCost: { value: money('500'), source: unitCostSource },
    discountPolicy: {
      policyId,
      policyRevision,
      maximumDiscount: money('100'),
      minimumPrice: money('600'),
      source: policySource,
    },
    marginConstraint: {
      kind: 'MIN_CONTRIBUTION_PER_UNIT',
      minimumContribution: { value: money('100'), source: policySource },
    },
    discountList: {
      version: 'fixture-discount-list-v1',
      policyId,
      policyRevision,
      source: policySource,
      candidates: [{
        discountAmount: money('50'),
        demandQty: quantity('1'),
        lossQty: quantity('0'),
        demandAssessment: 'ADEQUATE',
        demandSource: countSource,
        lossSource: countSource,
      }],
    },
  };
  return calculateMarkdownCandidates(calculationInput);
}

export const simulationFixtureReferences = { scenarioId, scenarioVersion, productId, batchId, policyId, policyRevision, unitCode, currencyCode } as const;
