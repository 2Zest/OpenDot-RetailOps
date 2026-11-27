import { z } from 'zod';
import { batchSchema } from '../inventory/batch.js';
import { assessSellability, asOfSchema } from '../expiry/expiry.js';
import {
  compareDateOnly, compareInstants, contractVersionSchema, decimalParts, decimalScale,
  decimalToScaledInteger, instantSchema, moneySchema, opaqueReferenceSchema, quantitySchema,
} from '../shared/primitives.js';
import { policySchema } from '../policy/policy.js';

// Technical bounds limit BigInt parsing, exponent expansion and schema traversal.
// atScale can add up to 18 zeroes to each 128-digit input. The maximum exact
// amount-by-quantity product is therefore (128 + 18) + (128 + 18) = 292 digits.
// Output precision is at most 18 money places + 18 quantity places. These are
// resource limits, not business thresholds.
const MAX_DIGITS = 128;
const MAX_SCALE = 18;
const MAX_CANDIDATES = 128;
const MAX_REFS = 256;
const MAX_NODES = 4096;
const MAX_TEXT = 262144;
const MAX_OUTPUT_DIGITS = 2 * (MAX_DIGITS + MAX_SCALE);
const MAX_OUTPUT_QUANTITY_DIGITS = MAX_DIGITS + MAX_SCALE;
const MAX_OUTPUT_SCALE = 36;

export const MARKDOWN_FORMULA_VERSION = 'retailops.markdown-calculation/0.1.0-proposal' as const;
const formulaVersionSchema = z.literal(MARKDOWN_FORMULA_VERSION);
const dataMeaningSchema = z.enum(['UNIT_PRICE', 'UNIT_COST', 'POLICY_RULE', 'SCENARIO', 'BATCH_SNAPSHOT', 'UNIT_COUNT', 'NORMALIZED_INDEX']);

export const calculationSourceSchema = z.object({
  sourceKind: z.enum(['PUBLIC_HISTORICAL', 'DERIVED', 'SIMULATED']),
  dataMeaning: dataMeaningSchema,
  reference: opaqueReferenceSchema,
  evidenceIds: z.array(opaqueReferenceSchema).min(1).max(MAX_REFS),
  unitCode: opaqueReferenceSchema.optional(),
  observedAt: asOfSchema.optional(),
  scenarioId: opaqueReferenceSchema.optional(),
  scenarioVersion: opaqueReferenceSchema.optional(),
  policyId: opaqueReferenceSchema.optional(),
  policyRevision: opaqueReferenceSchema.optional(),
  methodVersion: opaqueReferenceSchema.optional(),
  parentReferences: z.array(opaqueReferenceSchema).min(1).max(MAX_REFS).optional(),
}).strict().superRefine((source, context) => {
  if (source.dataMeaning === 'NORMALIZED_INDEX') {
    context.addIssue({ code: 'custom', path: ['dataMeaning'], message: 'A normalized public index is not an operational quantity, price or cost' });
  }
  if (source.sourceKind === 'PUBLIC_HISTORICAL' && source.observedAt === undefined) {
    context.addIssue({ code: 'custom', path: ['observedAt'], message: 'Historical evidence requires an observation time' });
  }
  if (source.sourceKind !== 'PUBLIC_HISTORICAL' && source.observedAt !== undefined) {
    context.addIssue({ code: 'custom', path: ['observedAt'], message: 'Only historical evidence may carry observedAt' });
  }
  if (source.sourceKind === 'DERIVED' && (source.methodVersion === undefined || source.parentReferences === undefined)) {
    context.addIssue({ code: 'custom', path: ['methodVersion'], message: 'Derived evidence requires a method version and parent references' });
  }
  if (source.dataMeaning === 'SCENARIO' && (source.scenarioId === undefined || source.scenarioVersion === undefined)) {
    context.addIssue({ code: 'custom', path: ['scenarioId'], message: 'Scenario evidence requires an id and version' });
  }
});
export type CalculationSource = z.infer<typeof calculationSourceSchema>;

const integerPattern = /^-?(?:0|[1-9]\d*)$/;
const decimalPattern = /^\d+(?:\.\d+)?$/;
const boundedMoneySchema = moneySchema.superRefine((money, context) => {
  if (typeof money.minorUnits !== 'string' || !integerPattern.test(money.minorUnits)) return;
  if (money.minorUnits.replace('-', '').length > MAX_DIGITS) context.addIssue({ code: 'custom', path: ['minorUnits'], message: 'Money exceeds the technical digit limit' });
  if (money.minorUnitScale > MAX_SCALE) context.addIssue({ code: 'custom', path: ['minorUnitScale'], message: 'Money exceeds the technical scale limit' });
});
const nonNegativeMoneySchema = boundedMoneySchema.superRefine((money, context) => {
  if (typeof money.minorUnits === 'string' && money.minorUnits.length <= MAX_DIGITS
    && money.minorUnitScale <= MAX_SCALE && integerPattern.test(money.minorUnits)
    && BigInt(money.minorUnits) < 0n) {
    context.addIssue({ code: 'custom', path: ['minorUnits'], message: 'This value must be non-negative' });
  }
});
const boundedQuantitySchema = quantitySchema.superRefine((quantity, context) => {
  if (typeof quantity.value !== 'string' || !decimalPattern.test(quantity.value)) return;
  const parts = decimalParts(quantity.value);
  if (parts.whole.length + parts.fraction.length > MAX_DIGITS) context.addIssue({ code: 'custom', path: ['value'], message: 'Quantity exceeds the technical digit limit' });
  if (parts.fraction.length > MAX_SCALE) context.addIssue({ code: 'custom', path: ['value'], message: 'Quantity exceeds the technical scale limit' });
});
const sourcedMoneySchema = z.object({ value: nonNegativeMoneySchema, source: calculationSourceSchema }).strict();
const sourcedThresholdSchema = z.object({ value: nonNegativeMoneySchema, source: calculationSourceSchema }).strict();
const positiveIntegerSchema = z.string().regex(/^[1-9]\d*$/).max(MAX_DIGITS);
const signedIntegerSchema = z.string().regex(/^(?:0|-?[1-9]\d*)$/).max(MAX_DIGITS);

export const markdownMarginConstraintSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('MIN_CONTRIBUTION_PER_UNIT'), minimumContribution: sourcedThresholdSchema }).strict(),
  z.object({ kind: z.literal('MIN_GROSS_MARGIN_RATE'), numerator: signedIntegerSchema, denominator: positiveIntegerSchema, source: calculationSourceSchema }).strict(),
]);

const windowSchema = z.object({ start: asOfSchema, end: asOfSchema }).strict().superRefine((window, context) => {
  if (!sameBasis(window.start, window.end) || compareTemporal(window.start, window.end) > 0) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'Window endpoints must be compatible and ordered' });
  }
});
const scenarioSchema = z.object({
  id: opaqueReferenceSchema, version: opaqueReferenceSchema, source: calculationSourceSchema,
  observedWindow: windowSchema, simulationWindow: windowSchema,
}).strict();
const inputSnapshotSchema = z.object({
  id: opaqueReferenceSchema, capturedAt: instantSchema, asOf: asOfSchema,
  scenarioId: opaqueReferenceSchema, scenarioVersion: opaqueReferenceSchema,
  batchId: opaqueReferenceSchema, batchEvidenceIds: z.array(opaqueReferenceSchema).min(1).max(MAX_REFS),
  policyId: opaqueReferenceSchema, policyRevision: opaqueReferenceSchema, policyEvidenceIds: z.array(opaqueReferenceSchema).min(1).max(MAX_REFS),
  evidenceIds: z.array(opaqueReferenceSchema).min(1).max(MAX_REFS), source: calculationSourceSchema,
}).strict();

const candidateInputSchema = z.object({
  discountAmount: nonNegativeMoneySchema, demandQty: boundedQuantitySchema, lossQty: boundedQuantitySchema,
  demandAssessment: z.enum(['ADEQUATE', 'UNCERTAIN']),
  demandSource: calculationSourceSchema, lossSource: calculationSourceSchema,
}).strict().superRefine((candidate, context) => {
  if (typeof candidate.discountAmount.minorUnits === 'string'
    && candidate.discountAmount.minorUnits.length <= MAX_DIGITS
    && candidate.discountAmount.minorUnitScale <= MAX_SCALE
    && integerPattern.test(candidate.discountAmount.minorUnits)
    && BigInt(candidate.discountAmount.minorUnits) <= 0n) {
    context.addIssue({ code: 'custom', path: ['discountAmount'], message: 'Discount must be explicitly positive' });
  }
});

