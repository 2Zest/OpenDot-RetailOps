import { describe, expect, it } from 'vitest';
import { singleSkuScenarioFixture, simulationFixtureReferences, validMarkdownCandidate } from '../../../fixtures/simulation/single-sku-scenario.js';
import { simulateSingleSku, singleSkuSimulationResultSchema } from '../../../../src/domain/simulation/simulator.js';

const source = (reference: string, scenarioVersion: string = simulationFixtureReferences.scenarioVersion) => ({
  sourceKind: 'SIMULATED',
  reference,
  scenarioId: simulationFixtureReferences.scenarioId,
  scenarioVersion,
});
const day = (value: string) => ({ basis: 'DATE_ONLY' as const, value, timeZone: 'UTC' });
const qty = (value: string) => ({ value, unitCode: simulationFixtureReferences.unitCode });

function event(kind: 'DEMAND' | 'ARRIVAL' | 'DISPOSAL', eventId: string, sequence: number, at: string, value: string) {
  return { kind, eventId, sequence, at: day(at), quantity: qty(value), source: source(`fixture-${eventId}`) };
}

function priceAction(eventId: string, sequence: number, at: string, calculation: unknown = validMarkdownCandidate()) {
  return {
    kind: 'PRICE_ACTION',
    eventId,
    sequence,
    at: day(at),
    productId: simulationFixtureReferences.productId,
    batchId: simulationFixtureReferences.batchId,
    policyId: simulationFixtureReferences.policyId,
    policyRevision: simulationFixtureReferences.policyRevision,
    candidateOrdinal: 0,
    calculation,
    source: source(`fixture-${eventId}`),
  };
}

