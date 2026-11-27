import { describe, expect, it } from 'vitest';
import { calculateMarkdownCandidates, markdownCalculationInputSchema, markdownCalculationResultSchema } from '../../../src/domain/index.js';

const source = (dataMeaning: string, bindings: Record<string, unknown> = {}) => ({
  sourceKind: 'SIMULATED', dataMeaning, reference: `fixture-${dataMeaning}`,
  evidenceIds: [`fixture-${dataMeaning}-evidence`], methodVersion: 'fixture-v1', ...bindings,
});
const pricingSource = source('UNIT_PRICE', { unitCode: 'EA' });
const costSource = source('UNIT_COST', { unitCode: 'EA' });
const policySource = source('POLICY_RULE', { policyId: 'fixture-policy', policyRevision: 'fixture-r1' });
const scenarioSource = source('SCENARIO', { scenarioId: 'fixture-scenario', scenarioVersion: 'fixture-s1' });
const snapshotSource = source('BATCH_SNAPSHOT');
const countSource = source('UNIT_COUNT', { unitCode: 'EA', scenarioId: 'fixture-scenario', scenarioVersion: 'fixture-s1' });
const money = (minorUnits: string) => ({ minorUnits, currencyCode: 'CNY', minorUnitScale: 2 });
const quantity = { value: '1', unitCode: 'EA' };
const validInput = {
  contractVersion: '0.3.0', formulaVersion: 'retailops.markdown-calculation/0.1.0-proposal',
  batch: {
    contractVersion: '0.3.0', id: 'fixture-batch', productId: 'fixture-product',
    expiry: { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' }, qualityStatus: 'PASS', evidenceIds: ['fixture-batch-evidence'],
    stockBalance: { physicalOnHand: quantity, unavailable: { value: '0', unitCode: 'EA' }, availableToSell: quantity, reserved: { value: '0', unitCode: 'EA' } },
  },
  asOf: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
  scenario: {
    id: 'fixture-scenario', version: 'fixture-s1', source: scenarioSource,
    observedWindow: {
      start: { basis: 'DATE_ONLY', value: '2026-11-01', timeZone: 'UTC' },
      end: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
    },
    simulationWindow: {
      start: { basis: 'DATE_ONLY', value: '2026-11-28', timeZone: 'UTC' },
      end: { basis: 'DATE_ONLY', value: '2026-12-30', timeZone: 'UTC' },
    },
  },
  policy: { contractVersion: '0.3.0', id: 'fixture-policy', revision: 'fixture-r1', evidenceIds: ['fixture-policy-evidence'] },
  inputSnapshot: {
    id: 'fixture-snapshot', capturedAt: '2026-11-27T12:00:00Z', asOf: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' },
    scenarioId: 'fixture-scenario', scenarioVersion: 'fixture-s1', batchId: 'fixture-batch', batchEvidenceIds: ['fixture-batch-evidence'],
    policyId: 'fixture-policy', policyRevision: 'fixture-r1', policyEvidenceIds: ['fixture-policy-evidence'],
    evidenceIds: ['fixture-snapshot-evidence'], source: snapshotSource,
  },
  basePrice: { value: money('700'), source: pricingSource }, unitCost: { value: money('500'), source: costSource },
  discountPolicy: { policyId: 'fixture-policy', policyRevision: 'fixture-r1', maximumDiscount: money('100'), minimumPrice: money('600'), source: policySource },
  marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('100'), source: policySource } },
  discountList: { version: 'fixture-list-v1', policyId: 'fixture-policy', policyRevision: 'fixture-r1', source: policySource, candidates: [{ discountAmount: money('50'), demandQty: quantity, lossQty: { value: '0', unitCode: 'EA' }, demandAssessment: 'ADEQUATE', demandSource: countSource, lossSource: countSource }] },
};