const inputInnerSchema = z.object({
  contractVersion: contractVersionSchema, formulaVersion: formulaVersionSchema, batch: batchSchema, asOf: asOfSchema,
  scenario: scenarioSchema, policy: policySchema, inputSnapshot: inputSnapshotSchema,
  basePrice: sourcedMoneySchema, unitCost: sourcedMoneySchema,
  discountPolicy: z.object({
    policyId: opaqueReferenceSchema, policyRevision: opaqueReferenceSchema,
    maximumDiscount: nonNegativeMoneySchema, minimumPrice: nonNegativeMoneySchema, source: calculationSourceSchema,
  }).strict(),
  marginConstraint: markdownMarginConstraintSchema,
  discountList: z.object({
    version: opaqueReferenceSchema, policyId: opaqueReferenceSchema, policyRevision: opaqueReferenceSchema,
    source: calculationSourceSchema, candidates: z.array(candidateInputSchema).min(1).max(MAX_CANDIDATES),
  }).strict(),
}).strict().superRefine((input, context) => {
  const unit = input.batch.stockBalance.availableToSell.unitCode;
  const { id: policyId, revision: policyRevision } = input.policy;
  const policySourceOk = (source: CalculationSource) =>
    source.dataMeaning === 'POLICY_RULE' && source.policyId === policyId && source.policyRevision === policyRevision;
  if (input.discountPolicy.policyId !== policyId || input.discountPolicy.policyRevision !== policyRevision
    || input.discountList.policyId !== policyId || input.discountList.policyRevision !== policyRevision
    || !policySourceOk(input.discountPolicy.source) || !policySourceOk(input.discountList.source)) {
    context.addIssue({ code: 'custom', path: ['discountPolicy'], message: 'Discount parameters must bind to the exact policy revision' });
  }
  if (input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT' && !policySourceOk(input.marginConstraint.minimumContribution.source)) {
    context.addIssue({ code: 'custom', path: ['marginConstraint'], message: 'Margin parameter must bind to the exact policy revision' });
  }
  if (input.marginConstraint.kind === 'MIN_GROSS_MARGIN_RATE' && !policySourceOk(input.marginConstraint.source)) {
    context.addIssue({ code: 'custom', path: ['marginConstraint'], message: 'Margin parameter must bind to the exact policy revision' });
  }
  if (input.basePrice.source.dataMeaning !== 'UNIT_PRICE' || input.basePrice.source.unitCode !== unit
    || input.unitCost.source.dataMeaning !== 'UNIT_COST' || input.unitCost.source.unitCode !== unit) {
    context.addIssue({ code: 'custom', path: ['basePrice', 'source'], message: 'Price and cost sources must declare their meaning and batch unit' });
  }
  if (input.scenario.source.dataMeaning !== 'SCENARIO' || input.scenario.source.scenarioId !== input.scenario.id
    || input.scenario.source.scenarioVersion !== input.scenario.version) {
    context.addIssue({ code: 'custom', path: ['scenario', 'source'], message: 'Scenario source must bind the exact scenario version' });
  }
  const snapshot = input.inputSnapshot;
  if (!sameBasis(snapshot.asOf, input.asOf) || temporalValue(snapshot.asOf) !== temporalValue(input.asOf)
    || snapshot.scenarioId !== input.scenario.id || snapshot.scenarioVersion !== input.scenario.version
    || snapshot.batchId !== input.batch.id || !sameStringSet(snapshot.batchEvidenceIds, input.batch.evidenceIds)
    || snapshot.policyId !== policyId || snapshot.policyRevision !== policyRevision
    || !sameStringSet(snapshot.policyEvidenceIds, input.policy.evidenceIds)
    || snapshot.source.dataMeaning !== 'BATCH_SNAPSHOT') {
    context.addIssue({ code: 'custom', path: ['inputSnapshot'], message: 'Input snapshot must bind the exact asOf, scenario, batch and policy evidence' });
  }
  const observed = input.scenario.observedWindow;
  const simulated = input.scenario.simulationWindow;
  if (![observed.start, observed.end, simulated.start, simulated.end].every((time) => sameBasis(time, input.asOf))
    || compareTemporal(observed.end, input.asOf) > 0 || compareTemporal(simulated.start, input.asOf) <= 0) {
    context.addIssue({ code: 'custom', path: ['scenario'], message: 'Historical observations end by asOf; simulated period starts after asOf' });
  }
  if (input.asOf.basis === 'DATE_ONLY') {
    const capturedDate = instantDateInTimeZone(snapshot.capturedAt, input.asOf.timeZone);
    if (capturedDate === null || capturedDate > input.asOf.value) {
      context.addIssue({ code: 'custom', path: ['inputSnapshot', 'capturedAt'], message: 'Snapshot cannot be newer than asOf in its business timezone' });
    }
  }
  if (input.asOf.basis === 'INSTANT' && compareInstants(snapshot.capturedAt, input.asOf.value) > 0) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot', 'capturedAt'], message: 'Snapshot cannot be newer than asOf' });
  }
  const historicalSources: { readonly path: (string | number)[]; readonly source: CalculationSource }[] = [
    { path: ['basePrice', 'source'], source: input.basePrice.source },
    { path: ['unitCost', 'source'], source: input.unitCost.source },
    { path: ['discountPolicy', 'source'], source: input.discountPolicy.source },
    { path: ['discountList', 'source'], source: input.discountList.source },
    { path: ['scenario', 'source'], source: input.scenario.source },
    { path: ['inputSnapshot', 'source'], source: snapshot.source },
    ...(input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
      ? [{ path: ['marginConstraint', 'minimumContribution', 'source'], source: input.marginConstraint.minimumContribution.source }] : []),
    ...(input.marginConstraint.kind === 'MIN_GROSS_MARGIN_RATE'
      ? [{ path: ['marginConstraint', 'source'], source: input.marginConstraint.source }] : []),
    ...input.discountList.candidates.flatMap((candidate, index) => [
      { path: ['discountList', 'candidates', index, 'demandSource'], source: candidate.demandSource },
      { path: ['discountList', 'candidates', index, 'lossSource'], source: candidate.lossSource },
    ]),
  ];
  for (const entry of historicalSources) {
    const observedAt = entry.source.observedAt;
    if (entry.source.sourceKind !== 'PUBLIC_HISTORICAL' || observedAt === undefined) continue;
    const outsideWindow = !sameBasis(observedAt, input.asOf)
      || compareTemporal(observed.start, observedAt) > 0
      || compareTemporal(observedAt, observed.end) > 0
      || compareTemporal(observedAt, input.asOf) > 0;
    const capturedDate = observedAt.basis === 'DATE_ONLY'
      ? instantDateInTimeZone(snapshot.capturedAt, observedAt.timeZone)
      : null;
    const newerThanSnapshot = observedAt.basis === 'DATE_ONLY'
      ? capturedDate === null || observedAt.value > capturedDate
      : compareInstants(observedAt.value, snapshot.capturedAt) > 0;
    if (outsideWindow || newerThanSnapshot) {
      context.addIssue({ code: 'custom', path: entry.path, message: 'Historical source must be within the observed window and no newer than asOf/input snapshot' });
    }
  }
  for (const [index, candidate] of input.discountList.candidates.entries()) {
    for (const [field, source] of [['demandSource', candidate.demandSource], ['lossSource', candidate.lossSource]] as const) {
      const candidateUnit = field === 'demandSource' ? candidate.demandQty.unitCode : candidate.lossQty.unitCode;
      if (source.dataMeaning !== 'UNIT_COUNT' || source.unitCode !== candidateUnit
        || source.scenarioId !== input.scenario.id || source.scenarioVersion !== input.scenario.version) {
        context.addIssue({ code: 'custom', path: ['discountList', 'candidates', index, field], message: 'Quantity source must bind unit and scenario version' });
      }
      if (source.sourceKind === 'PUBLIC_HISTORICAL') {
        context.addIssue({ code: 'custom', path: ['discountList', 'candidates', index, field], message: 'Historical counts require an explicit DERIVED or SIMULATED scenario quantity before use' });
      }
    }
  }
});

