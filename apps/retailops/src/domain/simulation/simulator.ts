import { z } from 'zod';
import { markdownCalculationResultSchema } from '../decision/markdown-calculation.js';
import type { MarkdownCalculationResult } from '../decision/markdown-calculation.js';
import { assessSellability, asOfSchema } from '../expiry/expiry.js';
import { batchSchema } from '../inventory/batch.js';
import { policySchema } from '../policy/policy.js';
import { productSchema } from '../product/product.js';
import {
  compareDateOnly,
  compareInstants,
  contractVersionSchema,
  decimalParts,
  decimalScale,
  decimalToScaledInteger,
  moneySchema,
  opaqueReferenceSchema,
  quantitySchema,
} from '../shared/primitives.js';

export const SINGLE_SKU_SIMULATOR_VERSION = 'retailops.single-sku-simulation/0.1.0' as const;

// These bounds only cap input size and BigInt work. They are not business limits.
const MAX_DIGITS = 128;
const MAX_SCALE = 18;
const MAX_EVENTS = 2_048;
const MAX_TREE_NODES = 50_000;
const MAX_TREE_DEPTH = 32;
const MAX_TEXT_LENGTH = 262_144;
const MAX_OUTPUT_DIGITS = 300;

const simulationSourceSchema = z.object({
  sourceKind: z.literal('SIMULATED'),
  reference: opaqueReferenceSchema,
  scenarioId: opaqueReferenceSchema,
  scenarioVersion: opaqueReferenceSchema,
}).strict();

const nonNegativeMoneyInputSchema = moneySchema.superRefine((money, context) => {
  if (typeof money.minorUnits !== 'string' || !/^-?(?:0|[1-9]\d*)$/.test(money.minorUnits)) return;
  if (money.minorUnits.replace('-', '').length > MAX_DIGITS || money.minorUnitScale > MAX_SCALE) return;
  if (BigInt(money.minorUnits) < 0n) context.addIssue({ code: 'custom', path: ['minorUnits'], message: 'Simulation prices and costs must be non-negative' });
});

const eventBase = {
  eventId: opaqueReferenceSchema,
  sequence: z.number().int().nonnegative().safe(),
  at: asOfSchema,
  source: simulationSourceSchema,
};

const simulationEventSchema = z.discriminatedUnion('kind', [
  z.object({ ...eventBase, kind: z.literal('DEMAND'), quantity: quantitySchema }).strict(),
  z.object({ ...eventBase, kind: z.literal('ARRIVAL'), quantity: quantitySchema }).strict(),
  z.object({ ...eventBase, kind: z.literal('DISPOSAL'), quantity: quantitySchema }).strict(),
  z.object({
    ...eventBase,
    kind: z.literal('PRICE_ACTION'),
    productId: opaqueReferenceSchema,
    batchId: opaqueReferenceSchema,
    policyId: opaqueReferenceSchema,
    policyRevision: opaqueReferenceSchema,
    candidateOrdinal: z.number().int().nonnegative().max(127).safe(),
    calculation: z.unknown(),
  }).strict(),
]);

const simulationInputInnerSchema = z.object({
  contractVersion: contractVersionSchema,
  simulatorVersion: z.literal(SINGLE_SKU_SIMULATOR_VERSION),
  scenario: z.object({
    id: opaqueReferenceSchema,
    version: opaqueReferenceSchema,
    seed: z.number().int().min(0).max(4_294_967_295).safe(),
    clock: asOfSchema,
    horizon: z.object({ start: asOfSchema, end: asOfSchema }).strict(),
    source: simulationSourceSchema,
  }).strict(),
  product: productSchema,
  batch: batchSchema,
  policy: policySchema,
  initialStockSource: simulationSourceSchema,
  initialPrice: z.object({ value: nonNegativeMoneyInputSchema, source: simulationSourceSchema }).strict(),
  unitCost: z.object({ value: nonNegativeMoneyInputSchema, source: simulationSourceSchema }).strict(),
  events: z.array(simulationEventSchema).max(MAX_EVENTS),
}).strict().superRefine((input, context) => {
  const scenario = input.scenario;
  const { start, end } = scenario.horizon;
  const add = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });

  if (!sameAsOf(scenario.clock, start)) add(['scenario', 'clock'], 'The explicit simulation clock must equal horizon.start');
  if (!sameBasis(start, end) || compareAsOf(start, end) > 0) add(['scenario', 'horizon'], 'Horizon endpoints must use the same valid time basis and be ordered');
  if (input.batch.productId !== input.product.id) add(['batch', 'productId'], 'The one simulated batch must belong to the supplied product');

  const unitCode = input.product.baseUnitCode;
  const inventory = input.batch.stockBalance;
  const quantityValues = [inventory.physicalOnHand, inventory.unavailable, inventory.availableToSell, inventory.reserved];
  if (quantityValues.some((quantity) => quantity.unitCode !== unitCode)) {
    add(['batch', 'stockBalance'], 'The product and all batch inventory partitions must use one unit');
  }
  if (decimalToScaledInteger(inventory.reserved.value, decimalScale(inventory.reserved.value)) !== 0n) {
    add(['batch', 'stockBalance', 'reserved'], 'V0 single-SKU simulation does not implement order reservations');
  }
  if (input.initialPrice.value.currencyCode !== input.unitCost.value.currencyCode) {
    add(['unitCost', 'value', 'currencyCode'], 'Simulated price and cost must use the same explicit currency');
  }

  const sources = [
    { path: ['scenario', 'source'], source: scenario.source },
    { path: ['initialStockSource'], source: input.initialStockSource },
    { path: ['initialPrice', 'source'], source: input.initialPrice.source },
    { path: ['unitCost', 'source'], source: input.unitCost.source },
    ...input.events.map((event, index) => ({ path: ['events', index, 'source'], source: event.source })),
  ];
  for (const { path, source } of sources) {
    if (source.scenarioId !== scenario.id || source.scenarioVersion !== scenario.version) {
      add(path, 'Every simulated input source must bind the exact scenario ID and version');
    }
  }

  if (!sameBasis(input.batch.expiry, scenario.clock)
    || (input.batch.expiry.basis === 'DATE_ONLY' && scenario.clock.basis === 'DATE_ONLY' && input.batch.expiry.timeZone !== scenario.clock.timeZone)) {
    add(['batch', 'expiry'], 'Batch expiry and simulation clock must share an explicit time basis and timezone');
  }

  const ids = new Set<string>();
  const sequences = new Set<number>();
  input.events.forEach((event, index) => {
    if (ids.has(event.eventId)) add(['events', index, 'eventId'], 'Event IDs must be unique within one simulation');
    ids.add(event.eventId);
    if (sequences.has(event.sequence)) add(['events', index, 'sequence'], 'Event sequence values must be unique within one simulation');
    sequences.add(event.sequence);
    if (!sameBasis(event.at, scenario.clock)) add(['events', index, 'at'], 'Every event must use the simulation clock time basis');
    if (compareAsOf(event.at, start) < 0 || compareAsOf(event.at, end) > 0) {
      add(['events', index, 'at'], 'Every event must fall inside the explicit simulation horizon');
    }
    if (event.kind !== 'PRICE_ACTION' && event.quantity.unitCode !== unitCode) {
      add(['events', index, 'quantity', 'unitCode'], 'Every inventory event must use the product base unit');
    }
    if (event.kind === 'PRICE_ACTION') {
      if (event.productId !== input.product.id) add(['events', index, 'productId'], 'Price action must bind the simulated product');
      if (event.batchId !== input.batch.id) add(['events', index, 'batchId'], 'Price action must bind the simulated batch');
      if (event.policyId !== input.policy.id || event.policyRevision !== input.policy.revision) {
        add(['events', index, 'policyRevision'], 'Price action must bind the exact simulated policy revision');
      }
    }
  });
  const generatedIds = new Set<string>();
  if (initialSellabilityMayNeedEvent(input.batch.qualityStatus, input.batch.expiry, scenario.clock)) {
    generatedIds.add(`sellability:${input.batch.id}:${asOfKey(scenario.clock)}`);
  }
  if (input.batch.qualityStatus === 'PASS') {
    const expiryAt = input.batch.expiry.basis === 'DATE_ONLY'
      ? { basis: 'DATE_ONLY' as const, value: input.batch.expiry.value, timeZone: input.batch.expiry.timeZone }
      : { basis: 'INSTANT' as const, value: input.batch.expiry.value };
    if (compareAsOf(expiryAt, scenario.clock) > 0 && compareAsOf(expiryAt, scenario.horizon.end) <= 0) {
      generatedIds.add(`expiry:${input.batch.id}:${asOfKey(expiryAt)}`);
    }
  }
  for (const generatedId of generatedIds) {
    if (ids.has(generatedId)) add(['events'], 'Input event IDs cannot collide with generated sellability events');
  }
});

