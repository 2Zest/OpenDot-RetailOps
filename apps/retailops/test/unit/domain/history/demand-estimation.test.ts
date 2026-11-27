import { describe, expect, it } from 'vitest';
import {
  demandEstimationRequestSchema,
  demandEstimateResultSchema,
  estimateNormalizedDemand,
  summarizeNormalizedForecastMetrics,
} from '../../../../src/domain/history/demand-estimation.js';
import {
  freshRetailNetDataset,
  freshRetailNetLicense,
  freshRetailNetRevision,
  type FreshRetailNetRecord,
} from '../../../../src/domain/history/fresh-retailnet-record.js';

const sourceHash = 'a'.repeat(64);

function record(date: string, saleAmount: number, outOfStockHours = 0): FreshRetailNetRecord {
  const hoursStockStatus = Array.from({ length: 24 }, (_, hour) =>
    hour >= 6 && hour < 6 + outOfStockHours ? 1 as const : 0 as const);
  return {
    contractVersion: '0.3.0',
    dataset: freshRetailNetDataset,
    datasetRevision: freshRetailNetRevision,
    license: freshRetailNetLicense,
    sourceSplit: 'train',
    source: {
      city_id: 1,
      store_id: 0,
      management_group_id: 1,
      first_category_id: 1,
      second_category_id: 1,
      third_category_id: 1,
      product_id: 42,
      dt: date,
      sale_amount: saleAmount,
      hours_sale: Array.from({ length: 24 }, () => 0),
      stock_hour6_22_cnt: outOfStockHours,
      hours_stock_status: hoursStockStatus,
      discount: 0,
      holiday_flag: 0,
      activity_flag: 0,
      precpt: 0,
      avg_temperature: 20,
      avg_humidity: 50,
      avg_wind_level: 1,
    },
  };
}

function request(method: 'HISTORICAL_MEAN' | 'NO_STOCKOUT_DAY_MEAN' | 'HOURLY_AVAILABILITY_EXTRAPOLATION', records: FreshRetailNetRecord[]) {
  return {
    method,
    records,
    datasetRevision: freshRetailNetRevision,
    sourceSplit: 'train' as const,
    sourceSha256: sourceHash,
    storeId: 0,
    skuId: 42,
    sourceWindow: { start: '2024-03-28', end: '2024-03-29' },
    asOf: '2024-03-29',
    targetWindow: { start: '2024-03-30', end: '2024-04-05' },
  };
}