export const markdownCalculationInputSchema = z.unknown()
  .superRefine((input, context) => preflight(input, context))
  .pipe(inputInnerSchema);
export type MarkdownCalculationInput = z.infer<typeof markdownCalculationInputSchema>;

export const markdownCalculationReasonSchema = z.enum([
  'INPUT_INVALID', 'DUPLICATE_DISCOUNT', 'NO_FEASIBLE_CANDIDATE', 'QUALITY_NOT_PASS',
  'SELLABILITY_BLOCKED', 'SELLABILITY_UNRESOLVED', 'ZERO_SELLABLE_STOCK', 'CURRENCY_MISMATCH',
  'UNIT_MISMATCH', 'DISCOUNT_ABOVE_MAXIMUM', 'BELOW_MINIMUM_PRICE', 'NEGATIVE_CANDIDATE_PRICE',
  'DISCOUNT_NOT_POSITIVE', 'DEMAND_UNCERTAIN', 'LOSS_EXCEEDS_REMAINDER', 'MARGIN_BELOW_MINIMUM', 'MARGIN_UNDEFINED_REVENUE_ZERO',
]);
export type MarkdownCalculationReason = z.infer<typeof markdownCalculationReasonSchema>;

const outputMoneySchema = moneySchema.superRefine((money, context) => {
  if (typeof money.minorUnits !== 'string' || !integerPattern.test(money.minorUnits)
    || money.minorUnits.replace('-', '').length > MAX_OUTPUT_DIGITS
    || !Number.isSafeInteger(money.minorUnitScale) || money.minorUnitScale < 0 || money.minorUnitScale > MAX_OUTPUT_SCALE) {
    context.addIssue({ code: 'custom', message: 'Output exceeds bounded exact-integer dimensions' });
  }
});
const metricsSchema = z.object({
  openingQty: quantitySchema, simulatedDemandQty: quantitySchema, simulatedSoldQty: quantitySchema,
  remainingAfterSalesQty: quantitySchema, reportedLossQty: quantitySchema, endingQty: quantitySchema.nullable(),
  revenue: outputMoneySchema, directProductCost: outputMoneySchema, contribution: outputMoneySchema, simulatedLossCostExposure: outputMoneySchema,
  precision: z.object({
    inputMoneyScale: z.number().int().min(0).max(MAX_SCALE),
    quantityScale: z.number().int().min(0).max(MAX_SCALE),
    rounding: z.literal('NONE_EXACT'),
  }).strict(),
}).strict();
const candidateResultSchema = z.object({
  inputOrdinal: z.number().int().nonnegative().max(MAX_CANDIDATES - 1),
  discountAmount: outputMoneySchema, proposedPrice: outputMoneySchema.nullable(),
  status: z.enum(['CALCULATED', 'REJECTED']), hardRulesPassed: z.boolean(),
  reasonCodes: z.array(markdownCalculationReasonSchema), metrics: metricsSchema.nullable(),
}).strict();
const resultSnapshotSchema = z.object({
  inputSnapshot: inputSnapshotSchema, scenario: scenarioSchema, policy: policySchema, batch: batchSchema, asOf: asOfSchema,
  batchId: opaqueReferenceSchema, basePrice: sourcedMoneySchema, unitCost: sourcedMoneySchema,
  openingQty: boundedQuantitySchema,
  discountPolicy: z.object({
    policyId: opaqueReferenceSchema, policyRevision: opaqueReferenceSchema,
    maximumDiscount: nonNegativeMoneySchema, minimumPrice: nonNegativeMoneySchema, source: calculationSourceSchema,
  }).strict(),
  marginConstraint: markdownMarginConstraintSchema, discountListVersion: opaqueReferenceSchema,
  discountListPolicyId: opaqueReferenceSchema, discountListPolicyRevision: opaqueReferenceSchema,
  discountListSource: calculationSourceSchema,
  candidateInputs: z.array(candidateInputSchema).min(1).max(MAX_CANDIDATES),
}).strict();
type ResultSnapshot = z.infer<typeof resultSnapshotSchema>;
const resultInnerSchema = z.object({
  contractVersion: contractVersionSchema, formulaVersion: formulaVersionSchema,
  status: z.enum(['CALCULATED', 'REJECTED', 'NOT_COMPUTABLE']),
  businessApproval: z.literal('REQUIRED'), executionAuthority: z.literal('NONE'),
  reasonCodes: z.array(markdownCalculationReasonSchema), candidates: z.array(candidateResultSchema).max(MAX_CANDIDATES),
  inputSnapshot: resultSnapshotSchema.nullable(), assumptions: z.array(z.string().max(160)),
  formulas: z.object({
    simulatedSoldQty: z.literal('min(openingQty, simulatedDemandQty)'),
    remainingAfterSalesQty: z.literal('openingQty - simulatedSoldQty'),
    endingQty: z.literal('remainingAfterSalesQty - reportedLossQty when non-negative'),
    revenue: z.literal('proposedPrice x simulatedSoldQty'),
    directProductCost: z.literal('unitCost x simulatedSoldQty'),
    contribution: z.literal('revenue - directProductCost'),
    simulatedLossCostExposure: z.literal('unitCost x reportedLossQty; exposure only, not a loss KPI'),
    precision: z.literal('BigInt exact; money scale = maximum input money scale + quantity scale; no rounding'),
  }).strict(),
  claims: z.object({ finalLossKpi: z.literal('NOT_CLAIMED'), realPriceCausality: z.literal('NOT_ESTABLISHED') }).strict(),
}).strict().superRefine((result, context) => {
  if (result.status === 'NOT_COMPUTABLE') {
    if (result.inputSnapshot !== null || result.candidates.length !== 0 || !result.reasonCodes.includes('INPUT_INVALID')) {
      context.addIssue({ code: 'custom', path: ['status'], message: 'NOT_COMPUTABLE requires invalid input and no candidates' });
    }
    return;
  }
  if (result.inputSnapshot === null || result.candidates.length === 0 || result.reasonCodes.includes('INPUT_INVALID')) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Computed output requires snapshot and candidates' });
    return;
  }
  const outputSnapshot = result.inputSnapshot;
  const reconstructedInput = markdownCalculationInputSchema.safeParse({
    contractVersion: result.contractVersion, formulaVersion: result.formulaVersion,
    batch: outputSnapshot.batch, asOf: outputSnapshot.asOf, scenario: outputSnapshot.scenario,
    policy: outputSnapshot.policy, inputSnapshot: outputSnapshot.inputSnapshot,
    basePrice: outputSnapshot.basePrice, unitCost: outputSnapshot.unitCost,
    discountPolicy: outputSnapshot.discountPolicy, marginConstraint: outputSnapshot.marginConstraint,
    discountList: {
      version: outputSnapshot.discountListVersion, policyId: outputSnapshot.discountListPolicyId,
      policyRevision: outputSnapshot.discountListPolicyRevision, source: outputSnapshot.discountListSource,
      candidates: outputSnapshot.candidateInputs,
    },
  });
  if (!reconstructedInput.success) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot'], message: 'Result must retain a complete, independently valid source input snapshot' });
    return;
  }
  const snapshotMoney = [
    result.inputSnapshot.basePrice.value,
    result.inputSnapshot.unitCost.value,
    result.inputSnapshot.discountPolicy.maximumDiscount,
    result.inputSnapshot.discountPolicy.minimumPrice,
    ...(result.inputSnapshot.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
      ? [result.inputSnapshot.marginConstraint.minimumContribution.value] : []),
    ...result.inputSnapshot.candidateInputs.map((item) => item.discountAmount),
  ];
  if (!snapshotMoney.every((item) => isSafeMoney(item, MAX_DIGITS, MAX_SCALE))) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot'], message: 'Source money is outside safe BigInt dimensions' });
    return;
  }
  const sourceSnapshot = result.inputSnapshot.inputSnapshot;
  const batchQuantities = [
    result.inputSnapshot.batch.stockBalance.physicalOnHand,
    result.inputSnapshot.batch.stockBalance.unavailable,
    result.inputSnapshot.batch.stockBalance.availableToSell,
    result.inputSnapshot.batch.stockBalance.reserved,
  ];
  if (!batchQuantities.every((item) => safeQuantity(item.value))
    || !safeQuantity(result.inputSnapshot.openingQty.value)) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot', 'batch'], message: 'Source batch quantities exceed safe input dimensions' });
    return;
  }
  const batch = result.inputSnapshot.batch;
  const sourceIdentityMatches = sameBasis(sourceSnapshot.asOf, result.inputSnapshot.asOf)
    && temporalValue(sourceSnapshot.asOf) === temporalValue(result.inputSnapshot.asOf)
    && sourceSnapshot.scenarioId === result.inputSnapshot.scenario.id
    && sourceSnapshot.scenarioVersion === result.inputSnapshot.scenario.version
    && sourceSnapshot.batchId === batch.id && result.inputSnapshot.batchId === batch.id
    && sameStringSet(sourceSnapshot.batchEvidenceIds, batch.evidenceIds)
    && sourceSnapshot.policyId === result.inputSnapshot.policy.id
    && sourceSnapshot.policyRevision === result.inputSnapshot.policy.revision
    && sameStringSet(sourceSnapshot.policyEvidenceIds, result.inputSnapshot.policy.evidenceIds)
    && quantityEqual(result.inputSnapshot.openingQty, batch.stockBalance.availableToSell)
    && result.inputSnapshot.discountPolicy.policyId === result.inputSnapshot.policy.id
    && result.inputSnapshot.discountPolicy.policyRevision === result.inputSnapshot.policy.revision
    && policySourceMatches(result.inputSnapshot.discountPolicy.source, result.inputSnapshot.policy)
    && result.inputSnapshot.discountListPolicyId === result.inputSnapshot.policy.id
    && result.inputSnapshot.discountListPolicyRevision === result.inputSnapshot.policy.revision
    && policySourceMatches(result.inputSnapshot.discountListSource, result.inputSnapshot.policy)
    && (result.inputSnapshot.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
      ? policySourceMatches(result.inputSnapshot.marginConstraint.minimumContribution.source, result.inputSnapshot.policy)
      : policySourceMatches(result.inputSnapshot.marginConstraint.source, result.inputSnapshot.policy))
    && result.inputSnapshot.scenario.source.dataMeaning === 'SCENARIO'
    && result.inputSnapshot.scenario.source.scenarioId === result.inputSnapshot.scenario.id
    && result.inputSnapshot.scenario.source.scenarioVersion === result.inputSnapshot.scenario.version
    && sourceSnapshot.source.dataMeaning === 'BATCH_SNAPSHOT'
    && result.inputSnapshot.basePrice.source.dataMeaning === 'UNIT_PRICE'
    && result.inputSnapshot.unitCost.source.dataMeaning === 'UNIT_COST'
    && result.inputSnapshot.basePrice.source.unitCode === batch.stockBalance.availableToSell.unitCode
    && result.inputSnapshot.unitCost.source.unitCode === batch.stockBalance.availableToSell.unitCode
    && result.inputSnapshot.candidateInputs.every((item) =>
      item.demandSource.dataMeaning === 'UNIT_COUNT'
      && item.lossSource.dataMeaning === 'UNIT_COUNT'
      && item.demandSource.unitCode === item.demandQty.unitCode
      && item.lossSource.unitCode === item.lossQty.unitCode
      && item.demandSource.scenarioId === outputSnapshot.scenario.id
      && item.demandSource.scenarioVersion === outputSnapshot.scenario.version
      && item.lossSource.scenarioId === outputSnapshot.scenario.id
      && item.lossSource.scenarioVersion === outputSnapshot.scenario.version
      && item.demandSource.sourceKind !== 'PUBLIC_HISTORICAL'
      && item.lossSource.sourceKind !== 'PUBLIC_HISTORICAL');
  if (!sourceIdentityMatches) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot'], message: 'Calculation result must preserve internally consistent batch, time, scenario, and policy inputs' });
    return;
  }
  const anyCalculated = result.candidates.some((candidate) => candidate.status === 'CALCULATED');
  if ((result.status === 'CALCULATED') !== anyCalculated) context.addIssue({ code: 'custom', path: ['status'], message: 'Overall status must match candidate statuses' });
  for (const [index, candidate] of result.candidates.entries()) {
    const noReasons = candidate.reasonCodes.length === 0;
    if (candidate.hardRulesPassed !== noReasons || (candidate.status === 'CALCULATED') !== candidate.hardRulesPassed) {
      context.addIssue({ code: 'custom', path: ['candidates', index], message: 'Candidate status, hardRulesPassed and reason codes disagree' });
    }
    const expected = candidatePrice(result.inputSnapshot.basePrice.value, candidate.discountAmount);
    if (!moneyEqual(expected, candidate.proposedPrice)) context.addIssue({ code: 'custom', path: ['candidates', index, 'proposedPrice'], message: 'Price must equal base price less discount' });
    if (candidate.status === 'CALCULATED' && candidate.metrics === null) context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Calculated candidates require metrics' });
    if (candidate.metrics !== null) checkQuantityConservation(candidate.metrics, index, context);
  }
  if (result.inputSnapshot.candidateInputs.length !== result.candidates.length) {
    context.addIssue({ code: 'custom', path: ['inputSnapshot', 'candidateInputs'], message: 'Every output candidate must retain its source-bearing input' });
  }
  const ordinals = result.candidates.map((candidate) => candidate.inputOrdinal);
  if (new Set(ordinals).size !== ordinals.length
    || ordinals.length !== result.inputSnapshot.candidateInputs.length
    || !Array.from({ length: ordinals.length }, (_, ordinal) => ordinals.includes(ordinal)).every(Boolean)) {
    context.addIssue({ code: 'custom', path: ['candidates'], message: 'Input ordinals must form a unique one-to-one mapping to candidate inputs' });
  }
  const inputMoneyScale = Math.max(...[
    result.inputSnapshot.basePrice.value.minorUnitScale, result.inputSnapshot.unitCost.value.minorUnitScale,
    result.inputSnapshot.discountPolicy.maximumDiscount.minorUnitScale,
    result.inputSnapshot.discountPolicy.minimumPrice.minorUnitScale,
    ...(result.inputSnapshot.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
      ? [result.inputSnapshot.marginConstraint.minimumContribution.value.minorUnitScale] : []),
    ...result.inputSnapshot.candidateInputs.map((item) => item.discountAmount.minorUnitScale),
  ]);
  for (const [index, candidate] of result.candidates.entries()) {
    const input = result.inputSnapshot.candidateInputs[candidate.inputOrdinal];
    if (input === undefined || !moneyEqual(input.discountAmount, candidate.discountAmount)) {
      context.addIssue({ code: 'custom', path: ['candidates', index, 'inputOrdinal'], message: 'Candidate must bind its original source-bearing input' });
      continue;
    }
    const demandUncertain = input.demandAssessment === 'UNCERTAIN';
    if ((demandUncertain && (candidate.status !== 'REJECTED' || candidate.metrics !== null || !candidate.reasonCodes.includes('DEMAND_UNCERTAIN')))
      || (!demandUncertain && candidate.reasonCodes.includes('DEMAND_UNCERTAIN'))) {
      context.addIssue({ code: 'custom', path: ['candidates', index], message: 'Uncertain demand must reject without calculated metrics' });
    }
    if (candidate.metrics !== null) {
      checkMetricArithmetic(candidate.metrics, candidate, result.inputSnapshot.openingQty, input, result.inputSnapshot.unitCost.value, inputMoneyScale, index, context);
    }
    const expectedReasons = expectedCandidateHardRuleReasons(result.inputSnapshot, input);
    if (!sameOrderedStrings(candidate.reasonCodes, expectedReasons)) {
      context.addIssue({ code: 'custom', path: ['candidates', index, 'reasonCodes'], message: 'Candidate reasons must match the deterministic rules evaluated from the retained inputs' });
    }
    const sameCurrency = allSnapshotMoney(outputSnapshot)
      .every((item) => item.currencyCode === outputSnapshot.basePrice.value.currencyCode);
    const unitOk = input.demandQty.unitCode === batch.stockBalance.availableToSell.unitCode
      && input.lossQty.unitCode === batch.stockBalance.availableToSell.unitCode;
    const shouldHaveMetrics = sameCurrency && candidate.proposedPrice !== null && unitOk && input.demandAssessment === 'ADEQUATE';
    if ((candidate.metrics !== null) !== shouldHaveMetrics) {
      context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Metrics presence must match the explicit calculation inputs' });
    }
    if (candidate.status === 'CALCULATED'
      && (expectedReasons.length !== 0 || candidate.metrics === null || candidate.metrics.endingQty === null)) {
      context.addIssue({ code: 'custom', path: ['candidates', index], message: 'A calculated candidate must pass every hard rule and have a feasible loss-adjusted ending quantity' });
    }
  }
  const aggregate = uniqueReasons(result.candidates.flatMap((candidate) => candidate.reasonCodes));
  if (!anyCalculated) aggregate.push('NO_FEASIBLE_CANDIDATE');
  if (!sameStringSet(aggregate, result.reasonCodes)) context.addIssue({ code: 'custom', path: ['reasonCodes'], message: 'Overall reason codes must match candidate outcomes' });
});
export const markdownCalculationResultSchema = z.unknown()
  .superRefine((result, context) => preflight(result, context, true))
  .pipe(resultInnerSchema);
