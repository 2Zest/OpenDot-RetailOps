import { z } from 'zod';
import { freshRetailNetRecordSchema, freshRetailNetRevision } from './fresh-retailnet-record.js';

export const DEMAND_ESTIMATION_VERSION = 'retailops.demand-estimation/0.1.0' as const;

export const demandEstimationMethodSchema = z.enum([
  'HISTORICAL_MEAN',
  'NO_STOCKOUT_DAY_MEAN',
  'HOURLY_AVAILABILITY_EXTRAPOLATION',
]);

const dateWindowSchema = z.object({ start: z.string().date(), end: z.string().date() }).strict();

export const demandEstimationRequestSchema = z.object({
  method: demandEstimationMethodSchema,
  records: z.array(freshRetailNetRecordSchema).max(366),
  datasetRevision: z.literal(freshRetailNetRevision),
  sourceSplit: z.literal('train'),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  storeId: z.number().int().safe().nonnegative(),
  skuId: z.number().int().safe().nonnegative(),
  sourceWindow: dateWindowSchema,
  asOf: z.string().date(),
  targetWindow: dateWindowSchema,
}).strict().superRefine((request, context) => {
  const issue = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
  if (request.sourceWindow.start > request.sourceWindow.end) issue(['sourceWindow'], 'Source window must be ordered');
  if (request.asOf < request.sourceWindow.end) issue(['asOf'], 'Forecast cutoff cannot precede the source window end');
  if (request.targetWindow.start <= request.asOf || request.targetWindow.start > request.targetWindow.end) {
    issue(['targetWindow'], 'Target window must begin after the forecast cutoff and be ordered');
  }
  const naturalKeys = new Set<string>();
  request.records.forEach((record, index) => {
    const source = record.source;
    const naturalKey = `${source.store_id}\u001f${source.product_id}\u001f${source.dt}`;
    if (record.datasetRevision !== request.datasetRevision || record.sourceSplit !== request.sourceSplit
      || source.store_id !== request.storeId || source.product_id !== request.skuId
      || source.dt < request.sourceWindow.start || source.dt > request.sourceWindow.end || source.dt > request.asOf) {
      issue(['records', index], 'Training row must match the pinned SKU, split, revision, source window and cutoff');
    }
    if (naturalKeys.has(naturalKey)) issue(['records', index], 'Training natural keys must be unique');
    naturalKeys.add(naturalKey);
  });
});

export const demandEstimateResultSchema = z.object({
  estimatorVersion: z.literal(DEMAND_ESTIMATION_VERSION),
  sourceKind: z.literal('DERIVED'),
  valueMeaning: z.literal('PROVIDER_NORMALIZED_SALE_AMOUNT'),
  method: demandEstimationMethodSchema,
  status: z.enum(['ESTIMATED', 'INSUFFICIENT_DATA', 'BLOCKED', 'NOT_COMPUTABLE']),
  value: z.number().finite().nullable(),
  inputRowCount: z.number().int().safe().nonnegative(),
  includedRowCount: z.number().int().safe().nonnegative(),
  datasetRevision: z.literal(freshRetailNetRevision),
  sourceSplit: z.literal('train'),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  storeId: z.number().int().safe().nonnegative(),
  skuId: z.number().int().safe().nonnegative(),
  sourceWindow: dateWindowSchema,
  asOf: z.string().date(),
  targetWindow: dateWindowSchema,
  reasonCode: z.enum(['NO_ELIGIBLE_TRAINING_ROWS', 'HOURLY_LABEL_SEMANTICS_UNVERIFIED', 'NUMERIC_OVERFLOW']).nullable(),
  assumptions: z.array(z.string().max(180)).max(4),
}).strict().superRefine((result, context) => {
  const estimated = result.status === 'ESTIMATED';
  if (estimated && (result.value === null || result.reasonCode !== null || result.includedRowCount === 0)
    || !estimated && (result.value !== null || result.reasonCode === null)) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Estimate status, value, sample count and reason must agree' });
  }
  if (result.includedRowCount > result.inputRowCount) {
    context.addIssue({ code: 'custom', path: ['includedRowCount'], message: 'Included rows cannot exceed input rows' });
  }
  if (result.status === 'BLOCKED' && (result.method !== 'HOURLY_AVAILABILITY_EXTRAPOLATION'
    || result.reasonCode !== 'HOURLY_LABEL_SEMANTICS_UNVERIFIED' || result.value !== null || result.includedRowCount !== 0)) {
    context.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Only the unverified hourly candidate may be blocked by label semantics' });
  }
  if (result.status === 'INSUFFICIENT_DATA' && (result.reasonCode !== 'NO_ELIGIBLE_TRAINING_ROWS' || result.includedRowCount !== 0)) {
    context.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Insufficient estimates require an explicit no-eligible-row reason' });
  }
  if (result.status === 'NOT_COMPUTABLE' && result.reasonCode !== 'NUMERIC_OVERFLOW') {
    context.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Non-computable estimates require an explicit numeric overflow reason' });
  }
});

