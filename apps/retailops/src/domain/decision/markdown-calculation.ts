import { z } from 'zod';
import { batchSchema } from '../inventory/batch.js';
import { assessSellability, asOfSchema } from '../expiry/expiry.js';
import { contractVersionSchema, decimalScale, decimalToScaledInteger, moneySchema, opaqueReferenceSchema, quantitySchema } from '../shared/primitives.js';
import { policySchema } from '../policy/policy.js';

export const MARKDOWN_FORMULA_VERSION = 'retailops.markdown-calculation/0.1.0-proposal' as const;
const formulaVersionSchema = z.literal(MARKDOWN_FORMULA_VERSION);

export const calculationSourceSchema = z.object({
  sourceKind: z.enum(['PUBLIC_HISTORICAL', 'SIMULATED', 'DERIVED']),
  reference: opaqueReferenceSchema,
  evidenceIds: z.array(opaqueReferenceSchema).min(1),
  methodVersion: opaqueReferenceSchema.optional(),
}).strict().superRefine((source, context) => {
  if (source.sourceKind === 'DERIVED' && source.methodVersion === undefined) {
    context.addIssue({ code: 'custom', path: ['methodVersion'], message: 'Derived values require an explicit method version' });
  }
});
export type CalculationSource = z.infer<typeof calculationSourceSchema>;

const nonNegativeMoneySchema = moneySchema.superRefine((money, context) => {
  if (BigInt(money.minorUnits) < 0n) {
    context.addIssue({ code: 'custom', path: ['minorUnits'], message: 'This calculation input must be non-negative' });
  }
});
const sourcedMoneySchema = z.object({ value: nonNegativeMoneySchema, source: calculationSourceSchema }).strict();
const sourcedSignedMoneySchema = z.object({ value: moneySchema, source: calculationSourceSchema }).strict();
const positiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/, 'Use a positive integer string');
const signedIntegerStringSchema = z.string().regex(/^(?:0|-?[1-9]\d*)$/, 'Use a signed integer string');

export const markdownMarginConstraintSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('MIN_CONTRIBUTION_PER_UNIT'), minimumContribution: sourcedSignedMoneySchema }).strict(),
  z.object({
    kind: z.literal('MIN_GROSS_MARGIN_RATE'),
    numerator: signedIntegerStringSchema,
    denominator: positiveIntegerStringSchema,
    source: calculationSourceSchema,
  }).strict(),
]);

const markdownCandidateInputSchema = z.object({
  discountAmount: nonNegativeMoneySchema,
  demandQty: quantitySchema,
  lossQty: quantitySchema,
  demandSource: calculationSourceSchema,
  lossSource: calculationSourceSchema,
}).strict().superRefine((candidate, context) => {
  if (BigInt(candidate.discountAmount.minorUnits) <= 0n) {
    context.addIssue({ code: 'custom', path: ['discountAmount', 'minorUnits'], message: 'A markdown candidate must have a positive explicit discount' });
  }
});

export const markdownCalculationInputSchema = z.object({
  contractVersion: contractVersionSchema,
  formulaVersion: formulaVersionSchema,
  batch: batchSchema,
  asOf: asOfSchema,
  policy: policySchema,
  basePrice: sourcedMoneySchema,
  unitCost: sourcedMoneySchema,
  discountPolicy: z.object({
    maximumDiscount: nonNegativeMoneySchema,
    minimumPrice: nonNegativeMoneySchema,
    source: calculationSourceSchema,
  }).strict(),
  marginConstraint: markdownMarginConstraintSchema,
  discountList: z.object({
    version: opaqueReferenceSchema,
    source: calculationSourceSchema,
    candidates: z.array(markdownCandidateInputSchema).min(1),
  }).strict(),
}).strict();
export type MarkdownCalculationInput = z.infer<typeof markdownCalculationInputSchema>;

export const markdownCalculationReasonSchema = z.enum([
  'INPUT_INVALID',
  'DUPLICATE_DISCOUNT',
  'NO_FEASIBLE_CANDIDATE',
  'QUALITY_NOT_PASS',
  'SELLABILITY_BLOCKED',
  'SELLABILITY_UNRESOLVED',
  'ZERO_SELLABLE_STOCK',
  'CURRENCY_MISMATCH',
  'UNIT_MISMATCH',
  'DISCOUNT_ABOVE_MAXIMUM',
  'BELOW_MINIMUM_PRICE',
  'NEGATIVE_CANDIDATE_PRICE',
  'DISCOUNT_NOT_POSITIVE',
  'LOSS_EXCEEDS_REMAINDER',
  'MARGIN_BELOW_MINIMUM',
  'MARGIN_UNDEFINED_REVENUE_ZERO',
]);
export type MarkdownCalculationReason = z.infer<typeof markdownCalculationReasonSchema>;