export type MarkdownCalculationResult = z.infer<typeof markdownCalculationResultSchema>;

export function calculateMarkdownCandidates(input: unknown): MarkdownCalculationResult {
  const parsed = markdownCalculationInputSchema.safeParse(input);
  if (!parsed.success) return notComputable();
  const data = parsed.data;
  const moneyInputs = allMoney(data);
  const currencyOk = new Set(moneyInputs.map((item) => item.currencyCode)).size === 1;
  const sellability = assessSellability({ expiry: data.batch.expiry, asOf: data.asOf, qualityStatus: data.batch.qualityStatus });
  const globalReasons: MarkdownCalculationReason[] = [];
  if (data.batch.qualityStatus !== 'PASS') globalReasons.push('QUALITY_NOT_PASS');
  if (sellability.status === 'BLOCKED') globalReasons.push('SELLABILITY_BLOCKED');
  if (sellability.status === 'UNRESOLVED') globalReasons.push('SELLABILITY_UNRESOLVED');
  if (decimalToScaledInteger(data.batch.stockBalance.availableToSell.value, decimalScale(data.batch.stockBalance.availableToSell.value)) <= 0n) globalReasons.push('ZERO_SELLABLE_STOCK');
  if (!currencyOk) globalReasons.push('CURRENCY_MISMATCH');
  const duplicate = hasDuplicateDiscounts(data);
  const candidates = data.discountList.candidates.map((candidate, inputOrdinal) => ({ candidate, inputOrdinal }))
    .sort((left, right) => compareMoney(left.candidate.discountAmount, right.candidate.discountAmount))
    .map(({ candidate, inputOrdinal }) => evaluate(data, candidate, inputOrdinal, globalReasons, duplicate));
  const anyCalculated = candidates.some((candidate) => candidate.status === 'CALCULATED');
  const reasons = uniqueReasons(candidates.flatMap((candidate) => candidate.reasonCodes));
  if (!anyCalculated) reasons.push('NO_FEASIBLE_CANDIDATE');
  return resultSchemaParse(data, anyCalculated ? 'CALCULATED' : 'REJECTED', reasons, candidates);
}