export const forecastMetricResultSchema = z.object({
  status: z.enum(['CALCULATED', 'INSUFFICIENT_DATA', 'NOT_COMPUTABLE']),
  pairedRows: z.number().int().safe().nonnegative(),
  mae: z.number().finite().nonnegative().nullable(),
  wape: z.number().finite().nonnegative().nullable(),
  reasonCode: z.enum(['NO_VALID_PAIRED_ROWS', 'ZERO_ACTUAL_DENOMINATOR', 'INVALID_PAIR', 'NUMERIC_OVERFLOW']).nullable(),
}).strict().superRefine((result, context) => {
  if (result.status === 'CALCULATED' && (result.pairedRows === 0 || result.mae === null
    || (result.wape === null) !== (result.reasonCode === 'ZERO_ACTUAL_DENOMINATOR')
    || (result.wape !== null && result.reasonCode !== null))) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Calculated metrics require MAE and a defined or explicitly undefined WAPE' });
  }
  if (result.status === 'INSUFFICIENT_DATA' && (result.pairedRows !== 0 || result.mae !== null || result.wape !== null
    || result.reasonCode !== 'NO_VALID_PAIRED_ROWS')) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Empty paired samples require an explicit insufficient-data result' });
  }
  if (result.status === 'NOT_COMPUTABLE' && (result.mae !== null || result.wape !== null
    || !['INVALID_PAIR', 'NUMERIC_OVERFLOW'].includes(result.reasonCode ?? ''))) {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Invalid or overflowing metric inputs cannot carry calculated values' });
  }
});

export type ForecastMetricResult = z.infer<typeof forecastMetricResultSchema>;

export function summarizeNormalizedForecastMetrics(input: unknown): ForecastMetricResult {
  if (!Array.isArray(input)) {
    return forecastMetricResultSchema.parse({ status: 'NOT_COMPUTABLE', pairedRows: 0, mae: null, wape: null, reasonCode: 'INVALID_PAIR' });
  }
  const pairs = input as unknown[];
  if (pairs.length === 0) {
    return forecastMetricResultSchema.parse({ status: 'INSUFFICIENT_DATA', pairedRows: 0, mae: null, wape: null, reasonCode: 'NO_VALID_PAIRED_ROWS' });
  }
  let absoluteError = 0;
  let errorCompensation = 0;
  let absoluteActual = 0;
  let actualCompensation = 0;
  for (const pair of pairs) {
    if (typeof pair !== 'object' || pair === null) {
      return forecastMetricResultSchema.parse({ status: 'NOT_COMPUTABLE', pairedRows: pairs.length, mae: null, wape: null, reasonCode: 'INVALID_PAIR' });
    }
    const pairRecord = pair as Record<string, unknown>;
    const actualValue = pairRecord.actual;
    const forecastValue = pairRecord.forecast;
    if (typeof actualValue !== 'number' || !Number.isFinite(actualValue)
      || typeof forecastValue !== 'number' || !Number.isFinite(forecastValue)) {
      return forecastMetricResultSchema.parse({ status: 'NOT_COMPUTABLE', pairedRows: pairs.length, mae: null, wape: null, reasonCode: 'INVALID_PAIR' });
    }
    const error = Math.abs(actualValue - forecastValue);
    const adjustedError = error - errorCompensation;
    const nextError = absoluteError + adjustedError;
    errorCompensation = (nextError - absoluteError) - adjustedError;
    absoluteError = nextError;

    const actual = Math.abs(actualValue);
    const adjustedActual = actual - actualCompensation;
    const nextActual = absoluteActual + adjustedActual;
    actualCompensation = (nextActual - absoluteActual) - adjustedActual;
    absoluteActual = nextActual;
    if (!Number.isFinite(error) || !Number.isFinite(absoluteError) || !Number.isFinite(absoluteActual)) {
      return forecastMetricResultSchema.parse({ status: 'NOT_COMPUTABLE', pairedRows: pairs.length, mae: null, wape: null, reasonCode: 'NUMERIC_OVERFLOW' });
    }
  }
  const mae = absoluteError / pairs.length;
  const wape = absoluteActual === 0 ? null : absoluteError / absoluteActual;
  if (!Number.isFinite(mae) || wape !== null && !Number.isFinite(wape)) {
    return forecastMetricResultSchema.parse({ status: 'NOT_COMPUTABLE', pairedRows: pairs.length, mae: null, wape: null, reasonCode: 'NUMERIC_OVERFLOW' });
  }
  return forecastMetricResultSchema.parse({
    status: 'CALCULATED',
    pairedRows: pairs.length,
    mae,
    wape,
    reasonCode: wape === null ? 'ZERO_ACTUAL_DENOMINATOR' : null,
  });
}