const simulationInputSchema = z.unknown()
  .superRefine((input, context) => preflightInput(input, context))
  .pipe(simulationInputInnerSchema);

const stockStateSchema = z.object({
  physicalOnHand: quantitySchema,
  unavailable: quantitySchema,
  availableToSell: quantitySchema,
  reserved: quantitySchema,
}).strict();

const ledgerEventSchema = z.object({
  eventId: opaqueReferenceSchema,
  sequence: z.number().int().nonnegative().safe(),
  at: asOfSchema,
  kind: z.enum(['SELLABILITY_CHECK', 'EXPIRY_STOP_SALE', 'DEMAND', 'ARRIVAL', 'DISPOSAL', 'PRICE_ACTION']),
  outcome: z.enum(['APPLIED', 'PARTIALLY_FULFILLED', 'BLOCKED', 'REJECTED']),
  source: simulationSourceSchema,
  reasonCodes: z.array(z.enum([
    'BATCH_NOT_SELLABLE', 'QUALITY_FAILED', 'QUALITY_UNKNOWN', 'EXPIRY_BOUNDARY', 'AFTER_EXPIRY',
    'INSUFFICIENT_PHYSICAL_STOCK', 'PRICE_CALCULATION_INVALID', 'PRICE_CANDIDATE_NOT_CALCULATED',
    'PRICE_CANDIDATE_MISSING', 'PRICE_CANDIDATE_REJECTED', 'PRICE_BINDING_MISMATCH',
    'PRICE_CANDIDATE_STALE', 'PRICE_CURRENCY_MISMATCH', 'PRICE_ACTION_BATCH_NOT_SELLABLE',
  ])).max(4),
  quantity: quantitySchema.nullable(),
  soldQty: quantitySchema,
  unmetDemandQty: quantitySchema,
  revenue: moneySchema,
  directProductCost: moneySchema,
  simulatedSpoilageCostExposure: moneySchema,
  stockBefore: stockStateSchema,
  stockAfter: stockStateSchema,
  priceAfter: moneySchema,
  priceCandidate: z.object({
    policyId: opaqueReferenceSchema,
    policyRevision: opaqueReferenceSchema,
    formulaVersion: opaqueReferenceSchema,
    inputSnapshotId: opaqueReferenceSchema,
    candidateOrdinal: z.number().int().nonnegative().max(127).safe(),
  }).strict().nullable(),
}).strict();

const metricsSchema = z.object({
  totalDemandQty: quantitySchema,
  simulatedSoldQty: quantitySchema,
  unmetDemandQty: quantitySchema,
  totalArrivedQty: quantitySchema,
  simulatedSpoilageQty: quantitySchema,
  unsoldPhysicalQty: quantitySchema,
  endingStock: stockStateSchema,
  simulatedRevenue: moneySchema,
  simulatedDirectProductCost: moneySchema,
  simulatedContribution: moneySchema,
  simulatedSpoilageCostExposure: moneySchema,
}).strict();

const computedResultBaseSchema = z.object({
  contractVersion: contractVersionSchema,
  simulatorVersion: z.literal(SINGLE_SKU_SIMULATOR_VERSION),
  status: z.enum(['COMPLETED', 'REJECTED']),
  sourceKind: z.literal('SIMULATED'),
  businessApproval: z.literal('NOT_GRANTED'),
  executionAuthority: z.literal('NONE'),
  claims: z.object({ realPriceCausality: z.literal('NOT_ESTABLISHED'), finalLossKpi: z.literal('NOT_CLAIMED') }).strict(),
  scenario: z.object({
    id: opaqueReferenceSchema, version: opaqueReferenceSchema, seed: z.number().int().min(0).max(4_294_967_295).safe(),
    clock: asOfSchema, horizon: z.object({ start: asOfSchema, end: asOfSchema }).strict(),
  }).strict(),
  productId: opaqueReferenceSchema,
  batchId: opaqueReferenceSchema,
  policy: z.object({ id: opaqueReferenceSchema, revision: opaqueReferenceSchema }).strict(),
  inputs: z.object({
    openingStockSource: simulationSourceSchema,
    initialPriceSource: simulationSourceSchema,
    unitCostSource: simulationSourceSchema,
  }).strict(),
  openingStock: stockStateSchema,
  reasonCodes: z.array(z.enum(['EVENT_REJECTED'])).max(1),
  events: z.array(ledgerEventSchema).max(MAX_EVENTS + 2),
  metrics: metricsSchema,
  precision: z.object({ quantityScale: z.number().int().min(0).max(MAX_SCALE), moneyInputScale: z.number().int().min(0).max(MAX_SCALE), moneyOutputScale: z.number().int().min(0).max(MAX_SCALE * 2) }).strict(),
  assumptions: z.array(z.string().max(180)),
}).strict();