type Candidate = MarkdownCalculationResult['candidates'][number];
function evaluate(
  input: MarkdownCalculationInput,
  candidate: MarkdownCalculationInput['discountList']['candidates'][number],
  inputOrdinal: number,
  globalReasons: readonly MarkdownCalculationReason[],
  duplicate: boolean,
): Candidate {
  const moneyScale = Math.max(...allMoney(input).map((money) => money.minorUnitScale));
  const quantityScale = Math.max(
    decimalScale(input.batch.stockBalance.availableToSell.value),
    decimalScale(candidate.demandQty.value), decimalScale(candidate.lossQty.value),
  );
  const opening = decimalToScaledInteger(input.batch.stockBalance.availableToSell.value, quantityScale);
  const demand = decimalToScaledInteger(candidate.demandQty.value, quantityScale);
  const loss = decimalToScaledInteger(candidate.lossQty.value, quantityScale);
  const sold = opening < demand ? opening : demand;
  const remainder = opening - sold;
  const ending = loss <= remainder ? remainder - loss : null;
  const sameCurrency = allMoney(input).every((money) => money.currencyCode === input.basePrice.value.currencyCode);
  const proposed = candidatePrice(input.basePrice.value, candidate.discountAmount);
  const priceMinor = atScale(input.basePrice.value, moneyScale) - atScale(candidate.discountAmount, moneyScale);
  const discount = atScale(candidate.discountAmount, moneyScale);
  const maximumDiscount = atScale(input.discountPolicy.maximumDiscount, moneyScale);
  const minimumPrice = atScale(input.discountPolicy.minimumPrice, moneyScale);
  const unit = input.batch.stockBalance.availableToSell.unitCode;
  const unitOk = candidate.demandQty.unitCode === unit && candidate.lossQty.unitCode === unit;
  const reasons = [...globalReasons];
  if (duplicate) reasons.push('DUPLICATE_DISCOUNT');
  if (!unitOk) reasons.push('UNIT_MISMATCH');
  if (candidate.demandAssessment === 'UNCERTAIN') reasons.push('DEMAND_UNCERTAIN');
  if (discount <= 0n) reasons.push('DISCOUNT_NOT_POSITIVE');
  if (discount > maximumDiscount) reasons.push('DISCOUNT_ABOVE_MAXIMUM');
  if (priceMinor < 0n) reasons.push('NEGATIVE_CANDIDATE_PRICE');
  else if (priceMinor < minimumPrice) reasons.push('BELOW_MINIMUM_PRICE');
  if (loss > remainder) reasons.push('LOSS_EXCEEDS_REMAINDER');
  const contributionPerUnit = priceMinor - atScale(input.unitCost.value, moneyScale);
  if (input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT') {
    if (contributionPerUnit < atScale(input.marginConstraint.minimumContribution.value, moneyScale)) reasons.push('MARGIN_BELOW_MINIMUM');
  } else if (sold === 0n || priceMinor === 0n) {
    reasons.push('MARGIN_UNDEFINED_REVENUE_ZERO');
  } else if (contributionPerUnit * BigInt(input.marginConstraint.denominator)
    < priceMinor * BigInt(input.marginConstraint.numerator)) {
    reasons.push('MARGIN_BELOW_MINIMUM');
  }
  const unique = uniqueReasons(reasons);
  const metrics = sameCurrency && proposed !== null && unitOk && candidate.demandAssessment === 'ADEQUATE'
    ? metricsFor(input, candidate, proposed, opening, demand, sold, remainder, loss, ending, moneyScale, quantityScale)
    : null;
  if (metrics === null && unique.length === 0) unique.push('CURRENCY_MISMATCH');
  const passed = unique.length === 0 && metrics !== null;
  return {
    inputOrdinal,
    discountAmount: candidate.discountAmount, proposedPrice: proposed,
    status: passed ? 'CALCULATED' : 'REJECTED', hardRulesPassed: passed,
    reasonCodes: unique, metrics,
  };
}