export type DemandEstimationRequest = z.infer<typeof demandEstimationRequestSchema>;
export type DemandEstimateResult = z.infer<typeof demandEstimateResultSchema>;

/**
 * Computes one deterministic, one-step-per-target-window normalized baseline.
 * Source values keep the provider's normalized meaning; this does not infer physical units.
 */
export function estimateNormalizedDemand(input: DemandEstimationRequest): DemandEstimateResult {
  const parsed = demandEstimationRequestSchema.safeParse(input);
  if (!parsed.success) throw new TypeError(`Invalid demand estimation request: ${parsed.error.message}`);
  const request = parsed.data;
  const common = {
    estimatorVersion: DEMAND_ESTIMATION_VERSION,
    sourceKind: 'DERIVED' as const,
    valueMeaning: 'PROVIDER_NORMALIZED_SALE_AMOUNT' as const,
    method: request.method,
    inputRowCount: request.records.length,
    datasetRevision: request.datasetRevision,
    sourceSplit: request.sourceSplit,
    sourceSha256: request.sourceSha256,
    storeId: request.storeId,
    skuId: request.skuId,
    sourceWindow: request.sourceWindow,
    asOf: request.asOf,
    targetWindow: request.targetWindow,
  };

  if (request.method === 'HOURLY_AVAILABILITY_EXTRAPOLATION') {
    return demandEstimateResultSchema.parse({
      ...common,
      status: 'BLOCKED',
      value: null,
      includedRowCount: 0,
      reasonCode: 'HOURLY_LABEL_SEMANTICS_UNVERIFIED',
      assumptions: ['HOURS_STOCK_STATUS_POLARITY_AND_AVAILABLE_HOUR_SEMANTICS_NOT_VERIFIED'],
    });
  }

  const orderedRecords = [...request.records].sort((left, right) =>
    left.source.dt.localeCompare(right.source.dt)
      || left.source.product_id - right.source.product_id);
  const included = request.method === 'HISTORICAL_MEAN'
    ? orderedRecords
    : orderedRecords.filter((record) => record.source.stock_hour6_22_cnt === 0);
  if (included.length === 0) {
    return demandEstimateResultSchema.parse({
      ...common,
      status: 'INSUFFICIENT_DATA',
      value: null,
      includedRowCount: 0,
      reasonCode: 'NO_ELIGIBLE_TRAINING_ROWS',
      assumptions: ['NO_VALUE_IS_IMPUTED_FOR_MISSING_OR_INELIGIBLE_HISTORY'],
    });
  }

  let sum = 0;
  let compensation = 0;
  for (const record of included) {
    const adjusted = record.source.sale_amount - compensation;
    const next = sum + adjusted;
    compensation = (next - sum) - adjusted;
    sum = next;
  }
  const value = sum / included.length;
  if (!Number.isFinite(value)) {
    return demandEstimateResultSchema.parse({
      ...common,
      status: 'NOT_COMPUTABLE',
      value: null,
      includedRowCount: included.length,
      reasonCode: 'NUMERIC_OVERFLOW',
      assumptions: ['FINITE_SOURCE_VALUES_REQUIRED_FOR_SAFE_NORMALIZED_MEAN'],
    });
  }
  return demandEstimateResultSchema.parse({
    ...common,
    status: 'ESTIMATED',
    value,
    includedRowCount: included.length,
    reasonCode: null,
    assumptions: request.method === 'HISTORICAL_MEAN'
      ? ['ARITHMETIC_MEAN_OF_ALL_VALID_HISTORY_IN_SOURCE_WINDOW']
      : ['ARITHMETIC_MEAN_OF_ROWS_WITH_ZERO_REPORTED_OUT_OF_STOCK_HOURS; NOT A CAUSAL DEMAND RECOVERY'],
  });
}