const computedResultSchema = computedResultBaseSchema.superRefine((result, context) => {
  const add = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
  const { metrics, precision } = result;
  const qtyScale = precision.quantityScale;
  const outputScale = precision.moneyOutputScale;
  let unsafePrecision = outputScale !== precision.moneyInputScale + qtyScale;

  const quantities: Array<{ readonly value: z.infer<typeof quantitySchema>; readonly path: (string | number)[] }> = [];
  const collectStock = (stock: z.infer<typeof stockStateSchema>, path: (string | number)[]) => {
    quantities.push(
      { value: stock.physicalOnHand, path: [...path, 'physicalOnHand'] },
      { value: stock.unavailable, path: [...path, 'unavailable'] },
      { value: stock.availableToSell, path: [...path, 'availableToSell'] },
      { value: stock.reserved, path: [...path, 'reserved'] },
    );
  };
  collectStock(result.openingStock, ['openingStock']);
  collectStock(metrics.endingStock, ['metrics', 'endingStock']);
  quantities.push(
    { value: metrics.totalDemandQty, path: ['metrics', 'totalDemandQty'] },
    { value: metrics.simulatedSoldQty, path: ['metrics', 'simulatedSoldQty'] },
    { value: metrics.unmetDemandQty, path: ['metrics', 'unmetDemandQty'] },
    { value: metrics.totalArrivedQty, path: ['metrics', 'totalArrivedQty'] },
    { value: metrics.simulatedSpoilageQty, path: ['metrics', 'simulatedSpoilageQty'] },
    { value: metrics.unsoldPhysicalQty, path: ['metrics', 'unsoldPhysicalQty'] },
  );
  result.events.forEach((event, index) => {
    collectStock(event.stockBefore, ['events', index, 'stockBefore']);
    collectStock(event.stockAfter, ['events', index, 'stockAfter']);
    if (event.quantity !== null) quantities.push({ value: event.quantity, path: ['events', index, 'quantity'] });
    quantities.push(
      { value: event.soldQty, path: ['events', index, 'soldQty'] },
      { value: event.unmetDemandQty, path: ['events', index, 'unmetDemandQty'] },
    );
  });

  for (const { value, path } of quantities) {
    const fractionalDigits = value.value.split('.')[1]?.length ?? 0;
    if (value.value.replace('.', '').length > MAX_OUTPUT_DIGITS || fractionalDigits > qtyScale) {
      add(path, 'Quantity must fit the declared scale and safe exact output size');
      unsafePrecision = true;
    }
  }

  const outputMoney: Array<{ readonly value: z.infer<typeof moneySchema>; readonly path: (string | number)[] }> = [
    { value: metrics.simulatedRevenue, path: ['metrics', 'simulatedRevenue'] },
    { value: metrics.simulatedDirectProductCost, path: ['metrics', 'simulatedDirectProductCost'] },
    { value: metrics.simulatedContribution, path: ['metrics', 'simulatedContribution'] },
    { value: metrics.simulatedSpoilageCostExposure, path: ['metrics', 'simulatedSpoilageCostExposure'] },
  ];
  result.events.forEach((event, index) => {
    outputMoney.push(
      { value: event.revenue, path: ['events', index, 'revenue'] },
      { value: event.directProductCost, path: ['events', index, 'directProductCost'] },
      { value: event.simulatedSpoilageCostExposure, path: ['events', index, 'simulatedSpoilageCostExposure'] },
    );
    if (event.priceAfter.minorUnits.replace('-', '').length > MAX_OUTPUT_DIGITS
      || event.priceAfter.minorUnitScale > precision.moneyInputScale) {
      add(['events', index, 'priceAfter', 'minorUnitScale'], 'Price precision exceeds the declared money input scale');
      unsafePrecision = true;
    }
  });
  for (const { value, path } of outputMoney) {
    if (value.minorUnits.replace('-', '').length > MAX_OUTPUT_DIGITS || value.minorUnitScale !== outputScale) {
      add(path, 'Ledger amount must fit the safe exact output size and declared output scale');
      unsafePrecision = true;
    }
  }
  if (unsafePrecision) return;

  const toQty = (quantity: z.infer<typeof quantitySchema>) => decimalToScaledInteger(quantity.value, qtyScale);
  const toMoney = (moneyValue: z.infer<typeof moneySchema>) => BigInt(moneyValue.minorUnits);
  const sameQuantity = (left: z.infer<typeof quantitySchema>, right: z.infer<typeof quantitySchema>) =>
    left.unitCode === right.unitCode && toQty(left) === toQty(right);
  const sameState = (left: z.infer<typeof stockStateSchema>, right: z.infer<typeof stockStateSchema>) =>
    sameQuantity(left.physicalOnHand, right.physicalOnHand)
    && sameQuantity(left.unavailable, right.unavailable)
    && sameQuantity(left.availableToSell, right.availableToSell)
    && sameQuantity(left.reserved, right.reserved);
  const stateParts = (stock: z.infer<typeof stockStateSchema>) => ({
    physical: toQty(stock.physicalOnHand),
    unavailable: toQty(stock.unavailable),
    available: toQty(stock.availableToSell),
    reserved: toQty(stock.reserved),
  });
  const firstUnit = metrics.totalDemandQty.unitCode;
  const expectedCurrency = metrics.simulatedRevenue.currencyCode;
  let stateIsValid = true;
  const validateStock = (stock: z.infer<typeof stockStateSchema>, path: (string | number)[]) => {
    const parts = stateParts(stock);
    const values = [stock.physicalOnHand, stock.unavailable, stock.availableToSell, stock.reserved];
    if (values.some((value) => value.unitCode !== firstUnit)
      || parts.physical !== parts.unavailable + parts.available + parts.reserved) {
      add(path, 'Inventory partitions must use one unit and sum exactly to physical stock');
      stateIsValid = false;
    }
  };
  validateStock(result.openingStock, ['openingStock']);
  validateStock(metrics.endingStock, ['metrics', 'endingStock']);
  for (const { value, path } of quantities) {
    if (value.unitCode !== firstUnit) add(path, 'All simulation quantities must retain one product unit');
  }

  const seenIds = new Set<string>();
  let previousSequence = -1;
  let previousAt: z.infer<typeof asOfSchema> | null = null;
  let previousStock = result.openingStock;
  let previousPrice: z.infer<typeof moneySchema> | null = null;
  let totalDemand = 0n;
  let totalSold = 0n;
  let totalUnmet = 0n;
  let totalArrived = 0n;
  let totalSpoiled = 0n;
  let totalRevenue = 0n;
  let totalDirectCost = 0n;
  let totalSpoilageExposure = 0n;
  let rejectedCount = 0;

  result.events.forEach((event, index) => {
    const path = ['events', index] as (string | number)[];
    const before = stateParts(event.stockBefore);
    const after = stateParts(event.stockAfter);
    validateStock(event.stockBefore, [...path, 'stockBefore']);
    validateStock(event.stockAfter, [...path, 'stockAfter']);
    if (seenIds.has(event.eventId) || event.sequence <= previousSequence) {
      add(path, 'Ledger event IDs must be unique and sequence must increase in ledger order');
    }
    seenIds.add(event.eventId);
    previousSequence = event.sequence;
    if (!sameBasis(event.at, result.scenario.clock)
      || compareAsOf(event.at, result.scenario.horizon.start) < 0
      || compareAsOf(event.at, result.scenario.horizon.end) > 0
      || previousAt !== null && compareAsOf(event.at, previousAt) < 0) {
      add([...path, 'at'], 'Ledger events must use the scenario time basis and remain chronologically ordered');
    }
    previousAt = event.at;
    if (event.source.scenarioId !== result.scenario.id || event.source.scenarioVersion !== result.scenario.version
      || event.source.sourceKind !== 'SIMULATED') {
      add([...path, 'source'], 'Every ledger event must retain the exact simulated scenario source');
    }
    if (!sameState(event.stockBefore, previousStock)) add([...path, 'stockBefore'], 'Adjacent ledger stock states must be continuous');

    const quantity = event.quantity === null ? null : toQty(event.quantity);
    const sold = toQty(event.soldQty);
    const unmet = toQty(event.unmetDemandQty);
    const revenue = toMoney(event.revenue);
    const directCost = toMoney(event.directProductCost);
    const spoilageExposure = toMoney(event.simulatedSpoilageCostExposure);
    totalRevenue += revenue;
    totalDirectCost += directCost;
    totalSpoilageExposure += spoilageExposure;
    if ([event.revenue, event.directProductCost, event.simulatedSpoilageCostExposure, event.priceAfter]
      .some((amount) => amount.currencyCode !== expectedCurrency)) {
      add(path, 'All ledger amounts and prices must use one explicit currency');
    }
    if (previousPrice !== null && (event.kind !== 'PRICE_ACTION' || event.outcome !== 'APPLIED')) {
      if (!sameMoneyAtScale(previousPrice, event.priceAfter, precision.moneyInputScale)) {
        add([...path, 'priceAfter'], 'Event price must remain unchanged unless a price action is applied');
      }
    }
    if (previousPrice === null || event.kind === 'PRICE_ACTION' && event.outcome === 'APPLIED') previousPrice = event.priceAfter;

    if (event.kind === 'DEMAND') {
      if (quantity === null) add([...path, 'quantity'], 'Demand events require a quantity');
      else totalDemand += quantity;
      if (quantity === null || sold + unmet !== quantity) add(path, 'Demand quantity must equal sold plus unmet quantity');
      if (after.physical !== before.physical - sold || after.available !== before.available - sold
        || after.unavailable !== before.unavailable || after.reserved !== before.reserved) {
        add(path, 'Demand events may only reduce physical and available stock by the sold quantity');
      }
      if (event.outcome === 'BLOCKED' && sold !== 0n || event.outcome === 'APPLIED' && unmet !== 0n
        || event.outcome === 'PARTIALLY_FULFILLED' && unmet === 0n || event.outcome === 'REJECTED') {
        add([...path, 'outcome'], 'Demand outcome must agree with its fulfilled and unmet quantities');
      }
      const expectedRevenue = atScale(event.priceAfter, precision.moneyInputScale) * sold;
      if (revenue !== expectedRevenue || sold === 0n && directCost !== 0n) {
        add(path, 'Demand revenue and cost must agree with the sold quantity and exact price arithmetic');
      }
      if (spoilageExposure !== 0n || event.priceCandidate !== null) add(path, 'Demand events cannot carry spoilage exposure or price candidates');
      totalSold += sold;
      totalUnmet += unmet;
    } else if (event.kind === 'ARRIVAL') {
      if (quantity === null) add([...path, 'quantity'], 'Arrival events require a quantity');
      const blocked = event.outcome === 'BLOCKED';
      if (quantity === null || sold !== 0n || unmet !== 0n || revenue !== 0n || directCost !== 0n || spoilageExposure !== 0n
        || after.physical !== before.physical + quantity
        || after.available !== before.available + (blocked ? 0n : quantity)
        || after.unavailable !== before.unavailable + (blocked ? quantity : 0n)
        || after.reserved !== before.reserved || event.priceCandidate !== null
        || event.outcome !== 'APPLIED' && !blocked) {
        add(path, 'Arrival ledger entry must apply or block the exact arrival without unrelated effects');
      } else totalArrived += quantity;
    } else if (event.kind === 'DISPOSAL') {
      if (quantity === null) add([...path, 'quantity'], 'Disposal events require a quantity');
      if (quantity === null || sold !== 0n || unmet !== 0n || revenue !== 0n || directCost !== 0n || event.priceCandidate !== null) {
        add(path, 'Disposal entries cannot contain sales, demand or direct sales revenue');
      } else if (event.outcome === 'APPLIED' && quantity <= before.physical) {
        const fromUnavailable = quantity < before.unavailable ? quantity : before.unavailable;
        const fromAvailable = quantity - fromUnavailable;
        if (after.physical !== before.physical - quantity || after.unavailable !== before.unavailable - fromUnavailable
          || after.available !== before.available - fromAvailable || after.reserved !== before.reserved) {
          add(path, 'Applied disposal must reduce physical stock from unavailable stock before available stock');
        }
        totalSpoiled += quantity;
      } else if (event.outcome === 'REJECTED' && quantity > before.physical) {
        if (!sameState(event.stockBefore, event.stockAfter) || spoilageExposure !== 0n) add(path, 'Rejected disposal cannot mutate stock or report spoilage exposure');
      } else {
        add([...path, 'outcome'], 'Disposal outcome must match the available physical stock');
      }
    } else if (event.kind === 'PRICE_ACTION') {
      if (quantity !== null || sold !== 0n || unmet !== 0n || revenue !== 0n || directCost !== 0n || spoilageExposure !== 0n
        || !sameState(event.stockBefore, event.stockAfter)) {
        add(path, 'Price actions cannot mutate inventory or report sales amounts');
      }
      if (event.outcome === 'APPLIED' && event.priceCandidate === null
        || event.outcome !== 'APPLIED' && event.priceCandidate !== null) {
        add([...path, 'priceCandidate'], 'Only an applied price action may carry a validated candidate reference');
      }
      if (event.priceCandidate !== null && (event.priceCandidate.policyId !== result.policy.id
        || event.priceCandidate.policyRevision !== result.policy.revision)) {
        add([...path, 'priceCandidate'], 'Applied price candidate must retain the result policy ID and exact revision');
      }
    } else {
      if (quantity !== null || sold !== 0n || unmet !== 0n || revenue !== 0n || directCost !== 0n || spoilageExposure !== 0n
        || event.outcome !== 'BLOCKED' || event.priceCandidate !== null
        || after.physical !== before.physical || after.unavailable !== before.unavailable + before.available
        || after.available !== 0n || after.reserved !== before.reserved) {
        add(path, 'Sellability events must only move available inventory to unavailable inventory');
      }
    }

    previousStock = event.stockAfter;
    if (event.outcome === 'REJECTED') rejectedCount += 1;
  });

  if (result.events.length > 0 && !sameState(result.events.at(-1)!.stockAfter, metrics.endingStock)
    || result.events.length === 0 && !sameState(result.openingStock, metrics.endingStock)) {
    add(['metrics', 'endingStock'], 'Ending inventory must equal the final ledger state');
  }
  if (!stateIsValid || toQty(metrics.totalDemandQty) !== totalDemand || toQty(metrics.simulatedSoldQty) !== totalSold
    || toQty(metrics.unmetDemandQty) !== totalUnmet || toQty(metrics.totalArrivedQty) !== totalArrived
    || toQty(metrics.simulatedSpoilageQty) !== totalSpoiled) {
    add(['metrics'], 'Summary quantities must equal the event ledger totals');
  }
  if (toQty(metrics.totalDemandQty) !== toQty(metrics.simulatedSoldQty) + toQty(metrics.unmetDemandQty)) {
    add(['metrics'], 'Demand must equal simulated sales plus unmet demand');
  }
  if (!sameQuantity(metrics.unsoldPhysicalQty, metrics.endingStock.physicalOnHand)) {
    add(['metrics', 'unsoldPhysicalQty'], 'Unsold stock is the ending physical inventory');
  }
  const opening = toQty(result.openingStock.physicalOnHand);
  const arrived = toQty(metrics.totalArrivedQty);
  const sold = toQty(metrics.simulatedSoldQty);
  const spoiled = toQty(metrics.simulatedSpoilageQty);
  const ending = toQty(metrics.endingStock.physicalOnHand);
  if (opening + arrived !== sold + spoiled + ending) add(['metrics', 'endingStock'], 'Physical stock must conserve: opening + arrivals = sales + spoilage + ending');

  const revenue = toMoney(metrics.simulatedRevenue);
  const directCost = toMoney(metrics.simulatedDirectProductCost);
  const contribution = toMoney(metrics.simulatedContribution);
  if (metrics.simulatedRevenue.currencyCode !== metrics.simulatedDirectProductCost.currencyCode
    || metrics.simulatedRevenue.currencyCode !== metrics.simulatedContribution.currencyCode
    || metrics.simulatedRevenue.currencyCode !== metrics.simulatedSpoilageCostExposure.currencyCode
    || revenue !== totalRevenue || directCost !== totalDirectCost || toMoney(metrics.simulatedSpoilageCostExposure) !== totalSpoilageExposure
    || revenue - directCost !== contribution) {
    add(['metrics', 'simulatedContribution'], 'Summary amounts must match the event ledger and contribution must equal revenue minus direct cost');
  }
  if (result.status === 'COMPLETED' && (rejectedCount > 0 || result.reasonCodes.length > 0)) {
    add(['status'], 'COMPLETED results cannot contain a rejected event');
  }
  if (result.status === 'REJECTED' && (result.events.at(-1)?.outcome !== 'REJECTED'
    || rejectedCount !== 1 || result.reasonCodes[0] !== 'EVENT_REJECTED')) {
    add(['status'], 'REJECTED results must end at exactly one rejected event and identify it');
  }
});