function metricsFor(
  input: MarkdownCalculationInput,
  candidate: MarkdownCalculationInput['discountList']['candidates'][number],
  price: z.infer<typeof outputMoneySchema>,
  opening: bigint, demand: bigint, sold: bigint, remainder: bigint, loss: bigint, ending: bigint | null,
  moneyScale: number, quantityScale: number,
): z.infer<typeof metricsSchema> {
  const cost = atScale(input.unitCost.value, moneyScale);
  const exactScale = moneyScale + quantityScale;
  const revenue = atScale(price, moneyScale) * sold;
  const directCost = cost * sold;
  return {
    openingQty: quantity(opening, quantityScale, input.batch.stockBalance.availableToSell.unitCode),
    simulatedDemandQty: quantity(demand, quantityScale, candidate.demandQty.unitCode),
    simulatedSoldQty: quantity(sold, quantityScale, candidate.demandQty.unitCode),
    remainingAfterSalesQty: quantity(remainder, quantityScale, candidate.demandQty.unitCode),
    reportedLossQty: quantity(loss, quantityScale, candidate.lossQty.unitCode),
    endingQty: ending === null ? null : quantity(ending, quantityScale, candidate.lossQty.unitCode),
    revenue: money(atScale(price, moneyScale) * sold, input.basePrice.value.currencyCode, exactScale),
    directProductCost: money(directCost, input.basePrice.value.currencyCode, exactScale),
    contribution: money(revenue - directCost, input.basePrice.value.currencyCode, exactScale),
    simulatedLossCostExposure: money(cost * loss, input.basePrice.value.currencyCode, exactScale),
    precision: { inputMoneyScale: moneyScale, quantityScale, rounding: 'NONE_EXACT' },
  };
}

function resultSchemaParse(
  input: MarkdownCalculationInput,
  status: 'CALCULATED' | 'REJECTED',
  reasonCodes: MarkdownCalculationReason[],
  candidates: Candidate[],
): MarkdownCalculationResult {
  return markdownCalculationResultSchema.parse({
    contractVersion: '0.3.0', formulaVersion: MARKDOWN_FORMULA_VERSION, status,
    businessApproval: 'REQUIRED', executionAuthority: 'NONE', reasonCodes, candidates,
    inputSnapshot: {
      inputSnapshot: input.inputSnapshot, scenario: input.scenario, policy: input.policy, batch: input.batch, asOf: input.asOf, batchId: input.batch.id,
      basePrice: input.basePrice, unitCost: input.unitCost,
      openingQty: input.batch.stockBalance.availableToSell,
      discountPolicy: input.discountPolicy, marginConstraint: input.marginConstraint,
      discountListVersion: input.discountList.version, discountListPolicyId: input.discountList.policyId,
      discountListPolicyRevision: input.discountList.policyRevision, discountListSource: input.discountList.source,
      candidateInputs: input.discountList.candidates,
    },
    assumptions: [
      'DEMAND_AND_LOSS_ARE_CALLER_SUPPLIED_SCENARIO_VALUES', 'NO_PRICE_ELASTICITY_INFERENCE',
      'LOSS_COST_IS_EXPOSURE_NOT_FINAL_LOSS_KPI', 'CALCULATION_DOES_NOT_GRANT_APPROVAL_OR_EXECUTION',
    ],
    claims: { finalLossKpi: 'NOT_CLAIMED', realPriceCausality: 'NOT_ESTABLISHED' },
    formulas: {
      simulatedSoldQty: 'min(openingQty, simulatedDemandQty)',
      remainingAfterSalesQty: 'openingQty - simulatedSoldQty',
      endingQty: 'remainingAfterSalesQty - reportedLossQty when non-negative',
      revenue: 'proposedPrice x simulatedSoldQty',
      directProductCost: 'unitCost x simulatedSoldQty',
      contribution: 'revenue - directProductCost',
      simulatedLossCostExposure: 'unitCost x reportedLossQty; exposure only, not a loss KPI',
      precision: 'BigInt exact; money scale = maximum input money scale + quantity scale; no rounding',
    },
  });
}

function notComputable(): MarkdownCalculationResult {
  return markdownCalculationResultSchema.parse({
    contractVersion: '0.3.0', formulaVersion: MARKDOWN_FORMULA_VERSION, status: 'NOT_COMPUTABLE',
    businessApproval: 'REQUIRED', executionAuthority: 'NONE', reasonCodes: ['INPUT_INVALID'], candidates: [],
    inputSnapshot: null, assumptions: ['INPUT_EVIDENCE_INCOMPLETE_OR_INVALID'],
    claims: { finalLossKpi: 'NOT_CLAIMED', realPriceCausality: 'NOT_ESTABLISHED' },
    formulas: {
      simulatedSoldQty: 'min(openingQty, simulatedDemandQty)',
      remainingAfterSalesQty: 'openingQty - simulatedSoldQty',
      endingQty: 'remainingAfterSalesQty - reportedLossQty when non-negative',
      revenue: 'proposedPrice x simulatedSoldQty',
      directProductCost: 'unitCost x simulatedSoldQty',
      contribution: 'revenue - directProductCost',
      simulatedLossCostExposure: 'unitCost x reportedLossQty; exposure only, not a loss KPI',
      precision: 'BigInt exact; money scale = maximum input money scale + quantity scale; no rounding',
    },
  });
}

function preflight(value: unknown, context: z.RefinementCtx, output = false): void {
  let count = 0;
  let textSize = 0;
  let invalid = false;
  const active = new WeakSet<object>();
  const digitLimit = output ? MAX_OUTPUT_DIGITS : MAX_DIGITS;
  const scaleLimit = output ? MAX_OUTPUT_SCALE : MAX_SCALE;
  const fail = (path: (string | number)[], message: string) => {
    invalid = true;
    context.addIssue({ code: 'custom', path, message });
  };
  const visit = (item: unknown, path: (string | number)[], depth: number): void => {
    if (invalid) return;
    count += 1;
    if (count > MAX_NODES || depth > 32) return fail(path, 'Input exceeds bounded structure dimensions');
    if (typeof item === 'string') {
      textSize += item.length;
      if (item.length > MAX_TEXT || textSize > MAX_TEXT) fail(path, 'Input exceeds bounded text dimensions');
      return;
    }
    if (item === null || typeof item !== 'object') return;
    if (active.has(item)) return fail(path, 'Input contains a cyclic object reference');
    if (Array.isArray(item)) {
      if (item.length > MAX_REFS) return fail(path, 'Input array exceeds bounded dimensions');
      active.add(item);
      item.forEach((child, index) => visit(child, [...path, index], depth + 1));
      active.delete(item);
      return;
    }
    const record = item as Record<string, unknown>;
    active.add(record);
    if (Array.isArray(record.candidates) && record.candidates.length > MAX_CANDIDATES) return fail([...path, 'candidates'], 'Candidate list exceeds technical limit');
    if (typeof record.minorUnits === 'string' && (!integerPattern.test(record.minorUnits) || record.minorUnits.replace('-', '').length > digitLimit)) return fail([...path, 'minorUnits'], 'Money exceeds technical integer dimensions');
    if (typeof record.minorUnitScale === 'number' && (!Number.isSafeInteger(record.minorUnitScale) || record.minorUnitScale < 0 || record.minorUnitScale > scaleLimit)) return fail([...path, 'minorUnitScale'], 'Money exceeds technical scale limit');
    if (typeof record.unitCode === 'string' && typeof record.value === 'string' && decimalPattern.test(record.value)) {
      const parts = decimalParts(record.value);
      const quantityDigitLimit = output ? MAX_OUTPUT_QUANTITY_DIGITS : MAX_DIGITS;
      if (parts.whole.length + parts.fraction.length > quantityDigitLimit || parts.fraction.length > MAX_SCALE) return fail([...path, 'value'], 'Quantity exceeds technical dimensions');
    }
    Object.entries(record).forEach(([key, child]) => visit(child, [...path, key], depth + 1));
    active.delete(record);
  };
  visit(value, [], 0);
}