describe('RETAIL-05P candidate schemas', () => {
  it('requires complete v0.3.0 inputs with source-bearing parameter values', () => {
    expect(markdownCalculationInputSchema.safeParse(validInput).success).toBe(true);
    const { unitCost: _unitCost, ...missing } = validInput;
    expect(markdownCalculationInputSchema.safeParse(missing).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, discountList: { ...validInput.discountList, candidates: [] } }).success).toBe(false);
  });

  it('rejects negative prices, invalid provenance, and unknown fields without throwing', () => {
    expect(() => markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { value: money('-1'), source } })).not.toThrow();
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { value: money('-1'), source } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { value: money('1'), source: { ...source, evidenceIds: [] } } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, unexpected: true }).success).toBe(false);
  });

  it('requires valid rational margin constraints and explicit discount bounds', () => {
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, marginConstraint: { kind: 'MIN_GROSS_MARGIN_RATE', numerator: '1', denominator: '0', source } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, marginConstraint: { kind: 'OTHER', source } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('-100'), source: policySource } } }).success).toBe(false);
    const { discountPolicy: _discountPolicy, ...missingBounds } = validInput;
    expect(markdownCalculationInputSchema.safeParse(missingBounds).success).toBe(false);
  });

  it('validates result execution authority and candidate hard-rule evidence fields', () => {
    const result = calculateMarkdownCandidates(validInput);
    expect(markdownCalculationResultSchema.safeParse(result).success).toBe(true);
    expect(markdownCalculationResultSchema.safeParse({ ...result, executionAuthority: 'AUTHORIZED' }).success).toBe(false);
    expect(markdownCalculationResultSchema.safeParse({ ...result, unexpected: true }).success).toBe(false);
    expect(markdownCalculationResultSchema.safeParse({ ...result, status: 'REJECTED' }).success).toBe(false);
    const candidate = result.candidates[0]!;
    expect(markdownCalculationResultSchema.safeParse({ ...result, candidates: [{ ...candidate, hardRulesPassed: false }] }).success).toBe(false);
    expect(markdownCalculationResultSchema.safeParse({ ...result, candidates: [{ ...candidate, proposedPrice: money('649') }] }).success).toBe(false);
    for (const minorUnits of [1, null, '9'.repeat(4096)]) {
      const invalidResult = {
        ...result,
        candidates: [{ ...candidate, metrics: { ...candidate.metrics!, revenue: { ...candidate.metrics!.revenue, minorUnits } } }],
      };
      expect(() => markdownCalculationResultSchema.safeParse(invalidResult)).not.toThrow();
      expect(markdownCalculationResultSchema.safeParse(invalidResult).success).toBe(false);
    }
  });

  it('rejects output whose quantity or exact money metrics disagree with their bound inputs', () => {
    const result = calculateMarkdownCandidates(validInput);
    const candidate = result.candidates[0]!;
    const metrics = candidate.metrics!;
    expect(result.inputSnapshot?.candidateInputs[0]?.demandSource.reference).toBe('fixture-UNIT_COUNT');
    expect(result.inputSnapshot?.candidateInputs[0]?.lossSource.evidenceIds).toEqual(['fixture-UNIT_COUNT-evidence']);
    expect(markdownCalculationResultSchema.safeParse({
      ...result,
      candidates: [{ ...candidate, metrics: { ...metrics, revenue: { ...metrics.revenue, minorUnits: '1' } } }],
    }).success).toBe(false);
    expect(markdownCalculationResultSchema.safeParse({
      ...result,
      candidates: [{ ...candidate, metrics: { ...metrics, simulatedSoldQty: { value: '2', unitCode: 'EA' } } }],
    }).success).toBe(false);
  });

  it('requires an explicit demand assessment and rejects uncertain demand without metrics', () => {
    const candidate = validInput.discountList.candidates[0]!;
    const { demandAssessment: _assessment, ...missingAssessment } = candidate;
    const missing = { ...validInput, discountList: { ...validInput.discountList, candidates: [missingAssessment] } };
    expect(markdownCalculationInputSchema.safeParse(missing).success).toBe(false);

    const uncertain = {
      ...validInput,
      discountList: { ...validInput.discountList, candidates: [{ ...candidate, demandAssessment: 'UNCERTAIN' }] },
    };
    const result = calculateMarkdownCandidates(uncertain);
    expect(result.status).toBe('REJECTED');
    expect(result.candidates[0]?.status).toBe('REJECTED');
    expect(result.candidates[0]?.reasonCodes).toContain('DEMAND_UNCERTAIN');
    expect(result.candidates[0]?.metrics).toBeNull();
  });

  it('bounds technical BigInt input size, decimal scale, and candidate dimensions fail-closed', () => {
    const oversizedMoney = { ...validInput, basePrice: { ...validInput.basePrice, value: money('9'.repeat(129)) } };
    const oversizedScale = { ...validInput, basePrice: { ...validInput.basePrice, value: { ...money('700'), minorUnitScale: 19 } } };
    const huge = '9'.repeat(2048);
    const oversizedWithinTextBudget = '9'.repeat(4096);
    const oversizedCandidateMoney = { ...validInput.discountList.candidates[0], discountAmount: money(oversizedWithinTextBudget) };
    const oversizedCandidate = { ...validInput, discountList: { ...validInput.discountList, candidates: [oversizedCandidateMoney] } };
    const hugeBatch = {
      ...validInput.batch, qualityStatus: 'UNKNOWN',
      stockBalance: { physicalOnHand: { value: huge, unitCode: 'EA' }, unavailable: { value: '0', unitCode: 'EA' }, availableToSell: { value: huge, unitCode: 'EA' }, reserved: { value: '0', unitCode: 'EA' } },
    };
    const tooManyCandidates = { ...validInput.discountList, candidates: Array.from({ length: 129 }, (_, index) => ({
      ...validInput.discountList.candidates[0], discountAmount: money(String(index + 1)),
    })) };
    const invalidInteger = { ...validInput, basePrice: { ...validInput.basePrice, value: money('1e3') } };
    const invalidRuntimeScale = { ...validInput, basePrice: { ...validInput.basePrice, value: { ...money('700'), minorUnitScale: Number.NaN } } };
    for (const invalid of [oversizedMoney, oversizedScale, invalidInteger, invalidRuntimeScale, oversizedCandidate, { ...validInput, batch: hugeBatch }, { ...validInput, discountList: tooManyCandidates }]) {
      expect(() => markdownCalculationInputSchema.safeParse(invalid)).not.toThrow();
      expect(markdownCalculationInputSchema.safeParse(invalid).success).toBe(false);
      expect(calculateMarkdownCandidates(invalid).status).toBe('NOT_COMPUTABLE');
    }
  });

  it('binds sources to value meaning, unit, scenario, and exact policy revision', () => {
    const normalizedPublic = { sourceKind: 'PUBLIC_HISTORICAL', dataMeaning: 'NORMALIZED_INDEX', reference: 'fixture-public-index', evidenceIds: ['fixture-public-evidence'], observedAt: { basis: 'DATE_ONLY', value: '2026-11-20', timeZone: 'UTC' } };
    const historicalPrice = {
      sourceKind: 'PUBLIC_HISTORICAL', dataMeaning: 'UNIT_PRICE', reference: 'fixture-price-history',
      evidenceIds: ['fixture-price-history-evidence'], unitCode: 'EA',
      observedAt: { basis: 'DATE_ONLY', value: '2026-11-20', timeZone: 'UTC' },
    };
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { ...validInput.basePrice, source: historicalPrice } }).success).toBe(true);
    expect(markdownCalculationInputSchema.safeParse({
      ...validInput,
      basePrice: { ...validInput.basePrice, source: { ...historicalPrice, observedAt: { basis: 'DATE_ONLY', value: '2026-11-28', timeZone: 'UTC' } } },
    }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { ...validInput.basePrice, source: normalizedPublic } }).success).toBe(false);
    const publicAsDemand = { ...validInput.discountList.candidates[0], demandSource: normalizedPublic };
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, discountList: { ...validInput.discountList, candidates: [publicAsDemand] } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, discountPolicy: { ...validInput.discountPolicy, policyRevision: 'stale-r0' } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, discountList: { ...validInput.discountList, policyRevision: 'stale-r0' } }).success).toBe(false);
    const staleScenario = { ...validInput.discountList.candidates[0], demandSource: { ...countSource, scenarioVersion: 'stale-s0' } };
    expect(staleScenario.demandSource).toMatchObject({ sourceKind: 'SIMULATED', dataMeaning: 'UNIT_COUNT', scenarioVersion: 'stale-s0' });
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, discountList: { ...validInput.discountList, candidates: [staleScenario] } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, basePrice: { ...validInput.basePrice, source: { ...validInput.basePrice.source, dataMeaning: 'NORMALIZED_INDEX' } } }).success).toBe(false);
  });

  it('checks observed window, future simulation window, asOf, and snapshot consistency', () => {
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, asOf: { basis: 'DATE_ONLY', value: '2026-10-31', timeZone: 'UTC' } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, asOf: { basis: 'DATE_ONLY', value: '2026-12-01', timeZone: 'UTC' } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, scenario: { ...validInput.scenario, simulationWindow: { start: { basis: 'DATE_ONLY', value: '2026-11-27', timeZone: 'UTC' }, end: { basis: 'DATE_ONLY', value: '2026-12-30', timeZone: 'UTC' } } } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, inputSnapshot: { ...validInput.inputSnapshot, asOf: { basis: 'DATE_ONLY', value: '2026-11-26', timeZone: 'UTC' } } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, inputSnapshot: { ...validInput.inputSnapshot, batchId: 'other-batch' } }).success).toBe(false);
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, inputSnapshot: { ...validInput.inputSnapshot, policyRevision: 'stale-r0' } }).success).toBe(false);
  });
});