function sameMoneyAtScale(
  left: z.infer<typeof moneySchema>,
  right: z.infer<typeof moneySchema>,
  scale: number,
): boolean {
  return left.currencyCode === right.currencyCode && atScale(left, scale) === atScale(right, scale);
}

const notComputableResultSchema = z.object({
  contractVersion: contractVersionSchema,
  simulatorVersion: z.literal(SINGLE_SKU_SIMULATOR_VERSION),
  status: z.literal('NOT_COMPUTABLE'),
  sourceKind: z.literal('SIMULATED'),
  businessApproval: z.literal('NOT_GRANTED'),
  executionAuthority: z.literal('NONE'),
  reasonCodes: z.array(z.enum(['INPUT_INVALID', 'RESOURCE_LIMIT'])).min(1).max(1),
  events: z.tuple([]),
  claims: z.object({ realPriceCausality: z.literal('NOT_ESTABLISHED'), finalLossKpi: z.literal('NOT_CLAIMED') }).strict(),
}).strict();

export const singleSkuSimulationResultSchema = z.discriminatedUnion('status', [
  notComputableResultSchema,
  computedResultSchema,
]);
export type SingleSkuSimulationResult = z.infer<typeof singleSkuSimulationResultSchema>;

type SimulationInput = z.infer<typeof simulationInputInnerSchema>;
type SimulationEvent = SimulationInput['events'][number];
type StockState = { physical: bigint; unavailable: bigint; available: bigint; reserved: bigint };
type MarkdownResultSnapshot = NonNullable<MarkdownCalculationResult['inputSnapshot']>;
type PreparedPriceAction = {
  readonly price: z.infer<typeof moneySchema> | null;
  readonly candidate: z.infer<typeof computedResultSchema>['events'][number]['priceCandidate'];
  readonly reason: z.infer<typeof ledgerEventSchema>['reasonCodes'][number] | null;
  readonly snapshot: MarkdownResultSnapshot | null;
};
type ScheduledEvent = {
  readonly id: string;
  readonly sequence: number;
  readonly at: z.infer<typeof asOfSchema>;
  readonly kind: 'SELLABILITY_CHECK' | 'EXPIRY_STOP_SALE' | SimulationEvent['kind'];
  readonly source: z.infer<typeof simulationSourceSchema>;
  readonly input: SimulationEvent | null;
  readonly priority: number;
};