function allMoney(input: MarkdownCalculationInput): z.infer<typeof moneySchema>[] {
  const margin = input.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT' ? [input.marginConstraint.minimumContribution.value] : [];
  return [
    input.basePrice.value, input.unitCost.value, input.discountPolicy.maximumDiscount, input.discountPolicy.minimumPrice,
    ...margin, ...input.discountList.candidates.map((candidate) => candidate.discountAmount),
  ];
}
function allSnapshotMoney(snapshot: ResultSnapshot): z.infer<typeof moneySchema>[] {
  const margin = snapshot.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT'
    ? [snapshot.marginConstraint.minimumContribution.value] : [];
  return [
    snapshot.basePrice.value, snapshot.unitCost.value, snapshot.discountPolicy.maximumDiscount,
    snapshot.discountPolicy.minimumPrice, ...margin, ...snapshot.candidateInputs.map((candidate) => candidate.discountAmount),
  ];
}
function policySourceMatches(source: CalculationSource, policy: z.infer<typeof policySchema>): boolean {
  return source.dataMeaning === 'POLICY_RULE'
    && source.policyId === policy.id && source.policyRevision === policy.revision;
}
function quantityEqual(left: z.infer<typeof quantitySchema>, right: z.infer<typeof quantitySchema>): boolean {
  if (left.unitCode !== right.unitCode || !safeQuantity(left.value) || !safeQuantity(right.value)) return false;
  const scale = Math.max(decimalScale(left.value), decimalScale(right.value));
  return decimalToScaledInteger(left.value, scale) === decimalToScaledInteger(right.value, scale);
}
function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function expectedCandidateHardRuleReasons(snapshot: ResultSnapshot, candidate: z.infer<typeof candidateInputSchema>): MarkdownCalculationReason[] {
  const moneyInputs = allSnapshotMoney(snapshot);
  const moneyScale = Math.max(...moneyInputs.map((item) => item.minorUnitScale));
  const currencyOk = moneyInputs.every((item) => item.currencyCode === snapshot.basePrice.value.currencyCode);
  const sellability = assessSellability({
    expiry: snapshot.batch.expiry, asOf: snapshot.asOf, qualityStatus: snapshot.batch.qualityStatus,
  });
  const openingValue = snapshot.batch.stockBalance.availableToSell.value;
  const quantityScale = Math.max(
    decimalScale(openingValue), decimalScale(candidate.demandQty.value), decimalScale(candidate.lossQty.value),
  );
  const opening = decimalToScaledInteger(openingValue, quantityScale);
  const demand = decimalToScaledInteger(candidate.demandQty.value, quantityScale);
  const loss = decimalToScaledInteger(candidate.lossQty.value, quantityScale);
  const sold = opening < demand ? opening : demand;
  const remainder = opening - sold;
  const discount = atScale(candidate.discountAmount, moneyScale);
  const maximumDiscount = atScale(snapshot.discountPolicy.maximumDiscount, moneyScale);
  const minimumPrice = atScale(snapshot.discountPolicy.minimumPrice, moneyScale);
  const priceMinor = atScale(snapshot.basePrice.value, moneyScale) - discount;
  const proposedPrice = candidatePrice(snapshot.basePrice.value, candidate.discountAmount);
  const unit = snapshot.batch.stockBalance.availableToSell.unitCode;
  const unitOk = candidate.demandQty.unitCode === unit && candidate.lossQty.unitCode === unit;
  const normalizedDiscounts = snapshot.candidateInputs.map((item) =>
    item.discountAmount.currencyCode + ':' + atScale(item.discountAmount, moneyScale).toString());
  const duplicate = new Set(normalizedDiscounts).size !== normalizedDiscounts.length;
  const reasons: MarkdownCalculationReason[] = [];
  if (snapshot.batch.qualityStatus !== 'PASS') reasons.push('QUALITY_NOT_PASS');
  if (sellability.status === 'BLOCKED') reasons.push('SELLABILITY_BLOCKED');
  if (sellability.status === 'UNRESOLVED') reasons.push('SELLABILITY_UNRESOLVED');
  if (opening <= 0n) reasons.push('ZERO_SELLABLE_STOCK');
  if (!currencyOk) reasons.push('CURRENCY_MISMATCH');
  if (duplicate) reasons.push('DUPLICATE_DISCOUNT');
  if (!unitOk) reasons.push('UNIT_MISMATCH');
  if (candidate.demandAssessment === 'UNCERTAIN') reasons.push('DEMAND_UNCERTAIN');
  if (discount <= 0n) reasons.push('DISCOUNT_NOT_POSITIVE');
  if (discount > maximumDiscount) reasons.push('DISCOUNT_ABOVE_MAXIMUM');
  if (priceMinor < 0n) reasons.push('NEGATIVE_CANDIDATE_PRICE');
  else if (priceMinor < minimumPrice) reasons.push('BELOW_MINIMUM_PRICE');
  if (loss > remainder) reasons.push('LOSS_EXCEEDS_REMAINDER');
  const contributionPerUnit = priceMinor - atScale(snapshot.unitCost.value, moneyScale);
  if (snapshot.marginConstraint.kind === 'MIN_CONTRIBUTION_PER_UNIT') {
    if (contributionPerUnit < atScale(snapshot.marginConstraint.minimumContribution.value, moneyScale)) reasons.push('MARGIN_BELOW_MINIMUM');
  } else if (sold === 0n || priceMinor === 0n) {
    reasons.push('MARGIN_UNDEFINED_REVENUE_ZERO');
  } else if (contributionPerUnit * BigInt(snapshot.marginConstraint.denominator)
    < priceMinor * BigInt(snapshot.marginConstraint.numerator)) {
    reasons.push('MARGIN_BELOW_MINIMUM');
  }
  if (proposedPrice === null && reasons.length === 0) reasons.push('CURRENCY_MISMATCH');
  return uniqueReasons(reasons);
}
function hasDuplicateDiscounts(input: MarkdownCalculationInput): boolean {
  const discounts = input.discountList.candidates.map((candidate) => candidate.discountAmount);
  const scale = Math.max(...discounts.map((item) => item.minorUnitScale));
  const normalized = discounts.map((item) => item.currencyCode + ':' + atScale(item, scale).toString());
  return new Set(normalized).size !== normalized.length;
}
function compareMoney(left: z.infer<typeof moneySchema>, right: z.infer<typeof moneySchema>): number {
  const scale = Math.max(left.minorUnitScale, right.minorUnitScale);
  const l = atScale(left, scale);
  const r = atScale(right, scale);
  return l < r ? -1 : l > r ? 1 : 0;
}
function atScale(value: z.infer<typeof moneySchema>, scale: number): bigint {
  return BigInt(value.minorUnits) * 10n ** BigInt(scale - value.minorUnitScale);
}
function money(value: bigint, currencyCode: string, minorUnitScale: number): z.infer<typeof moneySchema> {
  return { minorUnits: value.toString(), currencyCode, minorUnitScale };
}
function quantity(value: bigint, scale: number, unitCode: string): z.infer<typeof quantitySchema> {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  if (scale === 0) return { value: (negative ? '-' : '') + digits, unitCode };
  const padded = digits.padStart(scale + 1, '0');
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return { value: (negative ? '-' : '') + padded.slice(0, -scale) + (fraction ? '.' + fraction : ''), unitCode };
}
function candidatePrice(base: z.infer<typeof moneySchema>, discount: z.infer<typeof moneySchema>): z.infer<typeof moneySchema> | null {
  if (!isSafeMoney(base, MAX_DIGITS, MAX_SCALE)
    || !isSafeMoney(discount, MAX_DIGITS, MAX_SCALE)) return null;
  if (base.currencyCode !== discount.currencyCode) return null;
  const scale = Math.max(base.minorUnitScale, discount.minorUnitScale);
  const amount = atScale(base, scale) - atScale(discount, scale);
  return amount < 0n ? null : money(amount, base.currencyCode, scale);
}
function moneyEqual(left: z.infer<typeof moneySchema> | null, right: z.infer<typeof moneySchema> | null): boolean {
  return left === null ? right === null : right !== null && left.currencyCode === right.currencyCode
    && left.minorUnitScale === right.minorUnitScale && left.minorUnits === right.minorUnits;
}
function sameBasis(left: z.infer<typeof asOfSchema>, right: z.infer<typeof asOfSchema>): boolean {
  return left.basis === right.basis && (left.basis !== 'DATE_ONLY' || right.basis !== 'DATE_ONLY' || left.timeZone === right.timeZone);
}
function temporalValue(value: z.infer<typeof asOfSchema>): string {
  return value.value;
}
function compareTemporal(left: z.infer<typeof asOfSchema>, right: z.infer<typeof asOfSchema>): -1 | 0 | 1 {
  if (!sameBasis(left, right)) return 1;
  if (left.basis === 'DATE_ONLY' && right.basis === 'DATE_ONLY') return compareDateOnly(left.value, right.value);
  if (left.basis === 'INSTANT' && right.basis === 'INSTANT') return compareInstants(left.value, right.value);
  return 1;
}
function instantDateInTimeZone(instant: string, timeZone: string): string | null {
  const epochMilliseconds = Date.parse(instant);
  if (!Number.isFinite(epochMilliseconds)) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(epochMilliseconds));
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  if (!Number.isInteger(year) || year < 1 || year > 9999
    || !Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value));
}
function checkQuantityConservation(metrics: z.infer<typeof metricsSchema>, index: number, context: z.RefinementCtx): void {
  if (metrics === null || typeof metrics !== 'object' || metrics.openingQty === null || typeof metrics.openingQty !== 'object') {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Quantity metric structure is incomplete' });
    return;
  }
  const all = [metrics.simulatedDemandQty, metrics.simulatedSoldQty, metrics.remainingAfterSalesQty, metrics.reportedLossQty];
  const quantities = [metrics.openingQty, ...all, ...(metrics.endingQty === null ? [] : [metrics.endingQty])];
  if (!quantities.every((item) => item !== null && typeof item === 'object' && safeQuantity(item.value, true))) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Output quantity is outside safe decimal dimensions' });
    return;
  }
  if (all.some((item) => item.unitCode !== metrics.openingQty.unitCode)
    || (metrics.endingQty !== null && metrics.endingQty.unitCode !== metrics.openingQty.unitCode)) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'All quantity metrics must use one unit' });
    return;
  }
  const values = [metrics.openingQty.value, metrics.simulatedDemandQty.value, metrics.simulatedSoldQty.value, metrics.remainingAfterSalesQty.value, metrics.reportedLossQty.value];
  const scale = Math.max(...values.map(decimalScale));
  const opening = decimalToScaledInteger(metrics.openingQty.value, scale);
  const demand = decimalToScaledInteger(metrics.simulatedDemandQty.value, scale);
  const sold = decimalToScaledInteger(metrics.simulatedSoldQty.value, scale);
  const remainder = decimalToScaledInteger(metrics.remainingAfterSalesQty.value, scale);
  const loss = decimalToScaledInteger(metrics.reportedLossQty.value, scale);
  if (sold > demand || opening !== sold + remainder
    || (metrics.endingQty !== null && remainder !== loss + decimalToScaledInteger(metrics.endingQty.value, scale))
    || (metrics.endingQty === null && loss <= remainder)) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Quantity metrics violate stock conservation' });
  }
}