describe('RETAIL-05F normalized demand estimators', () => {
  it('computes a deterministic arithmetic mean without converting source units', () => {
    const rows = [record('2024-03-29', 2.5), record('2024-03-28', 1.5)];
    const input = request('HISTORICAL_MEAN', rows);

    const first = estimateNormalizedDemand(input);
    const second = estimateNormalizedDemand({ ...input, records: [...rows].reverse() });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'ESTIMATED',
      value: 2,
      valueMeaning: 'PROVIDER_NORMALIZED_SALE_AMOUNT',
      sourceKind: 'DERIVED',
      inputRowCount: 2,
      includedRowCount: 2,
      sourceSplit: 'train',
    });
  });

  it('reports actual input coverage separately from the caller-declared fixed snapshot digest', () => {
    const result = estimateNormalizedDemand(request('HISTORICAL_MEAN', [
      record('2024-03-28', 1.5),
      record('2024-03-29', 2.5),
    ]));

    expect(result).toMatchObject({
      status: 'ESTIMATED',
      sourceSha256: sourceHash,
      sourceDigestScope: 'CALLER_DECLARED_FIXED_SNAPSHOT_SUMMARY',
      inputRowCount: 2,
      sourceWindow: { start: '2024-03-28', end: '2024-03-29' },
      sourceCoverage: {
        declaredDateCount: 2,
        observedDateCount: 2,
        coverageRate: 1,
        actualWindow: { start: '2024-03-28', end: '2024-03-29' },
        missingDates: [],
      },
    });
  });

  it('returns incomplete coverage and does not estimate across a missing date', () => {
    const incomplete = estimateNormalizedDemand({
      ...request('HISTORICAL_MEAN', [record('2024-03-28', 1), record('2024-03-30', 3)]),
      sourceWindow: { start: '2024-03-28', end: '2024-03-30' },
      asOf: '2024-03-30',
      targetWindow: { start: '2024-03-31', end: '2024-04-01' },
    });

    expect(incomplete).toMatchObject({
      status: 'INSUFFICIENT_DATA',
      value: null,
      inputRowCount: 2,
      includedRowCount: 0,
      reasonCode: 'INCOMPLETE_SOURCE_WINDOW',
      sourceCoverage: {
        declaredDateCount: 3,
        observedDateCount: 2,
        coverageRate: 2 / 3,
        actualWindow: { start: '2024-03-28', end: '2024-03-30' },
        missingDates: ['2024-03-29'],
      },
    });
  });

  it('does not report a short input subset as a complete 76-day training window', () => {
    const shortSequence = estimateNormalizedDemand({
      ...request('HISTORICAL_MEAN', [record('2024-03-28', 9)]),
      sourceWindow: { start: '2024-03-28', end: '2024-06-11' },
      asOf: '2024-06-11',
      targetWindow: { start: '2024-06-12', end: '2024-06-25' },
    });

    expect(shortSequence).toMatchObject({
      status: 'INSUFFICIENT_DATA',
      value: null,
      inputRowCount: 1,
      includedRowCount: 0,
      reasonCode: 'INCOMPLETE_SOURCE_WINDOW',
      sourceWindow: { start: '2024-03-28', end: '2024-06-11' },
      sourceCoverage: {
        declaredDateCount: 76,
        observedDateCount: 1,
        coverageRate: 1 / 76,
        actualWindow: { start: '2024-03-28', end: '2024-03-28' },
      },
    });
    expect(shortSequence.sourceCoverage.missingDates).toHaveLength(75);
    expect(shortSequence.sourceCoverage.missingDates[0]).toBe('2024-03-29');
    expect(shortSequence.sourceCoverage.missingDates.at(-1)).toBe('2024-06-11');
  });

  it('uses only reported zero-out-of-stock-hour rows for the conditional mean', () => {
    const estimate = estimateNormalizedDemand(request('NO_STOCKOUT_DAY_MEAN', [
      record('2024-03-28', 3),
      record('2024-03-29', 99, 2),
    ]));

    expect(estimate).toMatchObject({ status: 'ESTIMATED', value: 3, inputRowCount: 2, includedRowCount: 1 });
    expect(estimate.assumptions[0]).toContain('NOT A CAUSAL DEMAND RECOVERY');
  });

  it('returns structured insufficient-data status instead of imputing an estimate', () => {
    const estimate = estimateNormalizedDemand(request('NO_STOCKOUT_DAY_MEAN', [record('2024-03-28', 99, 1)]));
    expect(estimate).toMatchObject({ status: 'INSUFFICIENT_DATA', value: null, includedRowCount: 0, reasonCode: 'NO_ELIGIBLE_TRAINING_ROWS' });
    expect(estimateNormalizedDemand(request('HISTORICAL_MEAN', []))).toMatchObject({ status: 'INSUFFICIENT_DATA', value: null, includedRowCount: 0 });
  });

  it('blocks hourly extrapolation while the source label polarity remains unverified', () => {
    const estimate = estimateNormalizedDemand(request('HOURLY_AVAILABILITY_EXTRAPOLATION', [record('2024-03-28', 3)]));
    expect(estimate).toMatchObject({ status: 'BLOCKED', value: null, includedRowCount: 0, reasonCode: 'HOURLY_LABEL_SEMANTICS_UNVERIFIED' });
  });

  it('rejects duplicate natural keys and target leakage into the training request', () => {
    const duplicate = record('2024-03-28', 1);
    expect(demandEstimationRequestSchema.safeParse(request('HISTORICAL_MEAN', [duplicate, duplicate])).success).toBe(false);

    const leaked = record('2024-03-30', 7);
    expect(demandEstimationRequestSchema.safeParse(request('HISTORICAL_MEAN', [leaked])).success).toBe(false);
  });

  it('rejects internally inconsistent estimate status and precision metadata', () => {
    const result = estimateNormalizedDemand(request('HISTORICAL_MEAN', [record('2024-03-28', 1)]));
    const malformed = { ...result, status: 'ESTIMATED' as const, value: null };
    expect(demandEstimateResultSchema.safeParse(malformed).success).toBe(false);
  });

  it('reports empty pairs and zero WAPE denominators explicitly', () => {
    expect(summarizeNormalizedForecastMetrics([])).toEqual({
      status: 'INSUFFICIENT_DATA', pairedRows: 0, mae: null, wape: null, reasonCode: 'NO_VALID_PAIRED_ROWS',
    });
    const zeroActual = summarizeNormalizedForecastMetrics([
      { actual: 0, forecast: 2 },
      { actual: 0, forecast: 0 },
    ]);
    expect(zeroActual).toEqual({
      status: 'CALCULATED', pairedRows: 2, mae: 1, wape: null, reasonCode: 'ZERO_ACTUAL_DENOMINATOR',
    });
    expect(summarizeNormalizedForecastMetrics([{ actual: Number.NaN, forecast: 1 }])).toMatchObject({ status: 'NOT_COMPUTABLE', reasonCode: 'INVALID_PAIR', mae: null, wape: null });
  });
});