/**
 * Runs a pure, in-memory, single-product/single-batch simulation.
 * The seed is recorded for scenario identity; demand quantities are explicit inputs because
 * no production stochastic demand distribution has been approved for V0.
 */
export function simulateSingleSku(input: unknown): SingleSkuSimulationResult {
  let parsed: ReturnType<typeof simulationInputSchema.safeParse>;
  try {
    parsed = simulationInputSchema.safeParse(input);
  } catch {
    return notComputable('INPUT_INVALID');
  }
  if (!parsed.success) return notComputable('INPUT_INVALID');
  return runSimulation(parsed.data);
}

function runSimulation(input: SimulationInput): SingleSkuSimulationResult {
  const unitCode = input.product.baseUnitCode;
  const quantityScale = Math.max(
    decimalScale(input.batch.stockBalance.physicalOnHand.value),
    decimalScale(input.batch.stockBalance.unavailable.value),
    decimalScale(input.batch.stockBalance.availableToSell.value),
    decimalScale(input.batch.stockBalance.reserved.value),
    ...input.events.filter((event) => event.kind !== 'PRICE_ACTION').map((event) => decimalScale(event.quantity.value)),
  );
  const preparedPriceActions = new Map<string, PreparedPriceAction>();
  let moneyInputScale = Math.max(input.initialPrice.value.minorUnitScale, input.unitCost.value.minorUnitScale);
  for (const event of input.events) {
    if (event.kind !== 'PRICE_ACTION') continue;
    const prepared = preparePriceAction(input, event);
    preparedPriceActions.set(event.eventId, prepared);
    if (prepared.price !== null) moneyInputScale = Math.max(moneyInputScale, prepared.price.minorUnitScale);
  }
  const moneyOutputScale = moneyInputScale + quantityScale;
  const emptyMoney = money(0n, input.initialPrice.value.currencyCode, moneyOutputScale);
  const scaleQty = (value: string) => decimalToScaledInteger(value, quantityScale);
  let state: StockState = {
    physical: scaleQty(input.batch.stockBalance.physicalOnHand.value),
    unavailable: scaleQty(input.batch.stockBalance.unavailable.value),
    available: scaleQty(input.batch.stockBalance.availableToSell.value),
    reserved: 0n,
  };
  const openingStock = stockState(state, quantityScale, unitCode);
  let activePrice = input.initialPrice.value;
  let totalDemand = 0n;
  let totalSold = 0n;
  let totalUnmetDemand = 0n;
  let totalArrived = 0n;
  let totalSpoiled = 0n;
  let revenueTotal = 0n;
  let costTotal = 0n;
  let spoilageCostTotal = 0n;
  let status: 'COMPLETED' | 'REJECTED' = 'COMPLETED';
  const events: z.infer<typeof ledgerEventSchema>[] = [];

  const scheduled = scheduleEvents(input);
  const initialSellability = assessSellability({ expiry: input.batch.expiry, asOf: input.scenario.clock, qualityStatus: input.batch.qualityStatus });
  if (initialSellability.status !== 'ELIGIBLE') {
    const before = state;
    state = { ...state, unavailable: state.unavailable + state.available, available: 0n };
    events.push(makeLedgerEvent({
      eventId: `sellability:${input.batch.id}:${asOfKey(input.scenario.clock)}`,
      sequence: 0,
      at: input.scenario.clock,
      kind: 'SELLABILITY_CHECK',
      outcome: 'BLOCKED',
      source: input.scenario.source,
      reasonCodes: [reasonForSellability(initialSellability.reason)],
      quantity: null,
      soldQty: 0n,
      unmetDemandQty: 0n,
      revenue: 0n,
      directProductCost: 0n,
      simulatedSpoilageCostExposure: 0n,
      before,
      after: state,
      price: activePrice,
      priceCandidate: null,
      quantityScale,
      moneyOutputScale,
      currency: input.initialPrice.value.currencyCode,
      unitCode,
    }));
  }

  for (const scheduledEvent of scheduled) {
    if (status === 'REJECTED') break;
    const before = state;
    const sellability = assessSellability({ expiry: input.batch.expiry, asOf: scheduledEvent.at, qualityStatus: input.batch.qualityStatus });
    let outcome: z.infer<typeof ledgerEventSchema>['outcome'] = 'APPLIED';
    let reasonCodes: z.infer<typeof ledgerEventSchema>['reasonCodes'] = [];
    let quantity: bigint | null = null;
    let soldQty = 0n;
    let unmetDemandQty = 0n;
    let eventRevenue = 0n;
    let eventCost = 0n;
    let eventSpoilageCost = 0n;
    let priceCandidate: z.infer<typeof ledgerEventSchema>['priceCandidate'] = null;

    if (scheduledEvent.kind === 'EXPIRY_STOP_SALE' || scheduledEvent.kind === 'SELLABILITY_CHECK') {
      if (sellability.status !== 'ELIGIBLE') {
        state = { ...state, unavailable: state.unavailable + state.available, available: 0n };
        outcome = 'BLOCKED';
        reasonCodes = [reasonForSellability(sellability.reason)];
      }
    } else {
      const inputEvent = scheduledEvent.input!;
      if (inputEvent.kind === 'DEMAND') {
        quantity = scaleQty(inputEvent.quantity.value);
        totalDemand += quantity;
        if (sellability.status === 'ELIGIBLE') {
          soldQty = quantity < state.available ? quantity : state.available;
          unmetDemandQty = quantity - soldQty;
          state = { ...state, physical: state.physical - soldQty, available: state.available - soldQty };
          totalSold += soldQty;
          totalUnmetDemand += unmetDemandQty;
          eventRevenue = atScale(activePrice, moneyInputScale) * soldQty;
          eventCost = atScale(input.unitCost.value, moneyInputScale) * soldQty;
          revenueTotal += eventRevenue;
          costTotal += eventCost;
          if (unmetDemandQty > 0n) outcome = 'PARTIALLY_FULFILLED';
        } else {
          unmetDemandQty = quantity;
          totalUnmetDemand += quantity;
          outcome = 'BLOCKED';
          reasonCodes = [reasonForSellability(sellability.reason)];
        }
      } else if (inputEvent.kind === 'ARRIVAL') {
        quantity = scaleQty(inputEvent.quantity.value);
        const eligible = sellability.status === 'ELIGIBLE';
        state = {
          ...state,
          physical: state.physical + quantity,
          available: state.available + (eligible ? quantity : 0n),
          unavailable: state.unavailable + (eligible ? 0n : quantity),
        };
        totalArrived += quantity;
        if (!eligible) {
          outcome = 'BLOCKED';
          reasonCodes = [reasonForSellability(sellability.reason)];
        }
      } else if (inputEvent.kind === 'DISPOSAL') {
        quantity = scaleQty(inputEvent.quantity.value);
        if (quantity > state.physical) {
          outcome = 'REJECTED';
          status = 'REJECTED';
          reasonCodes = ['INSUFFICIENT_PHYSICAL_STOCK'];
        } else {
          const fromUnavailable = quantity < state.unavailable ? quantity : state.unavailable;
          const fromAvailable = quantity - fromUnavailable;
          state = {
            ...state,
            physical: state.physical - quantity,
            unavailable: state.unavailable - fromUnavailable,
            available: state.available - fromAvailable,
          };
          totalSpoiled += quantity;
          eventSpoilageCost = atScale(input.unitCost.value, moneyInputScale) * quantity;
          spoilageCostTotal += eventSpoilageCost;
        }
      } else {
        const prepared = preparedPriceActions.get(inputEvent.eventId)!;
        if (prepared.reason !== null || prepared.price === null) {
          outcome = 'REJECTED';
          status = 'REJECTED';
          reasonCodes = [prepared.reason ?? 'PRICE_CALCULATION_INVALID'];
        } else if (sellability.status !== 'ELIGIBLE') {
          outcome = 'REJECTED';
          status = 'REJECTED';
          reasonCodes = ['PRICE_ACTION_BATCH_NOT_SELLABLE'];
        } else {
          const currentStateReason = validatePriceActionCurrentState(prepared, input, inputEvent, state, activePrice, quantityScale);
          if (currentStateReason !== null) {
            outcome = 'REJECTED';
            status = 'REJECTED';
            reasonCodes = [currentStateReason];
          } else {
            activePrice = prepared.price;
            priceCandidate = prepared.candidate;
          }
        }
      }
    }

    events.push(makeLedgerEvent({
      eventId: scheduledEvent.id,
      sequence: events.length + 1,
      at: scheduledEvent.at,
      kind: scheduledEvent.kind,
      outcome,
      source: scheduledEvent.source,
      reasonCodes,
      quantity,
      soldQty,
      unmetDemandQty,
      revenue: eventRevenue,
      directProductCost: eventCost,
      simulatedSpoilageCostExposure: eventSpoilageCost,
      before,
      after: state,
      price: activePrice,
      priceCandidate,
      quantityScale,
      moneyOutputScale,
      currency: input.initialPrice.value.currencyCode,
      unitCode,
    }));
  }

  const zero = (value: bigint) => quantity(value, quantityScale, unitCode);
  const endState = stockState(state, quantityScale, unitCode);
  const contribution = revenueTotal - costTotal;
  const result = {
    contractVersion: '0.3.0',
    simulatorVersion: SINGLE_SKU_SIMULATOR_VERSION,
    status,
    sourceKind: 'SIMULATED',
    businessApproval: 'NOT_GRANTED',
    executionAuthority: 'NONE',
    claims: { realPriceCausality: 'NOT_ESTABLISHED', finalLossKpi: 'NOT_CLAIMED' },
    scenario: {
      id: input.scenario.id,
      version: input.scenario.version,
      seed: input.scenario.seed,
      clock: input.scenario.clock,
      horizon: input.scenario.horizon,
    },
    productId: input.product.id,
    batchId: input.batch.id,
    policy: { id: input.policy.id, revision: input.policy.revision },
    inputs: {
      openingStockSource: input.initialStockSource,
      initialPriceSource: input.initialPrice.source,
      unitCostSource: input.unitCost.source,
    },
    openingStock,
    reasonCodes: status === 'REJECTED' ? ['EVENT_REJECTED'] : [],
    events,
    metrics: {
      totalDemandQty: zero(totalDemand),
      simulatedSoldQty: zero(totalSold),
      unmetDemandQty: zero(totalUnmetDemand),
      totalArrivedQty: zero(totalArrived),
      simulatedSpoilageQty: zero(totalSpoiled),
      unsoldPhysicalQty: zero(state.physical),
      endingStock: endState,
      simulatedRevenue: money(revenueTotal, input.initialPrice.value.currencyCode, moneyOutputScale),
      simulatedDirectProductCost: money(costTotal, input.initialPrice.value.currencyCode, moneyOutputScale),
      simulatedContribution: money(contribution, input.initialPrice.value.currencyCode, moneyOutputScale),
      simulatedSpoilageCostExposure: money(spoilageCostTotal, input.initialPrice.value.currencyCode, moneyOutputScale),
    },
    precision: { quantityScale, moneyInputScale, moneyOutputScale },
    assumptions: [
      'DEMAND_IS_EXPLICIT_SIMULATED_INPUT; NO_UNAPPROVED_RANDOM_DEMAND_MODEL',
      'EXPIRY_CHANGES_SELLABILITY_ONLY; PHYSICAL_STOCK_CHANGES_ONLY_ON_ARRIVAL_SALE_OR_DISPOSAL',
      'SIMULATION_DOES_NOT_GRANT_BUSINESS_APPROVAL_OR_EXECUTION_AUTHORITY',
    ],
  };
  return singleSkuSimulationResultSchema.parse(result);
}

