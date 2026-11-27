#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const revision = 'c374e85975c82816c495acfa904cc55ab14a47d3';
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== '--snapshot-dir' || typeof argv[index + 1] !== 'string') {
      throw new Error('Usage: node scripts/retail-02/import-fixed-snapshot.mjs --snapshot-dir <fixed-extraction-directory>');
    }
    result.snapshotDir = resolve(argv[index + 1]);
    index += 1;
  }
  if (!result.snapshotDir) throw new Error('Missing required --snapshot-dir');
  return result;
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const { snapshotDir } = parseArguments(process.argv.slice(2));
  const extraction = JSON.parse(readFileSync(join(snapshotDir, 'extraction-manifest.json'), 'utf8'));
  const downloads = JSON.parse(readFileSync(join(snapshotDir, 'download-manifest.json'), 'utf8'));
  if (extraction.revision !== revision || downloads.pinned_tree?.returned_revision !== revision
    || extraction.dataset !== 'Dingdong-Inc/FreshRetailNet-50K') {
    throw new Error('Snapshot manifests do not identify the accepted fixed dataset revision');
  }

  const { openRetailOpsDatabase } = await import(pathToFileURL(join(repositoryRoot, 'apps/retailops/dist/adapters/persistence/sqlite/database.js')));
  const { SqlitePublicHistoryRepository } = await import(pathToFileURL(join(repositoryRoot, 'apps/retailops/dist/adapters/persistence/sqlite/public-history-repository.js')));
  const { importPublicHistory } = await import(pathToFileURL(join(repositoryRoot, 'apps/retailops/dist/application/use-cases/import-public-history.js')));

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'retailops-retail-02-'));
  const databasePath = join(temporaryDirectory, 'public-history.sqlite');
  writeFileSync(databasePath, Buffer.alloc(0), { flag: 'wx' });
  const database = openRetailOpsDatabase(databasePath);
  const repository = new SqlitePublicHistoryRepository(database);
  const splitResults = [];
  try {
    for (const split of ['train', 'eval']) {
      const coverage = extraction.coverage?.[split];
      const download = downloads.downloads?.find((entry) => entry.split === split);
      const fileName = split === 'train' ? 'train-store-0.jsonl' : 'eval-store-0.jsonl';
      if (!coverage || !download || download.pinned_revision !== revision) {
        throw new Error('Snapshot manifests are missing pinned ' + split + ' metadata');
      }
      const snapshotJsonl = readFileSync(join(snapshotDir, fileName));
      const manifest = {
        contractVersion: '0.3.0',
        dataset: extraction.dataset,
        datasetRevision: revision,
        license: extraction.license,
        sourceSplit: split,
        sourcePath: download.source_path,
        sourceBytes: download.local_parquet_bytes,
        sourceLfsObjectSha256: download.lfs_oid_sha256,
        sourceResponseBodySha256: download.http_response_body_sha256,
        sourceLocalFileSha256: download.local_parquet_sha256,
        rowCount: coverage.row_count,
        selectedStoreId: coverage.store_id,
        selectedSkuCount: coverage.sku_count,
        firstDate: coverage.first_date,
        lastDate: coverage.last_date,
        snapshotJsonlSha256: sha256(snapshotJsonl),
      };
      const imported = importPublicHistory({ manifest, snapshotJsonl }, repository);
      if (imported.status !== 'IMPORTED') {
        throw new Error('Formal ' + split + ' import rejected: ' + JSON.stringify(imported.issues));
      }

      const sourceRows = snapshotJsonl.toString('utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
      const queried = repository.find({ datasetRevision: revision, sourceSplit: split, storeId: 0 });
      const queriedByNaturalKey = new Map(queried.map((item) => [
        item.record.source.product_id + '/' + item.record.source.dt,
        canonical(item.record.source),
      ]));
      if (queriedByNaturalKey.size !== sourceRows.length
        || sourceRows.some((row) => queriedByNaturalKey.get(row.product_id + '/' + row.dt) !== canonical(row))) {
        throw new Error(split + ' query rows differ from the fixed JSONL source');
      }
      splitResults.push({
        split,
        sourceSha256: sha256(snapshotJsonl),
        sourceRows: sourceRows.length,
        importedRows: imported.persistence.insertedRecords,
        unchangedRows: imported.persistence.unchangedRecords,
        queriedRows: queried.length,
        skuCount: new Set(sourceRows.map((row) => row.product_id)).size,
        firstDate: sourceRows[0]?.dt,
        lastDate: sourceRows.at(-1)?.dt,
      });
    }
    const total = splitResults.reduce((sum, item) => sum + item.queriedRows, 0);
    if (total !== 7_178) throw new Error('Expected exactly 7,178 fixed store-0 records; found ' + total);
    process.stdout.write(JSON.stringify({ status: 'PASS', revision, databasePath, totalQueriedRows: total, splitResults }, null, 2) + '\n');
  } finally {
    database.close();
  }
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack : error) + '\n');
  process.exitCode = 1;
});
