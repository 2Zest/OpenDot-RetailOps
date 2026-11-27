#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const revision = 'c374e85975c82816c495acfa904cc55ab14a47d3';
const dataset = 'Dingdong-Inc/FreshRetailNet-50K';
const trainSha256 = '4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005';
const evalSha256 = '0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2';
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const expected = {
  train: { sha256: trainSha256, rows: 6_660, firstDate: '2024-03-28', lastDate: '2024-06-25', daysPerSku: 90 },
  eval: { sha256: evalSha256, rows: 518, firstDate: '2024-06-26', lastDate: '2024-07-02', daysPerSku: 7 },
};
const methodIds = ['HISTORICAL_MEAN', 'NO_STOCKOUT_DAY_MEAN', 'HOURLY_AVAILABILITY_EXTRAPOLATION'];

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if ((key !== '--snapshot-dir' && key !== '--output') || typeof argv[index + 1] !== 'string') {
      throw new Error('Usage: node scripts/retail-05f/evaluate-fixed-snapshot.mjs --snapshot-dir <verified-snapshot-directory> [--output <report.json>]');
    }
    result[key === '--snapshot-dir' ? 'snapshotDir' : 'outputPath'] = resolve(argv[index + 1]);
    index += 1;
  }
  if (!result.snapshotDir) throw new Error('Missing required --snapshot-dir');
  return result;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadJsonl(path, split, sourceRecordSchema) {
  const bytes = readFileSync(path);
  const digest = sha256(bytes);
  assert(digest === expected[split].sha256, `${split} JSONL SHA-256 does not match the accepted fixed snapshot`);
  const text = bytes.toString('utf8');
  assert(text.endsWith('\n'), `${split} JSONL must end with a newline so row counting is unambiguous`);
  const lines = text.trimEnd().split('\n');
  assert(lines.length === expected[split].rows, `${split} row count mismatch: expected ${expected[split].rows}, got ${lines.length}`);
  const records = lines.map((line, index) => {
    let source;
    try {
      source = JSON.parse(line);
    } catch (error) {
      throw new Error(`${split} JSONL line ${index + 1} is invalid JSON: ${String(error)}`);
    }
    const parsed = sourceRecordSchema.safeParse({
      contractVersion: '0.3.0', dataset, datasetRevision: revision, license: 'CC BY 4.0', sourceSplit: split, source,
    });
    assert(parsed.success, `${split} JSONL line ${index + 1} fails the source record contract: ${parsed.success ? '' : parsed.error.message}`);
    return parsed.data;
  });
  return { records, sha256: digest, bytes: bytes.length };
}

function verifyManifests(snapshotDir) {
  const extraction = JSON.parse(readFileSync(join(snapshotDir, 'extraction-manifest.json'), 'utf8'));
  const downloads = JSON.parse(readFileSync(join(snapshotDir, 'download-manifest.json'), 'utf8'));
  assert(extraction.revision === revision && extraction.dataset === dataset && extraction.license === 'CC BY 4.0', 'Extraction manifest does not identify the approved dataset revision and license');
  assert(downloads.pinned_tree?.returned_revision === revision && downloads.dataset === dataset, 'Download manifest does not identify the fixed source revision');
  for (const split of ['train', 'eval']) {
    const file = expected[split];
    const coverage = extraction.coverage?.[split];
    const download = downloads.downloads?.find((entry) => entry.split === split);
    const sourceFile = extraction.source_files?.find((entry) => entry.split === split);
    assert(coverage?.row_count === file.rows && coverage.sku_count === 74 && coverage.store_id === 0
      && coverage.first_date === file.firstDate && coverage.last_date === file.lastDate
      && coverage.jsonl_sha256 === file.sha256 && coverage.unique_natural_keys === file.rows,
    `${split} extraction coverage manifest differs from the approved coverage`);
    assert(download?.pinned_revision === revision && download.http_status === 200
      && download.lfs_oid_sha256 === download.http_response_body_sha256
      && download.lfs_oid_sha256 === download.local_parquet_sha256,
    `${split} download manifest does not bind the source bytes to the pinned LFS object`);
    assert(sourceFile?.pinned_revision === revision && sourceFile.lfs_oid_sha256 === download.lfs_oid_sha256
      && sourceFile.local_parquet_sha256 === download.local_parquet_sha256,
    `${split} extraction manifest lost the pinned Parquet source identity`);
  }
  return extraction;
}