function preparePriceAction(input: SimulationInput, event: Extract<SimulationEvent, { kind: 'PRICE_ACTION' }>): PreparedPriceAction {
  const parsed = markdownCalculationResultSchema.safeParse(event.calculation);
  if (!parsed.success) return { price: null, candidate: null, reason: 'PRICE_CALCULATION_INVALID', snapshot: null };
  const calculation = parsed.data;
  if (calculation.status !== 'CALCULATED' || calculation.inputSnapshot === null) {
    return { price: null, candidate: null, reason: 'PRICE_CANDIDATE_NOT_CALCULATED', snapshot: null };
  }
  const candidate = calculation.candidates.find((item) => item.inputOrdinal === event.candidateOrdinal);
  if (candidate === undefined) return { price: null, candidate: null, reason: 'PRICE_CANDIDATE_MISSING', snapshot: null };
  if (candidate.status !== 'CALCULATED' || candidate.hardRulesPassed !== true || candidate.proposedPrice === null) {
    return { price: null, candidate: null, reason: 'PRICE_CANDIDATE_REJECTED', snapshot: null };
  }
  const snapshot = calculation.inputSnapshot;
  if (snapshot.batch.id !== input.batch.id || snapshot.batch.productId !== input.product.id
    || event.productId !== input.product.id || event.batchId !== input.batch.id
    || snapshot.policy.id !== input.policy.id || snapshot.policy.revision !== input.policy.revision
    || event.policyId !== input.policy.id || event.policyRevision !== input.policy.revision
    || snapshot.scenario.id !== input.scenario.id || snapshot.scenario.version !== input.scenario.version
    || snapshot.batch.stockBalance.physicalOnHand.unitCode !== input.product.baseUnitCode
    || snapshot.batch.stockBalance.unavailable.unitCode !== input.product.baseUnitCode
    || snapshot.batch.stockBalance.availableToSell.unitCode !== input.product.baseUnitCode
    || snapshot.batch.stockBalance.reserved.unitCode !== input.product.baseUnitCode
    || snapshot.basePrice.source.unitCode !== input.product.baseUnitCode
    || snapshot.unitCost.source.unitCode !== input.product.baseUnitCode) {
    return { price: null, candidate: null, reason: 'PRICE_BINDING_MISMATCH', snapshot: null };
  }
  const candidateAsOf = snapshot.asOf;
  if (!sameAsOf(candidateAsOf, input.scenario.clock)
    || !timeIsWithin(event.at, snapshot.scenario.simulationWindow)
    || !timeIsWithin(event.at, input.scenario.horizon)) {
    return { price: null, candidate: null, reason: 'PRICE_CANDIDATE_STALE', snapshot: null };
  }
  if (candidate.proposedPrice.currencyCode !== input.initialPrice.value.currencyCode) {
    return { price: null, candidate: null, reason: 'PRICE_CURRENCY_MISMATCH', snapshot: null };
  }
  return {
    price: candidate.proposedPrice,
    candidate: {
      policyId: snapshot.policy.id,
      policyRevision: snapshot.policy.revision,
      formulaVersion: calculation.formulaVersion,
      inputSnapshotId: snapshot.inputSnapshot.id,
      candidateOrdinal: event.candidateOrdinal,
    },
    reason: null,
    snapshot,
  };
}

