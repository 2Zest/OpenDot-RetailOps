import { describe, expect, it } from 'vitest';
import { markdownCalculationInputSchema, markdownCalculationResultSchema } from '../../../src/domain/index.js';

const source = { sourceKind: 'SIMULATED', reference: 'fixture-source', evidenceIds: ['fixture-evidence'], methodVersion: 'fixture-v1' };
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
  policy: { contractVersion: '0.3.0', id: 'fixture-policy', revision: 'fixture-r1', evidenceIds: ['fixture-policy-evidence'] },
  basePrice: { value: money('700'), source }, unitCost: { value: money('500'), source },
  discountPolicy: { maximumDiscount: money('100'), minimumPrice: money('600'), source },
  marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('100'), source } },
  discountList: { version: 'fixture-list-v1', source, candidates: [{ discountAmount: money('50'), demandQty: quantity, lossQty: { value: '0', unitCode: 'EA' }, demandSource: source, lossSource: source }] },
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
    expect(markdownCalculationInputSchema.safeParse({ ...validInput, marginConstraint: { kind: 'MIN_CONTRIBUTION_PER_UNIT', minimumContribution: { value: money('-100'), source } } }).success).toBe(true);
    const { discountPolicy: _discountPolicy, ...missingBounds } = validInput;
    expect(markdownCalculationInputSchema.safeParse(missingBounds).success).toBe(false);
  });

  it('validates result execution authority and candidate hard-rule evidence fields', () => {
    const result = {
      contractVersion: '0.3.0', formulaVersion: 'retailops.markdown-calculation/0.1.0-proposal', status: 'CALCULATED',
      businessApproval: 'REQUIRED', executionAuthority: 'NONE', reasonCodes: [],
      candidates: [{ discountAmount: money('50'), proposedPrice: money('650'), status: 'CALCULATED', hardRulesPassed: true, reasonCodes: [] }],
    };
    expect(markdownCalculationResultSchema.safeParse(result).success).toBe(true);
    expect(markdownCalculationResultSchema.safeParse({ ...result, executionAuthority: 'AUTHORIZED' }).success).toBe(false);
    expect(markdownCalculationResultSchema.safeParse({ ...result, unexpected: true }).success).toBe(false);
  });
});
