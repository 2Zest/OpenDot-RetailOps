import { describe, expect, it } from 'vitest';
import {
  assessSellability,
  batchSchema,
  dateOnlySchema,
  evidenceSchema,
  instantSchema,
  moneySchema,
  quantitySchema,
  stockBalanceSchema,
} from '../../src/domain/index.js';

describe('RETAIL-01 domain value boundaries', () => {
  it('accepts only explicit non-negative decimal quantities and unit codes', () => {
    expect(quantitySchema.safeParse({ value: '0', unitCode: 'fixture-unit' }).success).toBe(true);
    expect(quantitySchema.safeParse({ value: '12.375', unitCode: 'fixture-unit' }).success).toBe(true);
    expect(quantitySchema.safeParse({ value: '-1', unitCode: 'fixture-unit' }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: 1.25, unitCode: 'fixture-unit' }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: '1e2', unitCode: 'fixture-unit' }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: '1', unitCode: '' }).success).toBe(false);
  });

  it('requires explicit currency and precision without floating point money', () => {
    expect(moneySchema.safeParse({ minorUnits: '1234', currencyCode: 'USD', minorUnitScale: 2 }).success).toBe(true);
    expect(moneySchema.safeParse({ minorUnits: '1.25', currencyCode: 'USD', minorUnitScale: 2 }).success).toBe(false);
    expect(moneySchema.safeParse({ minorUnits: '125', currencyCode: 'usd', minorUnitScale: 2 }).success).toBe(false);
    expect(moneySchema.safeParse({ minorUnits: '125', currencyCode: 'USD' }).success).toBe(false);
  });

  it('validates calendar dates and requires an explicit known instant offset', () => {
    expect(dateOnlySchema.safeParse('2024-02-29').success).toBe(true);
    expect(dateOnlySchema.safeParse('2025-02-29').success).toBe(false);
    expect(dateOnlySchema.safeParse('2025-13-01').success).toBe(false);
    expect(instantSchema.safeParse('2025-01-01T09:00:00+08:00').success).toBe(true);
    expect(instantSchema.safeParse('2025-01-01T09:00:00').success).toBe(false);
    expect(instantSchema.safeParse('2025-01-01T09:00:00-00:00').success).toBe(false);
    expect(instantSchema.safeParse('2025-01-01T25:00:00Z').success).toBe(false);
  });

  it('checks physical inventory against non-negative, same-unit exclusive partitions exactly', () => {
    const balanced = {
      physicalOnHand: { value: '10.10', unitCode: 'fixture-unit' },
      unavailable: { value: '1.1', unitCode: 'fixture-unit' },
      availableToSell: { value: '8', unitCode: 'fixture-unit' },
      reserved: { value: '1', unitCode: 'fixture-unit' },
    };
    expect(stockBalanceSchema.safeParse(balanced).success).toBe(true);
    expect(stockBalanceSchema.safeParse({
      ...balanced,
      physicalOnHand: { value: '10.11', unitCode: 'fixture-unit' },
    }).success).toBe(false);
    expect(stockBalanceSchema.safeParse({
      ...balanced,
      reserved: { value: '-1', unitCode: 'fixture-unit' },
    }).success).toBe(false);
    expect(stockBalanceSchema.safeParse({
      ...balanced,
      reserved: { value: '1', unitCode: 'another-fixture-unit' },
    }).success).toBe(false);
  });

  it('refuses sellability when quality or expiry evidence is missing, unknown, or at the boundary', () => {
    const expiry = { basis: 'DATE_ONLY' as const, value: '2025-06-01', timeZone: 'UTC' };
    const beforeExpiry = { basis: 'DATE_ONLY' as const, value: '2025-05-31', timeZone: 'UTC' };
    expect(assessSellability({ expiry, asOf: beforeExpiry, qualityStatus: 'PASS' }).status).toBe('ELIGIBLE');
    expect(assessSellability({ expiry, asOf: beforeExpiry, qualityStatus: 'FAIL' }).status).toBe('BLOCKED');
    expect(assessSellability({ expiry, asOf: beforeExpiry, qualityStatus: 'UNKNOWN' }).status).toBe('UNRESOLVED');
    expect(assessSellability({
      expiry,
      asOf: { basis: 'DATE_ONLY', value: '2025-06-02', timeZone: 'UTC' },
      qualityStatus: 'PASS',
    }).status).toBe('BLOCKED');
    expect(assessSellability({ expiry, asOf: expiry, qualityStatus: 'PASS' })).toEqual({ status: 'UNRESOLVED', reason: 'EXPIRY_BOUNDARY' });
    expect(assessSellability({ expiry, qualityStatus: 'PASS' })).toEqual({ status: 'UNRESOLVED', reason: 'MISSING_INPUT' });
    expect(assessSellability({ expiry, asOf: { basis: 'INSTANT', value: '2025-05-31T00:00:00Z' }, qualityStatus: 'PASS' }).status).toBe('UNRESOLVED');
    expect(assessSellability({
      expiry,
      asOf: { basis: 'DATE_ONLY', value: '2025-05-31', timeZone: 'America/New_York' },
      qualityStatus: 'PASS',
    }).status).toBe('UNRESOLVED');
  });

  it('compares explicit instants with offsets without losing fractional precision', () => {
    const expiry = { basis: 'INSTANT' as const, value: '2025-01-01T00:00:00.1000Z' };
    expect(assessSellability({
      expiry,
      asOf: { basis: 'INSTANT', value: '2025-01-01T08:00:00.1+08:00' },
      qualityStatus: 'PASS',
    }).status).toBe('UNRESOLVED');
    expect(assessSellability({
      expiry,
      asOf: { basis: 'INSTANT', value: '2024-12-31T23:59:59.999999999Z' },
      qualityStatus: 'PASS',
    }).status).toBe('ELIGIBLE');
  });

  it('requires source-specific provenance for evidence', () => {
    const common = {
      contractVersion: '0.1.0',
      id: 'fixture-evidence',
      snapshotId: 'fixture-snapshot',
      locator: 'fixture-row:1',
      observedAt: '2025-01-01T00:00:00Z',
    };
    expect(evidenceSchema.safeParse({
      ...common,
      sourceKind: 'PUBLIC_HISTORICAL',
      sourceName: 'fixture-source',
      sourceRevision: 'fixture-revision',
    }).success).toBe(true);
    expect(evidenceSchema.safeParse({
      ...common,
      sourceKind: 'DERIVED',
      parentEvidenceIds: ['fixture-parent'],
      methodVersion: 'fixture-method-v1',
    }).success).toBe(true);
    expect(evidenceSchema.safeParse({
      ...common,
      sourceKind: 'DERIVED',
      parentEvidenceIds: [],
      methodVersion: 'fixture-method-v1',
    }).success).toBe(false);
    expect(evidenceSchema.safeParse({
      ...common,
      sourceKind: 'SIMULATED',
      scenarioId: 'fixture-scenario',
      seed: 'fixture-seed',
      generatorVersion: 'fixture-generator-v1',
    }).success).toBe(true);
  });

  it('requires explicit batch quality, expiry, stock partitions, and evidence reference', () => {
    const batch = {
      contractVersion: '0.1.0',
      id: 'fixture-batch',
      productId: 'fixture-product',
      expiry: { basis: 'DATE_ONLY', value: '2025-06-01', timeZone: 'UTC' },
      qualityStatus: 'UNKNOWN',
      stockBalance: {
        physicalOnHand: { value: '1', unitCode: 'fixture-unit' },
        unavailable: { value: '1', unitCode: 'fixture-unit' },
        availableToSell: { value: '0', unitCode: 'fixture-unit' },
        reserved: { value: '0', unitCode: 'fixture-unit' },
      },
      evidenceIds: ['fixture-evidence'],
    };
    expect(batchSchema.safeParse(batch).success).toBe(true);
    expect(batchSchema.safeParse({ ...batch, evidenceIds: [] }).success).toBe(false);
    expect(batchSchema.safeParse({ ...batch, expiry: { basis: 'DATE_ONLY', value: '2025-06-01' } }).success).toBe(false);
  });
});