function validatePriceActionCurrentState(
  prepared: PreparedPriceAction,
  input: SimulationInput,
  _event: Extract<SimulationEvent, { kind: 'PRICE_ACTION' }>,
  state: StockState,
  activePrice: z.infer<typeof moneySchema>,
  quantityScale: number,
): z.infer<typeof ledgerEventSchema>['reasonCodes'][number] | null {
  const snapshot = prepared.snapshot;
  if (snapshot === null) return 'PRICE_CANDIDATE_NOT_CALCULATED';
  if (!moneyEquals(snapshot.basePrice.value, activePrice)
    || !moneyEquals(snapshot.unitCost.value, input.unitCost.value)) {
    return 'PRICE_CANDIDATE_STALE';
  }

  const balance = snapshot.batch.stockBalance;
  const snapshotQuantities = [balance.physicalOnHand, balance.unavailable, balance.availableToSell, balance.reserved];
  if (snapshotQuantities.some((quantity) => quantity.unitCode !== input.product.baseUnitCode)) {
    return 'PRICE_BINDING_MISMATCH';
  }
  const comparisonScale = Math.max(quantityScale, ...snapshotQuantities.map((quantity) => decimalScale(quantity.value)));
  const lift = (value: bigint) => value * (10n ** BigInt(comparisonScale - quantityScale));
  const expected = [lift(state.physical), lift(state.unavailable), lift(state.available), lift(state.reserved)];
  const current = snapshotQuantities.map((quantity) => decimalToScaledInteger(quantity.value, comparisonScale));
  if (expected.some((value, index) => value !== current[index])) return 'PRICE_CANDIDATE_STALE';
  return null;
}

function timeIsWithin(
  time: z.infer<typeof asOfSchema>,
  window: { readonly start: z.infer<typeof asOfSchema>; readonly end: z.infer<typeof asOfSchema> },
): boolean {
  return sameBasis(time, window.start) && sameBasis(time, window.end)
    && compareAsOf(time, window.start) >= 0 && compareAsOf(time, window.end) <= 0;
}

function moneyEquals(left: z.infer<typeof moneySchema>, right: z.infer<typeof moneySchema>): boolean {
  if (left.currencyCode !== right.currencyCode) return false;
  const scale = Math.max(left.minorUnitScale, right.minorUnitScale);
  return atScale(left, scale) === atScale(right, scale);
}

function scheduleEvents(input: SimulationInput): ScheduledEvent[] {
  const scheduled: ScheduledEvent[] = input.events.map((event) => ({
    id: event.eventId,
    sequence: event.sequence,
    at: event.at,
    kind: event.kind,
    source: event.source,
    input: event,
    priority: 1,
  }));
  const expiry = input.batch.expiry;
  const expiryAt = expiry.basis === 'DATE_ONLY'
    ? { basis: 'DATE_ONLY' as const, value: expiry.value, timeZone: expiry.timeZone }
    : { basis: 'INSTANT' as const, value: expiry.value };
  if (input.batch.qualityStatus === 'PASS'
    && compareAsOf(expiryAt, input.scenario.clock) > 0
    && compareAsOf(expiryAt, input.scenario.horizon.end) <= 0) {
    scheduled.push({
      id: `expiry:${input.batch.id}:${asOfKey(expiryAt)}`,
      sequence: 0,
      at: expiryAt,
      kind: 'EXPIRY_STOP_SALE',
      source: input.scenario.source,
      input: null,
      priority: 0,
    });
  }
  return scheduled.sort((left, right) => compareAsOf(left.at, right.at)
    || left.priority - right.priority
    || left.sequence - right.sequence
    || left.id.localeCompare(right.id));
}

function makeLedgerEvent(input: {
  eventId: string;
  sequence: number;
  at: z.infer<typeof asOfSchema>;
  kind: z.infer<typeof ledgerEventSchema>['kind'];
  outcome: z.infer<typeof ledgerEventSchema>['outcome'];
  source: z.infer<typeof simulationSourceSchema>;
  reasonCodes: z.infer<typeof ledgerEventSchema>['reasonCodes'];
  quantity: bigint | null;
  soldQty: bigint;
  unmetDemandQty: bigint;
  revenue: bigint;
  directProductCost: bigint;
  simulatedSpoilageCostExposure: bigint;
  before: StockState;
  after: StockState;
  price: z.infer<typeof moneySchema>;
  priceCandidate: z.infer<typeof ledgerEventSchema>['priceCandidate'];
  quantityScale: number;
  moneyOutputScale: number;
  currency: string;
  unitCode: string;
}): z.infer<typeof ledgerEventSchema> {
  return {
    eventId: input.eventId,
    sequence: input.sequence,
    at: input.at,
    kind: input.kind,
    outcome: input.outcome,
    source: input.source,
    reasonCodes: input.reasonCodes,
    quantity: input.quantity === null ? null : quantity(input.quantity, input.quantityScale, input.unitCode),
    soldQty: quantity(input.soldQty, input.quantityScale, input.unitCode),
    unmetDemandQty: quantity(input.unmetDemandQty, input.quantityScale, input.unitCode),
    revenue: money(input.revenue, input.currency, input.moneyOutputScale),
    directProductCost: money(input.directProductCost, input.currency, input.moneyOutputScale),
    simulatedSpoilageCostExposure: money(input.simulatedSpoilageCostExposure, input.currency, input.moneyOutputScale),
    stockBefore: stockState(input.before, input.quantityScale, input.unitCode),
    stockAfter: stockState(input.after, input.quantityScale, input.unitCode),
    priceAfter: input.price,
    priceCandidate: input.priceCandidate,
  };
}