function checkMetricArithmetic(
  metrics: z.infer<typeof metricsSchema>,
  candidate: Candidate,
  openingQty: z.infer<typeof boundedQuantitySchema>,
  sourceInput: z.infer<typeof candidateInputSchema>,
  unitCost: z.infer<typeof moneySchema>,
  expectedMoneyScale: number,
  index: number,
  context: z.RefinementCtx,
): void {
  if (metrics === null || typeof metrics !== 'object' || metrics.precision === null
    || typeof metrics.precision !== 'object' || typeof metrics.precision.inputMoneyScale !== 'number'
    || typeof metrics.precision.quantityScale !== 'number') {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics', 'precision'], message: 'Metric precision evidence is incomplete' });
    return;
  }
  const metricMoney = [metrics.revenue, metrics.directProductCost, metrics.contribution, metrics.simulatedLossCostExposure];
  if (!metricMoney.every((item) => isSafeMoney(item, MAX_OUTPUT_DIGITS, MAX_OUTPUT_SCALE))
    || !isSafeMoney(candidate.proposedPrice, MAX_OUTPUT_DIGITS, MAX_OUTPUT_SCALE)
    || !isSafeMoney(unitCost, MAX_DIGITS, MAX_SCALE)) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Metric money is outside safe BigInt dimensions' });
    return;
  }
  const precision = metrics.precision;
  if (precision.inputMoneyScale !== expectedMoneyScale) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics', 'precision'], message: 'Reported money precision does not match input precision' });
    return;
  }
  const qScale = precision.quantityScale;
  const outputQuantities = [
    metrics.openingQty, metrics.simulatedDemandQty, metrics.simulatedSoldQty,
    metrics.remainingAfterSalesQty, metrics.reportedLossQty,
    ...(metrics.endingQty === null ? [] : [metrics.endingQty]),
  ];
  if (!outputQuantities.every((item) => item !== null && typeof item === 'object' && safeQuantity(item.value, true))) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Output quantity is outside safe decimal dimensions' });
    return;
  }
  const rawQuantities = [openingQty.value, sourceInput.demandQty.value, sourceInput.lossQty.value];
  if (!rawQuantities.every((value) => safeQuantity(value))) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Input quantity is outside safe decimal dimensions' });
    return;
  }
  const requiredScale = Math.max(...rawQuantities.map(decimalScale));
  if (qScale !== requiredScale || qScale < requiredScale) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics', 'precision'], message: 'Reported quantity precision does not match explicit input precision' });
    return;
  }
  const opening = decimalToScaledInteger(openingQty.value, qScale);
  const demand = decimalToScaledInteger(sourceInput.demandQty.value, qScale);
  const lossInput = decimalToScaledInteger(sourceInput.lossQty.value, qScale);
  const outputOpening = decimalToScaledInteger(metrics.openingQty.value, qScale);
  const outputDemand = decimalToScaledInteger(metrics.simulatedDemandQty.value, qScale);
  const sold = decimalToScaledInteger(metrics.simulatedSoldQty.value, qScale);
  const outputLoss = decimalToScaledInteger(metrics.reportedLossQty.value, qScale);
  const price = candidate.proposedPrice;
  if (price === null) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'A metric result cannot have a missing candidate price' });
    return;
  }
  const expectedScale = expectedMoneyScale + qScale;
  const expectedRevenue = atScale(price, expectedMoneyScale) * sold;
  const expectedCost = atScale(unitCost, expectedMoneyScale) * sold;
  const expectedLossExposure = atScale(unitCost, expectedMoneyScale) * lossInput;
  const fieldsMatch = metrics.revenue.currencyCode === price.currencyCode
    && metrics.directProductCost.currencyCode === price.currencyCode
    && metrics.contribution.currencyCode === price.currencyCode
    && metrics.simulatedLossCostExposure.currencyCode === price.currencyCode
    && [metrics.revenue, metrics.directProductCost, metrics.contribution, metrics.simulatedLossCostExposure]
      .every((value) => value.minorUnitScale === expectedScale);
  const amountsMatch = metrics.revenue.minorUnits === expectedRevenue.toString()
    && metrics.directProductCost.minorUnits === expectedCost.toString()
    && metrics.contribution.minorUnits === (expectedRevenue - expectedCost).toString()
    && metrics.simulatedLossCostExposure.minorUnits === expectedLossExposure.toString()
    && opening >= sold && demand >= sold
    && sold === (opening < demand ? opening : demand)
    && outputOpening === opening && outputDemand === demand && outputLoss === lossInput;
  if (!fieldsMatch || !amountsMatch) {
    context.addIssue({ code: 'custom', path: ['candidates', index, 'metrics'], message: 'Metric amounts must exactly follow the versioned formulas and quantity inputs' });
  }
}
function safeQuantity(value: string, output = false): boolean {
  if (typeof value !== 'string' || !decimalPattern.test(value)) return false;
  const parts = decimalParts(value);
  return parts.whole.length + parts.fraction.length <= (output ? MAX_OUTPUT_QUANTITY_DIGITS : MAX_DIGITS)
    && parts.fraction.length <= MAX_SCALE;
}
function isSafeMoney(value: unknown, maxDigits: number, maxScale: number): value is z.infer<typeof moneySchema> {
  if (value === null || typeof value !== 'object') return false;
  const moneyValue = value as Record<string, unknown>;
  return typeof moneyValue.minorUnits === 'string'
    && integerPattern.test(moneyValue.minorUnits)
    && moneyValue.minorUnits.replace('-', '').length <= maxDigits
    && typeof moneyValue.minorUnitScale === 'number'
    && Number.isSafeInteger(moneyValue.minorUnitScale)
    && moneyValue.minorUnitScale >= 0 && moneyValue.minorUnitScale <= maxScale
    && typeof moneyValue.currencyCode === 'string';
}
function uniqueReasons(reasons: readonly MarkdownCalculationReason[]): MarkdownCalculationReason[] {
  return [...new Set(reasons)];
}
