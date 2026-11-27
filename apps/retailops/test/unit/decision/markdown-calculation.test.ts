import { describe, expect, it } from 'vitest';
import { calculateMarkdownCandidates } from '../../../src/domain/index.js';

const source = (dataMeaning: string, bindings: Record<string, unknown> = {}) => ({
  sourceKind: 'SIMULATED', dataMeaning, reference: `fixture-${dataMeaning}`,
  evidenceIds: [`fixture-${dataMeaning}-evidence`], methodVersion: 'fixture-method-v1', ...bindings,
});
const pricingSource = source('UNIT_PRICE', { unitCode: 'EA' });
const costSource = source('UNIT_COST', { unitCode: 'EA' });
const policySource = source('POLICY_RULE', { policyId: 'fixture-policy', policyRevision: 'fixture-r1' });
const scenarioSource = source('SCENARIO', { scenarioId: 'fixture-scenario', scenarioVersion: 'fixture-s1' });
const snapshotSource = source('BATCH_SNAPSHOT');
const countSource = (unitCode = 'EA') => source('UNIT_COUNT', { unitCode, scenarioId: 'fixture-scenario', scenarioVersion: 'fixture-s1' });
const money = (minorUnits: string) => ({ minorUnits, currencyCode: 'CNY', minorUnitScale: 2 });
const quantity = (value: string) => ({ value, unitCode: 'EA' });

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: '0.3.0',
    formulaVersion: 'retailops.markdown-calculation/0.1.0-proposal',
    batch: {
      contractVersion: '0.3.0', id: 'fixture-batch', productId: 'fixture-product',
      expiry: { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' },
      qualityStatus: 'PASS', evidenceIds: ['fixture-batch-evidence'],
      stockBalance: {
        physicalOnHand: quantity('10'), unavailable: quantity('0'),
        availableToSell: quantity('10'), reserved: quantity('0'),
      },
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
    basePrice: { value: money('700'), source: pricingSource },
    unitCost: { value: money('500'), source: costSource },
    discountPolicy: { policyId: 'fixture-policy', policyRevision: 'fixture-r1', maximumDiscount: money('100'), minimumPrice: money('600'), source: policySource },
    marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('100'), source: policySource } },
    discountList: {
      version: 'fixture-discounts-v1', policyId: 'fixture-policy', policyRevision: 'fixture-r1', source: policySource,
      candidates: [
        { discountAmount: money('100'), demandQty: quantity('8'), lossQty: quantity('1'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
        { discountAmount: money('50'), demandQty: quantity('5'), lossQty: quantity('1'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
      ],
    },
    ...overrides,
  };
}

describe('RETAIL-05P deterministic markdown candidate rules', () => {
  it('generates explicit candidates in stable discount order without granting execution authority', () => {
    const result = calculateMarkdownCandidates(fixture());
    expect(result.status).toBe('CALCULATED');
    expect(result.candidates.map((candidate) => candidate.proposedPrice?.minorUnits)).toEqual(['650', '600']);
    expect(result.candidates.every((candidate) => candidate.status === 'CALCULATED')).toBe(true);
    expect(result.businessApproval).toBe('REQUIRED');
    expect(result.executionAuthority).toBe('NONE');
    expect(result.candidates[0]?.discountAmount.minorUnits).toBe('50');
  });

  it('rejects duplicate discounts as an ambiguous explicit list', () => {
    const input = fixture() as ReturnType<typeof fixture> & { discountList: { candidates: unknown[] } };
    const candidates = (input.discountList as { candidates: unknown[] }).candidates;
    const result = calculateMarkdownCandidates({ ...input, discountList: { ...input.discountList, candidates: [...candidates, candidates[1]] } });
    expect(result.status).toBe('REJECTED');
    expect(result.reasonCodes).toContain('DUPLICATE_DISCOUNT');
  });

  it('fails closed when price bounds, source, policy, or candidate inputs are missing or malformed', () => {
    const result = calculateMarkdownCandidates({ ...fixture(), discountPolicy: undefined });
    expect(result.status).toBe('NOT_COMPUTABLE');
    expect(result.reasonCodes).toContain('INPUT_INVALID');
    expect(result.candidates).toHaveLength(0);
    expect(calculateMarkdownCandidates(fixture({ policy: { ...fixture().policy, revision: '' } })).status).toBe('NOT_COMPUTABLE');
  });

  it('blocks quality, expiry, boundary, and zero-stock candidates', () => {
    const zeroStockBatch = {
      ...fixture().batch,
      stockBalance: { physicalOnHand: quantity('0'), unavailable: quantity('0'), availableToSell: quantity('0'), reserved: quantity('0') },
      qualityStatus: 'UNKNOWN',
    };
    expect(calculateMarkdownCandidates(fixture({ batch: zeroStockBatch })).reasonCodes).toContain('QUALITY_NOT_PASS');
    const boundaryAsOf = { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' };
    const boundaryScenario = { ...fixture().scenario, observedWindow: { start: boundaryAsOf, end: boundaryAsOf }, simulationWindow: { start: { basis: 'DATE_ONLY', value: '2027-01-01', timeZone: 'UTC' }, end: { basis: 'DATE_ONLY', value: '2027-01-02', timeZone: 'UTC' } } };
    expect(calculateMarkdownCandidates(fixture({ asOf: boundaryAsOf, scenario: boundaryScenario, inputSnapshot: { ...fixture().inputSnapshot, asOf: boundaryAsOf } })).reasonCodes).toContain('SELLABILITY_UNRESOLVED');
    const expiredAsOf = { basis: 'DATE_ONLY', value: '2027-01-01', timeZone: 'UTC' };
    const expiredScenario = { ...fixture().scenario, observedWindow: { start: boundaryAsOf, end: expiredAsOf }, simulationWindow: { start: { basis: 'DATE_ONLY', value: '2027-01-02', timeZone: 'UTC' }, end: { basis: 'DATE_ONLY', value: '2027-01-03', timeZone: 'UTC' } } };
    expect(calculateMarkdownCandidates(fixture({ asOf: expiredAsOf, scenario: expiredScenario, inputSnapshot: { ...fixture().inputSnapshot, asOf: expiredAsOf } })).reasonCodes).toContain('SELLABILITY_BLOCKED');
    const noStock = { ...fixture().batch, stockBalance: { physicalOnHand: quantity('0'), unavailable: quantity('0'), availableToSell: quantity('0'), reserved: quantity('0') } };
    expect(calculateMarkdownCandidates(fixture({ batch: noStock })).reasonCodes).toContain('ZERO_SELLABLE_STOCK');
  });

  it('rejects discount, minimum-price, margin, and negative-price violations', () => {
    const result = calculateMarkdownCandidates(fixture({
      discountList: { ...fixture().discountList, candidates: [
        { discountAmount: money('750'), demandQty: quantity('1'), lossQty: quantity('0'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
        { discountAmount: money('50'), demandQty: quantity('1'), lossQty: quantity('0'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
      ] },
      discountPolicy: { policyId: 'fixture-policy', policyRevision: 'fixture-r1', maximumDiscount: money('100'), minimumPrice: money('680'), source: policySource },
      marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('200'), source: policySource } },
    }));
    expect(result.candidates[1]?.reasonCodes).toContain('DISCOUNT_ABOVE_MAXIMUM');
    expect(result.candidates[1]?.reasonCodes).toContain('NEGATIVE_CANDIDATE_PRICE');
    expect(result.candidates[0]?.reasonCodes).toContain('BELOW_MINIMUM_PRICE');
    expect(result.candidates[0]?.reasonCodes).toContain('MARGIN_BELOW_MINIMUM');
    expect(result.status).toBe('REJECTED');
    expect(result.reasonCodes).toContain('NO_FEASIBLE_CANDIDATE');
  });

  it('rejects a loss quantity larger than the post-sale remainder', () => {
    const result = calculateMarkdownCandidates(fixture({
      discountList: { ...fixture().discountList, candidates: [
        { discountAmount: money('50'), demandQty: quantity('9'), lossQty: quantity('2'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
      ] },
    }));
    expect(result.candidates[0]?.reasonCodes).toContain('LOSS_EXCEEDS_REMAINDER');
    expect(result.candidates[0]?.status).toBe('REJECTED');
  });

  it('fails closed for zero-revenue margin rates and mismatched quantity units', () => {
    const marginRate = { kind: 'MIN_GROSS_MARGIN_RATE', numerator: '1', denominator: '5', source: policySource };
    const zeroDemand = { ...fixture().discountList, candidates: [
      { discountAmount: money('50'), demandQty: quantity('0'), lossQty: quantity('0'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
    ] };
    const zeroResult = calculateMarkdownCandidates(fixture({ marginConstraint: marginRate, discountList: zeroDemand }));
    expect(zeroResult.candidates[0]?.reasonCodes).toContain('MARGIN_UNDEFINED_REVENUE_ZERO');
    const wrongUnit = { ...fixture().discountList, candidates: [
      { discountAmount: money('50'), demandQty: { value: '1', unitCode: 'CASE' }, lossQty: quantity('0'), demandAssessment: 'ADEQUATE', demandSource: countSource('CASE'), lossSource: countSource() },
    ] };
    const unitResult = calculateMarkdownCandidates(fixture({ discountList: wrongUnit }));
    expect(unitResult.candidates[0]?.reasonCodes).toContain('UNIT_MISMATCH');
  });

  it('uses exact explicit margin constraints and keeps repeated input deterministic', () => {
    const marginRate = { kind: 'MIN_GROSS_MARGIN_RATE', numerator: '1', denominator: '10', source: policySource };
    const input = fixture({ marginConstraint: marginRate });
    expect(calculateMarkdownCandidates(input)).toEqual(calculateMarkdownCandidates(input));
    expect(calculateMarkdownCandidates(input).candidates.every((candidate) => candidate.status === 'CALCULATED')).toBe(true);
    const stricter = fixture({ marginConstraint: { ...marginRate, numerator: '1', denominator: '2' } });
    expect(calculateMarkdownCandidates(stricter).candidates[0]?.reasonCodes).toContain('MARGIN_BELOW_MINIMUM');
  });

  it('returns full exact metrics, provenance, snapshot, and explicit non-KPI limitations', () => {
    const input = fixture({
      basePrice: { value: money('650'), source: pricingSource },
      unitCost: { value: money('700'), source: costSource },
      marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('0'), source: policySource } },
      discountList: { ...fixture().discountList, candidates: [
        { discountAmount: money('25'), demandQty: quantity('2.5'), lossQty: quantity('0.5'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
      ] },
    });
    const result = calculateMarkdownCandidates(input);
    const candidate = result.candidates[0];
    expect(result.status).toBe('REJECTED');
    expect(candidate?.metrics).toMatchObject({
      openingQty: quantity('10'), simulatedDemandQty: quantity('2.5'), simulatedSoldQty: quantity('2.5'),
      remainingAfterSalesQty: quantity('7.5'), reportedLossQty: quantity('0.5'), endingQty: quantity('7'),
      revenue: { minorUnits: '15625', currencyCode: 'CNY', minorUnitScale: 3 },
      directProductCost: { minorUnits: '17500', currencyCode: 'CNY', minorUnitScale: 3 },
      contribution: { minorUnits: '-1875', currencyCode: 'CNY', minorUnitScale: 3 },
      simulatedLossCostExposure: { minorUnits: '3500', currencyCode: 'CNY', minorUnitScale: 3 },
    });
    expect(result.inputSnapshot?.scenario.simulationWindow).toEqual(input.scenario.simulationWindow);
    expect(result.inputSnapshot?.inputSnapshot.id).toBe('fixture-snapshot');
    expect(result.inputSnapshot?.inputSnapshot.asOf).toEqual(input.asOf);
    expect(result.inputSnapshot?.policy).toMatchObject({ id: 'fixture-policy', revision: 'fixture-r1', evidenceIds: ['fixture-policy-evidence'] });
    expect(result.inputSnapshot?.candidateInputs[0]?.demandSource.reference).toBe('fixture-UNIT_COUNT');
    expect(result.inputSnapshot?.candidateInputs[0]?.lossSource.evidenceIds).toEqual(['fixture-UNIT_COUNT-evidence']);
    expect(result.formulas.simulatedLossCostExposure).toContain('not a loss KPI');
    expect(result.claims).toEqual({ finalLossKpi: 'NOT_CLAIMED', realPriceCausality: 'NOT_ESTABLISHED' });
    expect(result.assumptions).toContain('NO_PRICE_ELASTICITY_INFERENCE');
    expect(candidate?.status).toBe('REJECTED');
    expect(candidate?.reasonCodes).toContain('MARGIN_BELOW_MINIMUM');
    expect(result.businessApproval).toBe('REQUIRED');
    expect(result.executionAuthority).toBe('NONE');
  });

  it('keeps metrics available for rejected margin candidates without turning them executable', () => {
    const input = fixture({
      marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('300'), source: policySource } },
      discountList: { ...fixture().discountList, candidates: [
        { discountAmount: money('50'), demandQty: quantity('5'), lossQty: quantity('1'), demandAssessment: 'ADEQUATE', demandSource: countSource(), lossSource: countSource() },
      ] },
    });
    const candidate = calculateMarkdownCandidates(input).candidates[0];
    expect(candidate?.status).toBe('REJECTED');
    expect(candidate?.hardRulesPassed).toBe(false);
    expect(candidate?.reasonCodes).toContain('MARGIN_BELOW_MINIMUM');
    expect(candidate?.metrics?.revenue).toBeDefined();
    expect(candidate?.metrics?.contribution).toBeDefined();
  });
});