function stockState(state: StockState, scale: number, unitCode: string): z.infer<typeof stockStateSchema> {
  return {
    physicalOnHand: quantity(state.physical, scale, unitCode),
    unavailable: quantity(state.unavailable, scale, unitCode),
    availableToSell: quantity(state.available, scale, unitCode),
    reserved: quantity(state.reserved, scale, unitCode),
  };
}

function quantity(value: bigint, scale: number, unitCode: string): z.infer<typeof quantitySchema> {
  const digits = value.toString();
  const normalized = scale === 0
    ? digits
    : `${digits.padStart(scale + 1, '0').slice(0, -scale)}.${digits.padStart(scale + 1, '0').slice(-scale)}`;
  const trimmed = normalized.includes('.') ? normalized.replace(/0+$/, '').replace(/\.$/, '') : normalized;
  return { value: trimmed, unitCode };
}

function money(minorUnits: bigint, currencyCode: string, minorUnitScale: number): z.infer<typeof moneySchema> {
  return { minorUnits: minorUnits.toString(), currencyCode, minorUnitScale };
}

function atScale(value: z.infer<typeof moneySchema>, scale: number): bigint {
  if (scale < value.minorUnitScale) throw new RangeError('Requested money scale is lower than its input scale');
  return BigInt(value.minorUnits) * (10n ** BigInt(scale - value.minorUnitScale));
}

function sameAsOf(left: z.infer<typeof asOfSchema>, right: z.infer<typeof asOfSchema>): boolean {
  return sameBasis(left, right) && compareAsOf(left, right) === 0;
}

type SimulationTime =
  | { readonly basis: 'DATE_ONLY'; readonly value: string; readonly timeZone: string }
  | { readonly basis: 'INSTANT'; readonly value: string };

function sameBasis(left: SimulationTime, right: SimulationTime): boolean {
  if (left.basis !== right.basis) return false;
  if (left.basis === 'DATE_ONLY' && right.basis === 'DATE_ONLY') return left.timeZone === right.timeZone;
  return left.basis === 'INSTANT';
}

function compareAsOf(left: z.infer<typeof asOfSchema>, right: z.infer<typeof asOfSchema>): -1 | 0 | 1 {
  if (left.basis === 'DATE_ONLY' && right.basis === 'DATE_ONLY') return compareDateOnly(left.value, right.value);
  if (left.basis === 'INSTANT' && right.basis === 'INSTANT') return compareInstants(left.value, right.value);
  return left.basis < right.basis ? -1 : left.basis > right.basis ? 1 : 0;
}

function asOfKey(value: z.infer<typeof asOfSchema>): string {
  return value.basis === 'DATE_ONLY' ? `${value.basis}:${value.timeZone}:${value.value}` : `${value.basis}:${value.value}`;
}

function reasonForSellability(reason: string): z.infer<typeof ledgerEventSchema>['reasonCodes'][number] {
  if (reason === 'QUALITY_FAILED') return 'QUALITY_FAILED';
  if (reason === 'UNKNOWN_QUALITY') return 'QUALITY_UNKNOWN';
  if (reason === 'EXPIRY_BOUNDARY') return 'EXPIRY_BOUNDARY';
  if (reason === 'AFTER_EXPIRY') return 'AFTER_EXPIRY';
  return 'BATCH_NOT_SELLABLE';
}

function initialSellabilityMayNeedEvent(
  qualityStatus: z.infer<typeof batchSchema>['qualityStatus'],
  expiry: z.infer<typeof batchSchema>['expiry'],
  clock: z.infer<typeof asOfSchema>,
): boolean {
  return assessSellability({ expiry, asOf: clock, qualityStatus }).status !== 'ELIGIBLE';
}

function notComputable(reason: 'INPUT_INVALID' | 'RESOURCE_LIMIT'): SingleSkuSimulationResult {
  return notComputableResultSchema.parse({
    contractVersion: '0.3.0',
    simulatorVersion: SINGLE_SKU_SIMULATOR_VERSION,
    status: 'NOT_COMPUTABLE',
    sourceKind: 'SIMULATED',
    businessApproval: 'NOT_GRANTED',
    executionAuthority: 'NONE',
    reasonCodes: [reason],
    events: [],
    claims: { realPriceCausality: 'NOT_ESTABLISHED', finalLossKpi: 'NOT_CLAIMED' },
  });
}

function preflightInput(input: unknown, context: z.RefinementCtx): void {
  let nodes = 0;
  let rejected = false;
  const visiting = new WeakSet<object>();
  const reject = (path: (string | number)[], message: string) => {
    if (rejected) return;
    rejected = true;
    context.addIssue({ code: 'custom', path, message });
  };
  const visit = (value: unknown, path: (string | number)[], depth: number): void => {
    if (rejected) return;
    nodes += 1;
    if (nodes > MAX_TREE_NODES || depth > MAX_TREE_DEPTH) {
      reject(path, 'Simulation input exceeds the safe structural resource limit');
      return;
    }
    if (typeof value === 'string') {
      if (value.length > MAX_TEXT_LENGTH) reject(path, 'Simulation text exceeds the safe input limit');
      if (path.at(-1) === 'value' && /^\d+(?:\.\d+)?$/.test(value)) {
        const parts = decimalParts(value);
        if (parts.whole.length + parts.fraction.length > MAX_DIGITS || parts.fraction.length > MAX_SCALE) {
          reject(path, 'Quantity exceeds the safe exact decimal dimensions');
        }
      }
      if (path.at(-1) === 'minorUnits' && /^-?(?:0|[1-9]\d*)$/.test(value)
        && value.replace('-', '').length > MAX_DIGITS) {
        reject(path, 'Money exceeds the safe exact integer dimensions');
      }
      return;
    }
    if (typeof value === 'number' && path.at(-1) === 'minorUnitScale'
      && (!Number.isSafeInteger(value) || value < 0 || value > MAX_SCALE)) {
      reject(path, 'Money scale exceeds the safe exact precision limit');
      return;
    }
    if (value === null || typeof value !== 'object') return;
    if (visiting.has(value)) {
      reject(path, 'Simulation input cannot contain cycles');
      return;
    }
    visiting.add(value);
    try {
      for (const [key, child] of Object.entries(value)) visit(child, [...path, Array.isArray(value) ? Number(key) : key], depth + 1);
    } finally {
      visiting.delete(value);
    }
  };
  visit(input, [], 0);
  if (!rejected && isRecord(input) && Array.isArray(input.events) && input.events.length > MAX_EVENTS) {
    reject(['events'], 'Simulation exceeds the maximum event count');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