const markdownCandidateResultSchema = z.object({
  discountAmount: moneySchema,
  proposedPrice: moneySchema.nullable(),
  status: z.enum(['CALCULATED', 'REJECTED']),
  hardRulesPassed: z.boolean(),
  reasonCodes: z.array(markdownCalculationReasonSchema),
}).strict();

export const markdownCalculationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  formulaVersion: formulaVersionSchema,
  status: z.enum(['CALCULATED', 'REJECTED', 'NOT_COMPUTABLE']),
  businessApproval: z.literal('REQUIRED'),
  executionAuthority: z.literal('NONE'),
  reasonCodes: z.array(markdownCalculationReasonSchema),
  candidates: z.array(markdownCandidateResultSchema),
}).strict();
export type MarkdownCalculationResult = z.infer<typeof markdownCalculationResultSchema>;

export function calculateMarkdownCandidates(input: unknown): MarkdownCalculationResult {
  const parsed = markdownCalculationInputSchema.safeParse(input);
  if (!parsed.success) return makeResult('NOT_COMPUTABLE', ['INPUT_INVALID'], []);
  const data = parsed.data;

  if (hasDuplicateDiscounts(data)) {
    const candidates = data.discountList.candidates.map((candidate) => candidateResult(candidate.discountAmount, null, ['DUPLICATE_DISCOUNT']));
    return makeResult('REJECTED', ['DUPLICATE_DISCOUNT'], candidates);
  }

  const globalReasons: MarkdownCalculationReason[] = [];
  if (data.batch.qualityStatus !== 'PASS') globalReasons.push('QUALITY_NOT_PASS');
  const sellability = assessSellability({ expiry: data.batch.expiry, asOf: data.asOf, qualityStatus: data.batch.qualityStatus });
  if (sellability.status === 'BLOCKED') globalReasons.push('SELLABILITY_BLOCKED');
  if (sellability.status === 'UNRESOLVED') globalReasons.push('SELLABILITY_UNRESOLVED');
  if (decimalToScaledInteger(data.batch.stockBalance.availableToSell.value, decimalScale(data.batch.stockBalance.availableToSell.value)) <= 0n) {
    globalReasons.push('ZERO_SELLABLE_STOCK');
  }
  const currencyCodes = allMoney(data).map((value) => value.currencyCode);
  if (new Set(currencyCodes).size !== 1) globalReasons.push('CURRENCY_MISMATCH');
  if (globalReasons.length > 0) {
    const candidates = data.discountList.candidates.map((candidate) => candidateResult(candidate.discountAmount, null, globalReasons));
    return makeResult('REJECTED', globalReasons, candidates);
  }

  const results = data.discountList.candidates
    .slice()
    .sort((left, right) => compareMoney(left.discountAmount, right.discountAmount))
    .map((candidate) => evaluateCandidate(data, candidate));
  const hasFeasible = results.some((candidate) => candidate.status === 'CALCULATED');
  const reasons = uniqueReasons(results.flatMap((candidate) => candidate.reasonCodes));
  if (!hasFeasible) reasons.push('NO_FEASIBLE_CANDIDATE');
  return makeResult(hasFeasible ? 'CALCULATED' : 'REJECTED', reasons, results);
}