describe('RETAIL-03 deterministic single-SKU simulator', () => {
  it('requires explicit simulated scenario inputs and replays the same event ledger exactly', () => {
    const input = singleSkuScenarioFixture();
    input.events = [event('DEMAND', 'demand-1', 1, '2026-11-28', '2.25')];

    const first = simulateSingleSku(input);
    const second = simulateSingleSku(input);

    expect(first).toEqual(second);
    expect(first.status).toBe('COMPLETED');
    if (first.status === 'COMPLETED') {
      expect(first.sourceKind).toBe('SIMULATED');
      expect(first.scenario.seed).toBe(17);
      expect(first.events.every((item) => item.source.sourceKind === 'SIMULATED')).toBe(true);
      expect(first.metrics.simulatedSoldQty.value).toBe('2.25');
      expect(first.metrics.endingStock.physicalOnHand.value).toBe('7.75');
      expect(first.executionAuthority).toBe('NONE');
      expect(first.businessApproval).toBe('NOT_GRANTED');
    }
  });

  it('conserves stock while keeping unmet demand, sales, spoilage, and ending stock separate', () => {
    const input = singleSkuScenarioFixture();
    input.events = [
      event('ARRIVAL', 'arrival-1', 1, '2026-11-28', '3'),
      event('DEMAND', 'demand-1', 2, '2026-11-28', '10'),
      event('DISPOSAL', 'spoilage-1', 3, '2026-11-28', '2'),
      event('DEMAND', 'demand-2', 4, '2026-11-29', '5'),
    ];

    const result = simulateSingleSku(input);
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      expect(result.metrics.totalArrivedQty.value).toBe('3');
      expect(result.metrics.totalDemandQty.value).toBe('15');
      expect(result.metrics.simulatedSoldQty.value).toBe('11');
      expect(result.metrics.unmetDemandQty.value).toBe('4');
      expect(result.metrics.simulatedSpoilageQty.value).toBe('2');
      expect(result.metrics.unsoldPhysicalQty.value).toBe('0');
      expect(result.metrics.endingStock.physicalOnHand.value).toBe('0');
      expect(result.metrics.simulatedSpoilageCostExposure).toEqual({ minorUnits: '1000', currencyCode: 'CNY', minorUnitScale: 2 });
    }
  });

  it('rejects disposal beyond physical stock without creating a negative balance', () => {
    const input = singleSkuScenarioFixture();
    input.events = [event('DISPOSAL', 'too-much-loss', 1, '2026-11-28', '10.01')];

    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') {
      expect(result.events.at(-1)?.outcome).toBe('REJECTED');
      expect(result.events.at(-1)?.reasonCodes).toEqual(['INSUFFICIENT_PHYSICAL_STOCK']);
      expect(result.events.at(-1)?.stockAfter.physicalOnHand.value).toBe('10');
    }
  });

  it('does not count expiry stop-sale as physical disposal and blocks same-time sales first', () => {
    const input = singleSkuScenarioFixture();
    input.batch.expiry = { basis: 'DATE_ONLY', value: '2026-11-28', timeZone: 'UTC' };
    input.events = [event('DEMAND', 'at-expiry', 1, '2026-11-28', '3')];

    const result = simulateSingleSku(input);
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      const expiryEvent = result.events.find((item) => item.kind === 'EXPIRY_STOP_SALE');
      const demandEvent = result.events.find((item) => item.eventId === 'at-expiry');
      expect(expiryEvent).toBeDefined();
      expect(expiryEvent?.stockBefore.physicalOnHand).toEqual(expiryEvent?.stockAfter.physicalOnHand);
      expect(expiryEvent?.stockBefore.availableToSell.value).toBe('10');
      expect(expiryEvent?.stockAfter.availableToSell.value).toBe('0');
      expect(expiryEvent?.stockAfter.unavailable.value).toBe('10');
      expect(demandEvent?.soldQty.value).toBe('0');
      expect(demandEvent?.unmetDemandQty.value).toBe('3');
      expect(result.metrics.simulatedSpoilageQty.value).toBe('0');
      expect(result.metrics.unsoldPhysicalQty.value).toBe('10');
    }
  });

  it('fails closed for FAIL and UNKNOWN quality without inventing sales', () => {
    for (const qualityStatus of ['FAIL', 'UNKNOWN'] as const) {
      const input = singleSkuScenarioFixture();
      input.batch.qualityStatus = qualityStatus;
      input.batch.stockBalance = {
        physicalOnHand: qty('4'), unavailable: qty('4'), availableToSell: qty('0'), reserved: qty('0'),
      };
      input.events = [event('DEMAND', `demand-${qualityStatus}`, 1, '2026-11-28', '4')];

      const result = simulateSingleSku(input);
      expect(result.status).toBe('COMPLETED');
      if (result.status === 'COMPLETED') {
        expect(result.metrics.simulatedSoldQty.value).toBe('0');
        expect(result.metrics.unmetDemandQty.value).toBe('4');
        expect(result.metrics.endingStock.physicalOnHand.value).toBe('4');
      }
    }
  });

  it('rejects duplicate event IDs, duplicate ordering values, negative inventory inputs, and unbound sources', () => {
    const base = singleSkuScenarioFixture();
    const duplicateId = singleSkuScenarioFixture();
    duplicateId.events = [
      event('DEMAND', 'same-id', 1, '2026-11-28', '1'),
      event('ARRIVAL', 'same-id', 2, '2026-11-28', '1'),
    ];
    const duplicateSequence = singleSkuScenarioFixture();
    duplicateSequence.events = [
      event('DEMAND', 'd-1', 1, '2026-11-28', '1'),
      event('ARRIVAL', 'a-1', 1, '2026-11-28', '1'),
    ];
    const negative = singleSkuScenarioFixture();
    negative.events = [event('DEMAND', 'negative-demand', 1, '2026-11-28', '-1')];
    const wrongSource = singleSkuScenarioFixture();
    wrongSource.events = [{ ...event('DEMAND', 'wrong-source', 1, '2026-11-28', '1'), source: source('other-version', 'other-version') }];

    for (const invalid of [duplicateId, duplicateSequence, negative, wrongSource, { ...base, batch: { ...base.batch, stockBalance: { ...base.batch.stockBalance, availableToSell: qty('-1') } } }]) {
      expect(() => simulateSingleSku(invalid)).not.toThrow();
      expect(simulateSingleSku(invalid).status).toBe('NOT_COMPUTABLE');
    }
  });

  it('applies only a validated RETAIL-05P candidate at its effective sequence and simulation time', () => {
    const input = singleSkuScenarioFixture();
    const postSaleBatch = {
      ...input.batch,
      stockBalance: { ...input.batch.stockBalance, physicalOnHand: qty('9'), availableToSell: qty('9') },
    };
    input.events = [
      event('DEMAND', 'before-price', 1, '2026-11-28', '1'),
      priceAction('markdown-1', 2, '2026-11-29', validMarkdownCandidate({ batch: postSaleBatch })),
      event('DEMAND', 'after-price', 3, '2026-11-29', '1'),
    ];

    const result = simulateSingleSku(input);
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      expect(result.metrics.simulatedRevenue).toEqual({ minorUnits: '1350', currencyCode: 'CNY', minorUnitScale: 2 });
      expect(result.events.find((item) => item.eventId === 'before-price')?.priceAfter).toEqual({ minorUnits: '700', currencyCode: 'CNY', minorUnitScale: 2 });
      expect(result.events.find((item) => item.eventId === 'markdown-1')?.priceCandidate).toMatchObject({ policyRevision: simulationFixtureReferences.policyRevision, candidateOrdinal: 0 });
      expect(result.events.find((item) => item.eventId === 'after-price')?.priceAfter).toEqual({ minorUnits: '650', currencyCode: 'CNY', minorUnitScale: 2 });
    }
  });

  it('rejects candidate calculations from another policy, batch, product, scenario, or a stale time', () => {
    const mutations: Array<(candidate: ReturnType<typeof validMarkdownCandidate>) => unknown> = [
      (candidate) => ({ ...candidate, inputSnapshot: { ...candidate.inputSnapshot!, policy: { ...candidate.inputSnapshot!.policy, revision: 'other-revision' } } }),
      (candidate) => ({ ...candidate, inputSnapshot: { ...candidate.inputSnapshot!, batch: { ...candidate.inputSnapshot!.batch, id: 'other-batch' }, batchId: 'other-batch' } }),
      (candidate) => ({ ...candidate, inputSnapshot: { ...candidate.inputSnapshot!, scenario: { ...candidate.inputSnapshot!.scenario, version: 'other-scenario-version' } } }),
    ];
    for (const mutate of mutations) {
      const input = singleSkuScenarioFixture();
      input.events = [priceAction('bad-price', 1, '2026-11-28', mutate(validMarkdownCandidate()))];
      const result = simulateSingleSku(input);
      expect(result.status).toBe('REJECTED');
      if (result.status === 'REJECTED') expect(result.events.at(-1)?.outcome).toBe('REJECTED');
    }
    const stale = validMarkdownCandidate();
    if (stale.status === 'CALCULATED' && stale.inputSnapshot !== null) {
      const staleInput = { ...stale.inputSnapshot, asOf: day('2026-11-29') };
      const input = singleSkuScenarioFixture();
      input.events = [priceAction('stale-price', 1, '2026-11-28', { ...stale, inputSnapshot: { ...stale.inputSnapshot, inputSnapshot: { ...stale.inputSnapshot.inputSnapshot, asOf: staleInput.asOf }, asOf: staleInput.asOf } })];
      expect(simulateSingleSku(input).status).toBe('REJECTED');
    }
  });

  it('rejects a same-ID candidate whose stock snapshot differs from the current stock', () => {
    const base = singleSkuScenarioFixture();
    const changedInventoryBatch = {
      ...base.batch,
      stockBalance: { ...base.batch.stockBalance, physicalOnHand: qty('9'), availableToSell: qty('9') },
    };
    const input = singleSkuScenarioFixture();
    input.events = [priceAction('stale-stock', 1, '2026-11-28', validMarkdownCandidate({ batch: changedInventoryBatch }))];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_CANDIDATE_STALE');
  });

  it('rejects a same-ID candidate whose base price differs from the active price', () => {
    const input = singleSkuScenarioFixture();
    input.events = [priceAction('stale-price', 1, '2026-11-28', validMarkdownCandidate({ basePriceMinorUnits: '650' }))];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_CANDIDATE_STALE');
  });

  it('rejects a same-ID candidate whose unit cost differs from the simulation', () => {
    const input = singleSkuScenarioFixture();
    input.events = [priceAction('stale-cost', 1, '2026-11-28', validMarkdownCandidate({ unitCostMinorUnits: '450' }))];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_CANDIDATE_STALE');
  });

  it('rejects a candidate whose batch unit differs from the simulated product unit', () => {
    const base = singleSkuScenarioFixture();
    const candidateBatch = {
      ...base.batch,
      stockBalance: {
        physicalOnHand: { ...base.batch.stockBalance.physicalOnHand, unitCode: 'KG' },
        unavailable: { ...base.batch.stockBalance.unavailable, unitCode: 'KG' },
        availableToSell: { ...base.batch.stockBalance.availableToSell, unitCode: 'KG' },
        reserved: { ...base.batch.stockBalance.reserved, unitCode: 'KG' },
      },
    };
    const input = singleSkuScenarioFixture();
    input.events = [priceAction('wrong-unit-candidate', 1, '2026-11-28', validMarkdownCandidate({ batch: candidateBatch }))];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
  });

  it('rechecks candidate stock after earlier simulated sales in the same run', () => {
    const input = singleSkuScenarioFixture();
    input.events = [
      event('DEMAND', 'before-candidate', 1, '2026-11-28', '1'),
      priceAction('candidate-after-sale', 2, '2026-11-28', validMarkdownCandidate()),
    ];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_CANDIDATE_STALE');
  });

  it('rejects a candidate after its declared effective simulation window', () => {
    const input = singleSkuScenarioFixture();
    input.scenario.horizon.end = day('2027-01-02');
    input.events = [priceAction('outside-candidate-window', 1, '2026-11-29', validMarkdownCandidate({ simulationWindowEnd: '2026-11-28' }))];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_CANDIDATE_STALE');
  });

  it('returns structured schema errors for result decimals outside declared precision', () => {
    const output = simulateSingleSku(singleSkuScenarioFixture());
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;
    const malformed = structuredClone(output);
    malformed.metrics.simulatedSoldQty.value = '0.1';

    expect(() => singleSkuSimulationResultSchema.safeParse(malformed)).not.toThrow();
    expect(singleSkuSimulationResultSchema.safeParse(malformed).success).toBe(false);
  });

  it('rejects an event stock transition that breaks ledger continuity', () => {
    const input = singleSkuScenarioFixture();
    input.events = [event('DEMAND', 'ledger-demand', 1, '2026-11-28', '2')];
    const output = simulateSingleSku(input);
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;

    const brokenTransition = structuredClone(output);
    brokenTransition.events[0]!.stockAfter.physicalOnHand.value = '9';
    brokenTransition.events[0]!.stockAfter.availableToSell.value = '9';
    expect(singleSkuSimulationResultSchema.safeParse(brokenTransition).success).toBe(false);
  });

  it('rejects summary demand totals that disagree with event quantities', () => {
    const input = singleSkuScenarioFixture();
    input.events = [event('DEMAND', 'ledger-demand-summary', 1, '2026-11-28', '2')];
    const output = simulateSingleSku(input);
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;
    const brokenSummary = structuredClone(output);
    brokenSummary.metrics.totalDemandQty.value = '3';
    brokenSummary.metrics.unmetDemandQty.value = '1';
    expect(singleSkuSimulationResultSchema.safeParse(brokenSummary).success).toBe(false);
  });

  it('rejects revenue and contribution tampering that disagrees with ledger totals', () => {
    const input = singleSkuScenarioFixture();
    input.events = [event('DEMAND', 'ledger-revenue', 1, '2026-11-28', '2')];
    const output = simulateSingleSku(input);
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;
    const brokenRevenue = structuredClone(output);
    brokenRevenue.metrics.simulatedRevenue.minorUnits = (BigInt(brokenRevenue.metrics.simulatedRevenue.minorUnits) + 100n).toString();
    brokenRevenue.metrics.simulatedContribution.minorUnits = (BigInt(brokenRevenue.metrics.simulatedContribution.minorUnits) + 100n).toString();
    expect(singleSkuSimulationResultSchema.safeParse(brokenRevenue).success).toBe(false);
  });

  it('rejects duplicate ledger identity and isolated event cost or exposure tampering', () => {
    const input = singleSkuScenarioFixture();
    input.events = [
      event('DEMAND', 'ledger-demand-cost', 1, '2026-11-28', '2'),
      event('DISPOSAL', 'ledger-disposal-exposure', 2, '2026-11-28', '1'),
    ];
    const output = simulateSingleSku(input);
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;

    const duplicateId = structuredClone(output);
    duplicateId.events[1]!.eventId = duplicateId.events[0]!.eventId;
    expect(singleSkuSimulationResultSchema.safeParse(duplicateId).success).toBe(false);

    const changedCost = structuredClone(output);
    changedCost.events[0]!.directProductCost.minorUnits = (BigInt(changedCost.events[0]!.directProductCost.minorUnits) + 1n).toString();
    expect(singleSkuSimulationResultSchema.safeParse(changedCost).success).toBe(false);

    const changedExposure = structuredClone(output);
    changedExposure.events[1]!.simulatedSpoilageCostExposure.minorUnits = (BigInt(changedExposure.events[1]!.simulatedSpoilageCostExposure.minorUnits) + 1n).toString();
    expect(singleSkuSimulationResultSchema.safeParse(changedExposure).success).toBe(false);
  });

  it('rejects oversized result decimals without leaking BigInt or precision exceptions', () => {
    const output = simulateSingleSku(singleSkuScenarioFixture());
    expect(output.status).toBe('COMPLETED');
    if (output.status !== 'COMPLETED') return;
    const oversized = structuredClone(output);
    oversized.metrics.simulatedSoldQty.value = '9'.repeat(301);

    expect(() => singleSkuSimulationResultSchema.safeParse(oversized)).not.toThrow();
    expect(singleSkuSimulationResultSchema.safeParse(oversized).success).toBe(false);
  });

  it('retains exact decimal quantity and money precision without floating-point arithmetic', () => {
    const input = singleSkuScenarioFixture();
    input.batch.stockBalance = {
      physicalOnHand: qty('10.25'), unavailable: qty('0'), availableToSell: qty('10.25'), reserved: qty('0'),
    };
    input.events = [
      event('ARRIVAL', 'fractional-arrival', 1, '2026-11-28', '0.125'),
      event('DEMAND', 'fractional-sale', 2, '2026-11-28', '0.375'),
    ];

    const result = simulateSingleSku(input);
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      expect(result.precision).toEqual({ quantityScale: 3, moneyInputScale: 2, moneyOutputScale: 5 });
      expect(result.metrics.simulatedSoldQty.value).toBe('0.375');
      expect(result.metrics.endingStock.physicalOnHand.value).toBe('10');
      expect(result.metrics.simulatedRevenue).toEqual({ minorUnits: '262500', currencyCode: 'CNY', minorUnitScale: 5 });
      expect(result.metrics.simulatedDirectProductCost).toEqual({ minorUnits: '187500', currencyCode: 'CNY', minorUnitScale: 5 });
      expect(result.metrics.simulatedContribution).toEqual({ minorUnits: '75000', currencyCode: 'CNY', minorUnitScale: 5 });
    }
  });

  it('requires a candidate to remain before expiry and never grants execution permission', () => {
    const input = singleSkuScenarioFixture();
    input.batch.expiry = { basis: 'DATE_ONLY', value: '2026-11-28', timeZone: 'UTC' };
    input.events = [priceAction('at-expiry-price', 1, '2026-11-29')];
    const result = simulateSingleSku(input);
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') {
      expect(result.events.at(-1)?.reasonCodes).toContain('PRICE_ACTION_BATCH_NOT_SELLABLE');
      expect(result.executionAuthority).toBe('NONE');
      expect(result.businessApproval).toBe('NOT_GRANTED');
    }
  });

  it('orders RFC 3339 instants by UTC offset rather than their local timestamp text', () => {
    const fixture = singleSkuScenarioFixture();
    const input = {
      ...fixture,
      batch: { ...fixture.batch, expiry: { basis: 'INSTANT' as const, value: '2026-11-29T00:00:00Z' } },
      scenario: {
        ...fixture.scenario,
        clock: { basis: 'INSTANT' as const, value: '2026-11-27T00:00:00Z' },
        horizon: {
          start: { basis: 'INSTANT' as const, value: '2026-11-27T00:00:00Z' },
          end: { basis: 'INSTANT' as const, value: '2026-11-30T00:00:00Z' },
        },
      },
      events: [{
        kind: 'DEMAND', eventId: 'offset-demand', sequence: 1,
        at: { basis: 'INSTANT' as const, value: '2026-11-28T19:30:00-05:00' },
        quantity: qty('1'), source: source('fixture-offset-demand'),
      }],
    };

    const result = simulateSingleSku(input);
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      expect(result.events.map((item) => item.kind)).toEqual(['EXPIRY_STOP_SALE', 'DEMAND']);
      expect(result.events[1]?.soldQty.value).toBe('0');
      expect(result.events[1]?.unmetDemandQty.value).toBe('1');
      expect(result.metrics.endingStock.physicalOnHand.value).toBe('10');
    }
  });
});
