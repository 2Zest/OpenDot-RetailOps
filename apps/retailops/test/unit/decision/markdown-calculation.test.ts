import { describe, expect, it } from 'vitest';
import { calculateMarkdownCandidates } from '../../../src/domain/index.js';

const source = {
  sourceKind: 'SIMULATED',
  reference: 'fixture-source',
  evidenceIds: ['fixture-evidence'],
  methodVersion: 'fixture-method-v1',
};
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
    policy: { contractVersion: '0.3.0', id: 'fixture-policy', revision: 'fixture-r1', evidenceIds: ['fixture-policy-evidence'] },
    basePrice: { value: money('700'), source },
    unitCost: { value: money('500'), source },
    discountPolicy: { maximumDiscount: money('100'), minimumPrice: money('600'), source },
    marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('100'), source } },
    discountList: {
      version: 'fixture-discounts-v1', source,
      candidates: [
        { discountAmount: money('100'), demandQty: quantity('8'), lossQty: quantity('1'), demandSource: source, lossSource: source },
        { discountAmount: money('50'), demandQty: quantity('5'), lossQty: quantity('1'), demandSource: source, lossSource: source },
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
    expect(calculateMarkdownCandidates(fixture({ asOf: { basis: 'DATE_ONLY', value: '2026-12-31', timeZone: 'UTC' } })).reasonCodes).toContain('SELLABILITY_UNRESOLVED');
    expect(calculateMarkdownCandidates(fixture({ asOf: { basis: 'DATE_ONLY', value: '2027-01-01', timeZone: 'UTC' } })).reasonCodes).toContain('SELLABILITY_BLOCKED');
    const noStock = { ...fixture().batch, stockBalance: { physicalOnHand: quantity('0'), unavailable: quantity('0'), availableToSell: quantity('0'), reserved: quantity('0') } };
    expect(calculateMarkdownCandidates(fixture({ batch: noStock })).reasonCodes).toContain('ZERO_SELLABLE_STOCK');
  });

  it('rejects discount, minimum-price, margin, and negative-price violations', () => {
    const result = calculateMarkdownCandidates(fixture({
      discountList: { ...fixture().discountList, candidates: [
        { discountAmount: money('750'), demandQty: quantity('1'), lossQty: quantity('0'), demandSource: source, lossSource: source },
        { discountAmount: money('50'), demandQty: quantity('1'), lossQty: quantity('0'), demandSource: source, lossSource: source },
      ] },
      discountPolicy: { maximumDiscount: money('100'), minimumPrice: money('680'), source },
      marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('200'), source } },
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
        { discountAmount: money('50'), demandQty: quantity('9'), lossQty: quantity('2'), demandSource: source, lossSource: source },
      ] },
    }));
    expect(result.candidates[0]?.reasonCodes).toContain('LOSS_EXCEEDS_REMAINDER');
    expect(result.candidates[0]?.status).toBe('REJECTED');
  });

  it('fails closed for zero-revenue margin rates and mismatched quantity units', () => {
    const marginRate = { kind: 'MIN_GROSS_MARGIN_RATE', numerator: '1', denominator: '5', source };
    const zeroDemand = { ...fixture().discountList, candidates: [
      { discountAmount: money('50'), demandQty: quantity('0'), lossQty: quantity('0'), demandSource: source, lossSource: source },
    ] };
    const zeroResult = calculateMarkdownCandidates(fixture({ marginConstraint: marginRate, discountList: zeroDemand }));
    expect(zeroResult.candidates[0]?.reasonCodes).toContain('MARGIN_UNDEFINED_REVENUE_ZERO');
    const wrongUnit = { ...fixture().discountList, candidates: [
      { discountAmount: money('50'), demandQty: { value: '1', unitCode: 'CASE' }, lossQty: quantity('0'), demandSource: source, lossSource: source },
    ] };
    const unitResult = calculateMarkdownCandidates(fixture({ discountList: wrongUnit }));
    expect(unitResult.candidates[0]?.reasonCodes).toContain('UNIT_MISMATCH');
  });

  it('uses exact explicit margin constraints and keeps repeated input deterministic', () => {
    const marginRate = { kind: 'MIN_GROSS_MARGIN_RATE', numerator: '1', denominator: '10', source };
    const input = fixture({ marginConstraint: marginRate });
    expect(calculateMarkdownCandidates(input)).toEqual(calculateMarkdownCandidates(input));
    expect(calculateMarkdownCandidates(input).candidates.every((candidate) => candidate.status === 'CALCULATED')).toBe(true);
    const stricter = fixture({ marginConstraint: { ...marginRate, numerator: '1', denominator: '2' } });
    expect(calculateMarkdownCandidates(stricter).candidates[0]?.reasonCodes).toContain('MARGIN_BELOW_MINIMUM');
  });
});