function evaluateCandidate(
  input: MarkdownCalculationInput,
  candidate: MarkdownCalculationInput['discountList']['candidates'][number],
): MarkdownCalculationResult['candidates'][number] {
  const reasons: MarkdownCalculationReason[] = [];
  const unitCode = input.batch.stockBalance.availableToSell.unitCode;
  if (candidate.demandQty.unitCode !== unitCode || candidate.lossQty.unitCode !== unitCode) reasons.push('UNIT_MISMATCH');

  const moneyScale = Math.max(...allMoney(input).map((money) => money.minorUnitScale));
  const basePrice = atScale(input.basePrice.value, moneyScale);
  const discount = atScale(candidate.discountAmount, moneyScale);
  const cost = atScale(input.unitCost.value, moneyScale);
  const proposedMinor = basePrice - discount;
  const proposedPrice = proposedMinor < 0n ? null : asMoney(proposedMinor, input.basePrice.value.currencyCode, moneyScale);
  const maximumDiscount = atScale(input.discountPolicy.maximumDiscount, moneyScale);
  const minimumPrice = atScale(input.discountPolicy.minimumPrice, moneyScale);
  if (discount <= 0n) reasons.push('DISCOUNT_NOT_POSITIVE');
  if (discount > maximumDiscount) reasons.push('DISCOUNT_ABOVE_MAXIMUM');
  if (proposedMinor < 0n) reasons.push('NEGATIVE_CANDIDATE_PRICE');
  if (proposedMinor >= 0n && proposedMinor < minimumPrice) reasons.push('BELOW_MINIMUM_PRICE');

  const quantityScale = Math.max(
    decimalScale(input.batch.stockBalance.availableToSell.value),
    decimalScale(candidate.demandQty.value),
    decimalScale(candidate.lossQty.value),
  );
  const openingQty = decimalToScaledInteger(input.batch.stockBalance.availableToSell.value, quantityScale);
  const demandQty = decimalToScaledInteger(candidate.demandQty.value, quantityScale);
  const lossQty = decimalToScaledInteger(candidate.lossQty.value, quantityScale);
  const soldQty = openingQty < demandQty ? openingQty : demandQty;
  const remainingAfterSales = openingQty - soldQty;
  if (lossQty > remainingAfterSales) reasons.push('LOSS_EXCEEDS_REMAINDER');

  if (proposedMinor >= 0n) {
    if (input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT') {
      const threshold = atScale(input.marginConstraint.minimumContribution.value, moneyScale);
      if (proposedMinor - cost < threshold) reasons.push('MARGIN_BELOW_MINIMUM');
    } else if (soldQty === 0n || proposedMinor === 0n) {
      reasons.push('MARGIN_UNDEFINED_REVENUE_ZERO');
    } else {
      const contribution = proposedMinor - cost;
      if (contribution * BigInt(input.marginConstraint.denominator)
        < proposedMinor * BigInt(input.marginConstraint.numerator)) reasons.push('MARGIN_BELOW_MINIMUM');
    }
  }

  return candidateResult(candidate.discountAmount, proposedPrice, uniqueReasons(reasons));
}

function candidateResult(
  discountAmount: MarkdownCalculationResult['candidates'][number]['discountAmount'],
  proposedPrice: MarkdownCalculationResult['candidates'][number]['proposedPrice'],
  reasonCodes: readonly MarkdownCalculationReason[],
): MarkdownCalculationResult['candidates'][number] {
  const hardRulesPassed = reasonCodes.length === 0;
  return {
    discountAmount,
    proposedPrice,
    status: hardRulesPassed ? 'CALCULATED' : 'REJECTED',
    hardRulesPassed,
    reasonCodes: [...reasonCodes],
  };
}

function makeResult(
  status: MarkdownCalculationResult['status'],
  reasonCodes: readonly MarkdownCalculationReason[],
  candidates: MarkdownCalculationResult['candidates'],
): MarkdownCalculationResult {
  return markdownCalculationResultSchema.parse({
    contractVersion: '0.3.0',
    formulaVersion: MARKDOWN_FORMULA_VERSION,
    status,
    businessApproval: 'REQUIRED',
    executionAuthority: 'NONE',
    reasonCodes: [...reasonCodes],
    candidates,
  });
}

function hasDuplicateDiscounts(input: MarkdownCalculationInput): boolean {
  const values = input.discountList.candidates.map((candidate) => candidate.discountAmount);
  const scale = Math.max(...values.map((value) => value.minorUnitScale));
  const normalized = values.map((value) => `${value.currencyCode}:${atScale(value, scale).toString()}`);
  return new Set(normalized).size !== normalized.length;
}

function allMoney(input: MarkdownCalculationInput): MarkdownCalculationInput['basePrice']['value'][] {
  const listMoney = input.discountList.candidates.flatMap((candidate) => [candidate.discountAmount]);
  const marginMoney = input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
    ? [input.marginConstraint.minimumContribution.value]
    : [];
  return [
    input.basePrice.value,
    input.unitCost.value,
    input.discountPolicy.maximumDiscount,
    input.discountPolicy.minimumPrice,
    ...marginMoney,
    ...listMoney,
  ];
}

function compareMoney(left: z.infer<typeof moneySchema>, right: z.infer<typeof moneySchema>): number {
  const scale = Math.max(left.minorUnitScale, right.minorUnitScale);
  const l = atScale(left, scale);
  const r = atScale(right, scale);
  return l < r ? -1 : l > r ? 1 : 0;
}

function atScale(money: z.infer<typeof moneySchema>, targetScale: number): bigint {
  return BigInt(money.minorUnits) * 10n ** BigInt(targetScale - money.minorUnitScale);
}

function asMoney(minorUnits: bigint, currencyCode: string, minorUnitScale: number): z.infer<typeof moneySchema> {
  return { minorUnits: minorUnits.toString(), currencyCode, minorUnitScale };
}

function uniqueReasons(reasons: readonly MarkdownCalculationReason[]): MarkdownCalculationReason[] {
  return [...new Set(reasons)];
}