function datesBetween(start, count) {
  const dates = [];
  const date = new Date(`${start}T00:00:00.000Z`);
  for (let index = 0; index < count; index += 1) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

function groupAndVerify(records, split) {
  const bySku = new Map();
  const keys = new Set();
  for (const record of records) {
    const { store_id: storeId, product_id: skuId, dt } = record.source;
    assert(storeId === 0, `${split} contains a row outside store_id=0`);
    const key = `${storeId}\u001f${skuId}\u001f${dt}`;
    assert(!keys.has(key), `${split} contains duplicate natural key ${key}`);
    keys.add(key);
    const rows = bySku.get(skuId) ?? [];
    rows.push(record);
    bySku.set(skuId, rows);
  }
  assert(bySku.size === 74, `${split} SKU coverage mismatch: expected 74, got ${bySku.size}`);
  for (const [skuId, skuRows] of bySku) {
    skuRows.sort((left, right) => left.source.dt.localeCompare(right.source.dt));
    const file = expected[split];
    const wanted = datesBetween(file.firstDate, file.daysPerSku);
    assert(skuRows.length === file.daysPerSku, `${split} SKU ${skuId} has ${skuRows.length} rows, expected ${file.daysPerSku}`);
    assert(skuRows.every((row, index) => row.source.dt === wanted[index]), `${split} SKU ${skuId} has a missing or out-of-window date`);
  }
  return bySku;
}

function estimateForSku(estimateNormalizedDemand, estimate, rows, metadata) {
  const input = {
    method: estimate,
    records: rows,
    datasetRevision: revision,
    sourceSplit: 'train',
    sourceSha256: trainSha256,
    storeId: 0,
    skuId: rows[0]?.source.product_id ?? metadata.skuId,
    sourceWindow: metadata.sourceWindow,
    asOf: metadata.asOf,
    targetWindow: metadata.targetWindow,
  };
  return estimateNormalizedDemand(input);
}

function evaluateForecastSet(targetsBySku, estimatesBySku, split, displayMethods, compareMethods, summarizeMetrics) {
  const allPairs = [];
  const methodsCoverage = Object.fromEntries(displayMethods.map((method) => [method, { predictedRows: 0, targetRows: 0, predictedSkus: 0 }]));
  const perSku = [];
  const allSkuIds = [...targetsBySku.keys()].sort((left, right) => left - right);

  for (const skuId of allSkuIds) {
    const targets = targetsBySku.get(skuId) ?? [];
    const predictions = estimatesBySku.get(skuId) ?? {};
    const perMethodPairs = {};
    const methodResults = {};
    for (const method of displayMethods) {
      const estimate = predictions[method];
      const forecast = estimate?.status === 'ESTIMATED' ? estimate.value : null;
      const pairs = forecast === null || forecast === undefined
        ? []
        : targets.map((record) => ({ skuId, date: record.source.dt, actual: record.source.sale_amount, forecast }));
      perMethodPairs[method] = pairs;
      methodsCoverage[method].targetRows += targets.length;
      methodsCoverage[method].predictedRows += pairs.length;
      if (pairs.length > 0) methodsCoverage[method].predictedSkus += 1;
      allPairs.push(...pairs);
      methodResults[method] = {
        status: estimate?.status ?? 'NOT_RUN',
        forecast: forecast ?? null,
        trainingRows: estimate?.inputRowCount ?? 0,
        includedTrainingRows: estimate?.includedRowCount ?? 0,
        trainingInputEvidence: estimate === undefined ? null : {
          declaredWindow: estimate.sourceWindow,
          actualWindow: estimate.sourceCoverage.actualWindow,
          declaredDateCount: estimate.sourceCoverage.declaredDateCount,
          observedDateCount: estimate.sourceCoverage.observedDateCount,
          coverageRate: estimate.sourceCoverage.coverageRate,
          missingDates: estimate.sourceCoverage.missingDates,
          fixedSnapshotSha256: estimate.sourceSha256,
          fixedSnapshotDigestScope: estimate.sourceDigestScope,
        },
        coverageRows: pairs.length,
        targetRows: targets.length,
        metrics: summarizeMetrics(pairs),
        reasonCode: estimate?.reasonCode ?? null,
      };
    }
    const common = targets.filter((record) => compareMethods.every((method) => predictions[method]?.status === 'ESTIMATED'))
      .map((record) => ({ skuId, date: record.source.dt, actual: record.source.sale_amount }));
    perSku.push({
      skuId,
      targetRows: targets.length,
      methods: methodResults,
      commonValidRows: common.length,
    });
  }

  const comparableMethods = compareMethods.filter((method) => methodsCoverage[method].predictedRows > 0);
  const commonPairs = [];
  for (const skuId of allSkuIds) {
    const targets = targetsBySku.get(skuId) ?? [];
    const predictions = estimatesBySku.get(skuId) ?? {};
    if (!comparableMethods.every((method) => predictions[method]?.status === 'ESTIMATED')) continue;
    for (const record of targets) {
      commonPairs.push({
        skuId,
        date: record.source.dt,
        actual: record.source.sale_amount,
        forecasts: Object.fromEntries(comparableMethods.map((method) => [method, predictions[method].value])),
      });
    }
  }
  const commonMetrics = Object.fromEntries(comparableMethods.map((method) => [
    method,
    summarizeMetrics(commonPairs.map((pair) => ({ actual: pair.actual, forecast: pair.forecasts[method] }))),
  ]));
  const coverage = Object.fromEntries(displayMethods.map((method) => [
    method,
    {
      ...methodsCoverage[method],
      targetRows: methodsCoverage[method].targetRows,
      coverageRate: methodsCoverage[method].targetRows === 0 ? null : methodsCoverage[method].predictedRows / methodsCoverage[method].targetRows,
    },
  ]));
  return {
    split,
    targetRows: Object.values(methodsCoverage)[0]?.targetRows ?? 0,
    commonValidRows: commonPairs.length,
    methodsOnCommonValidSample: commonMetrics,
    coverage,
    perSku,
    internalPairs: allPairs,
  };
}

function selectValidationMethod(validation, methods) {
  const rows = Object.entries(validation.methodsOnCommonValidSample)
    .filter(([method]) => methods.includes(method))
    .filter(([, metrics]) => metrics.status === 'CALCULATED' && metrics.mae !== null);
  rows.sort(([leftMethod, left], [rightMethod, right]) =>
    left.mae - right.mae
      || (left.wape ?? Number.POSITIVE_INFINITY) - (right.wape ?? Number.POSITIVE_INFINITY)
      || leftMethod.localeCompare(rightMethod));
  return rows[0]?.[0] ?? null;
}

function formatReport({ extraction, train, eval: evalRows, trainSha, evalSha, estimateNormalizedDemand, summarizeMetrics }) {
  const trainBySku = groupAndVerify(train, 'train');
  const evalBySku = groupAndVerify(evalRows, 'eval');
  const skuIds = [...trainBySku.keys()].sort((left, right) => left - right);
  assert(skuIds.join(',') === [...evalBySku.keys()].sort((left, right) => left - right).join(','), 'Train/eval SKU sets do not match exactly');

  const validationTargets = new Map();
  const validationEstimates = new Map();
  const testEstimates = new Map();
  for (const skuId of skuIds) {
    const fullTrain = trainBySku.get(skuId);
    const validationTraining = fullTrain.slice(0, 76);
    const validationRows = fullTrain.slice(76, 90);
    const expectedValidationDates = datesBetween('2024-06-12', 14);
    assert(validationRows.map((row) => row.source.dt).join(',') === expectedValidationDates.join(','), `SKU ${skuId} validation window does not match the frozen 76/14 split`);
    const targets = evalBySku.get(skuId);
    validationTargets.set(skuId, validationRows);

    const validationMetadata = {
      sourceWindow: { start: validationTraining[0].source.dt, end: validationTraining.at(-1).source.dt },
      asOf: validationTraining.at(-1).source.dt,
      targetWindow: { start: validationRows[0].source.dt, end: validationRows.at(-1).source.dt },
      skuId,
    };
    const testMetadata = {
      sourceWindow: { start: fullTrain[0].source.dt, end: fullTrain.at(-1).source.dt },
      asOf: fullTrain.at(-1).source.dt,
      targetWindow: { start: targets[0].source.dt, end: targets.at(-1).source.dt },
      skuId,
    };
    validationEstimates.set(skuId, Object.fromEntries(methodIds.map((method) => [
      method,
      estimateForSku(estimateNormalizedDemand, method, validationTraining, validationMetadata),
    ])));
    testEstimates.set(skuId, Object.fromEntries(methodIds.map((method) => [
      method,
      estimateForSku(estimateNormalizedDemand, method, fullTrain, testMetadata),
    ])));
  }

  const comparableMethods = methodIds.filter((method) => method !== 'HOURLY_AVAILABILITY_EXTRAPOLATION');
  const validation = evaluateForecastSet(validationTargets, validationEstimates, 'VALIDATION_FROM_ORIGINAL_TRAIN', methodIds, comparableMethods, summarizeMetrics);
  const selectedMethod = selectValidationMethod(validation, comparableMethods);
  const test = evaluateForecastSet(evalBySku, testEstimates, 'FINAL_EVAL', methodIds, comparableMethods, summarizeMetrics);

  return {
    reportVersion: 'retailops.retail-05f-evaluation/1.0.0',
    sourceKind: 'DERIVED',
    sourceMeaning: 'PUBLIC_HISTORICAL normalized sale_amount; no conversion to physical units or money',
    dataset: extraction.dataset,
    license: extraction.license,
    revision,
    fixedSnapshot: {
      train: { sha256: trainSha.sha256, bytes: trainSha.bytes, rows: train.length, skuCount: 74, dateWindow: { start: '2024-03-28', end: '2024-06-25' } },
      validation: { sourceSplit: 'train', rows: 1_036, skuCount: 74, dateWindow: { start: '2024-06-12', end: '2024-06-25' } },
      eval: { sha256: evalSha.sha256, bytes: evalSha.bytes, rows: evalRows.length, skuCount: 74, dateWindow: { start: '2024-06-26', end: '2024-07-02' } },
      trainSha256: trainSha256,
      evalSha256: evalSha256,
    },
    inputEvidenceSemantics: {
      fixedSnapshotDigest: 'The evaluator verifies each full JSONL file SHA-256 against the accepted snapshot before parsing it.',
      estimatorSubsetEvidence: 'Per-SKU row count, declared window, actual date window, observed date count, coverage rate, and missing dates are computed from the records passed to the estimator.',
      estimatorDigestBoundary: 'The estimator receives the caller-declared full-snapshot SHA-256 for traceability; it does not independently authenticate the source or hash the per-SKU training subset.',
    },
    forecastProtocol: {
      validationTraining: { firstDays: 76, forecastCutoffInclusive: '2024-06-11', targets: '2024-06-12 through 2024-06-25' },
      finalTestTraining: { firstDays: 90, forecastCutoffInclusive: '2024-06-25', targets: '2024-06-26 through 2024-07-02' },
      features: ['Only sale_amount and the stock_hour6_22_cnt label in the corresponding training window'],
      targetLabelsUsedAsFeatures: false,
      validationUsedForMethodSelection: true,
      evalUsedForMethodSelection: false,
      selectionRule: 'Lowest validation MAE on the common valid SKU/date pairs; exact ties resolve by lower WAPE, then lexical method ID. The rule is frozen before final eval is read for metric calculation.',
      finalEvalForecasts: 'Each method is refit only on all 90 original train days; each of the 7 eval targets uses the same fixed-origin estimate.',
    },
    methods: {
      HISTORICAL_MEAN: 'Arithmetic mean of all valid normalized sale_amount rows in the training window.',
      NO_STOCKOUT_DAY_MEAN: 'Arithmetic mean of training rows with stock_hour6_22_cnt equal to zero; this is not causal lost-demand recovery.',
      HOURLY_AVAILABILITY_EXTRAPOLATION: 'BLOCKED; source contract validates 0/1 shape and count consistency but does not establish the label polarity/availability semantics needed for extrapolation.',
    },
    validation: {
      selectedMethod,
      comparisonSample: 'Only SKU/date pairs for which every compared method produced an estimate; method coverage is separately reported against all 1,036 validation targets.',
      metrics: validation.methodsOnCommonValidSample,
      coverage: validation.coverage,
      perSku: validation.perSku,
    },
    finalEval: {
      selectedMethod,
      comparisonSample: 'All compared methods and metrics are reported only after the validation selection is frozen; coverage is separately reported against all 518 official eval targets.',
      metrics: test.methodsOnCommonValidSample,
      coverage: test.coverage,
      perSku: test.perSku,
    },
    limitations: [
      'Normalized source observations and DERIVED estimates do not assert physical unit, real store representativeness, inventory, price, revenue, profit, or price causality.',
      'Forecast selection is a method comparison only and does not establish production defaults, operational approval, or RETAIL-12/19 loss KPIs.',
      'The conditional hourly availability extrapolation was NOT_RUN because the label meaning is not established by the approved source contract.',
    ],
  };
}

async function main() {
  const { snapshotDir, outputPath } = parseArguments(process.argv.slice(2));
  assert(statSync(snapshotDir).isDirectory(), `Snapshot directory does not exist: ${snapshotDir}`);
  const extraction = verifyManifests(snapshotDir);
  const sourceRecordModule = await import(pathToFileURL(join(repositoryRoot, 'apps/retailops/dist/domain/history/fresh-retailnet-record.js')));
  const estimatorModule = await import(pathToFileURL(join(repositoryRoot, 'apps/retailops/dist/domain/history/demand-estimation.js')));
  assert(typeof estimatorModule.estimateNormalizedDemand === 'function' && typeof estimatorModule.summarizeNormalizedForecastMetrics === 'function', 'Built demand-estimation module is missing a required estimator or metric export');
  const train = loadJsonl(join(snapshotDir, 'train-store-0.jsonl'), 'train', sourceRecordModule.freshRetailNetRecordSchema);
  const evalRows = loadJsonl(join(snapshotDir, 'eval-store-0.jsonl'), 'eval', sourceRecordModule.freshRetailNetRecordSchema);
  const report = formatReport({
    extraction,
    train: train.records,
    eval: evalRows.records,
    trainSha: { sha256: train.sha256, bytes: train.bytes },
    evalSha: { sha256: evalRows.sha256, bytes: evalRows.bytes },
    estimateNormalizedDemand: estimatorModule.estimateNormalizedDemand,
    summarizeMetrics: estimatorModule.summarizeNormalizedForecastMetrics,
  });

  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (outputPath) writeFileSync(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack : error) + '\n');
  process.exitCode = 1;
});
