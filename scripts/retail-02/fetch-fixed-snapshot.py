#!/usr/bin/env python3
"""Download the two public Parquet files from a fixed Hugging Face dataset commit.

This script writes only under --output-dir. It never overwrites an existing run
or removes a partial download. No third-party Python packages are required.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import pathlib
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from typing import Any

DATASET = "Dingdong-Inc/FreshRetailNet-50K"
REVISION = "c374e85975c82816c495acfa904cc55ab14a47d3"
LICENSE = "CC BY 4.0"
EXPECTED_FILES = {
    "train": {
        "path": "data/train.parquet",
        "size": 106_436_287,
        "lfs_sha256": "6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d",
    },
    "eval": {
        "path": "data/eval.parquet",
        "size": 8_440_124,
        "lfs_sha256": "1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e",
    },
}
USER_AGENT = "OpenDot-RetailOps-RETAIL-02/1.0 (public data import verification)"
EXPECTED_COLUMNS = (
    "city_id", "store_id", "management_group_id", "first_category_id", "second_category_id",
    "third_category_id", "product_id", "dt", "sale_amount", "hours_sale", "stock_hour6_22_cnt",
    "hours_stock_status", "discount", "holiday_flag", "activity_flag", "precpt", "avg_temperature",
    "avg_humidity", "avg_wind_level",
)


def fetch_json(url: str) -> tuple[Any, dict[str, str], int]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        return json.loads(raw), dict(response.headers.items()), response.status


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_fixed_tree() -> dict[str, Any]:
    revision_url = "https://huggingface.co/api/datasets/" + DATASET + "/revision/" + REVISION
    revision_object, revision_headers, revision_status = fetch_json(revision_url)
    returned_sha = revision_object.get("sha")
    if revision_status != 200 or returned_sha != REVISION:
        raise RuntimeError("Fixed revision endpoint did not return the requested commit: " + repr(returned_sha))

    tree_query = urllib.parse.urlencode({"recursive": "true", "expand": "false"})
    tree_url = (
        "https://huggingface.co/api/datasets/" + DATASET + "/tree/" + REVISION + "?" + tree_query
    )
    tree, tree_headers, tree_status = fetch_json(tree_url)
    if tree_status != 200 or not isinstance(tree, list):
        raise RuntimeError("Dataset tree endpoint returned an unexpected response")

    entries = {entry.get("path"): entry for entry in tree if isinstance(entry, dict)}
    verified: dict[str, Any] = {}
    for split, expected in EXPECTED_FILES.items():
        entry = entries.get(expected["path"])
        lfs = entry.get("lfs") if isinstance(entry, dict) else None
        if (
            entry is None
            or entry.get("size") != expected["size"]
            or not isinstance(lfs, dict)
            or lfs.get("oid") != expected["lfs_sha256"]
            or lfs.get("size") != expected["size"]
        ):
            raise RuntimeError("Pinned tree metadata mismatch for " + expected["path"])
        verified[split] = {
            "path": expected["path"],
            "size": expected["size"],
            "lfs_sha256": expected["lfs_sha256"],
        }

    return {
        "revision_url": revision_url,
        "revision_http_status": revision_status,
        "revision_response_sha256": hashlib.sha256(
            json.dumps(revision_object, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
        "returned_revision": returned_sha,
        "tree_url": tree_url,
        "tree_http_status": tree_status,
        "tree_response_sha256": hashlib.sha256(
            json.dumps(tree, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
        "tree_headers": tree_headers,
        "files": verified,
        "revision_headers": revision_headers,
    }


def download_file(split: str, expected: dict[str, Any], output_dir: pathlib.Path) -> dict[str, Any]:
    encoded_path = urllib.parse.quote(expected["path"], safe="/")
    url = (
        "https://huggingface.co/datasets/"
        + DATASET
        + "/resolve/"
        + REVISION
        + "/"
        + encoded_path
        + "?download=true"
    )
    local_path = output_dir / (split + ".parquet")
    if local_path.exists():
        raise FileExistsError("Refusing to overwrite existing file: " + str(local_path))

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    http_digest = hashlib.sha256()
    bytes_received = 0
    with urllib.request.urlopen(request, timeout=180) as response:
        status = response.status
        final_url = response.geturl()
        headers = dict(response.headers.items())
        if status != 200:
            raise RuntimeError("Expected HTTP 200 for " + split + ", got " + str(status))
        with local_path.open("xb") as destination:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                destination.write(chunk)
                http_digest.update(chunk)
                bytes_received += len(chunk)

    # Independently hash the saved file after the response stream has completed.
    local_digest = sha256_file(local_path)
    expected_hash = expected["lfs_sha256"]
    if bytes_received != expected["size"] or local_path.stat().st_size != expected["size"]:
        raise RuntimeError(
            split + " size mismatch: response=" + str(bytes_received)
            + " local=" + str(local_path.stat().st_size)
        )
    if http_digest.hexdigest() != expected_hash or local_digest != expected_hash:
        raise RuntimeError(
            split + " SHA-256 mismatch: LFS=" + expected_hash
            + " HTTP=" + http_digest.hexdigest()
            + " local=" + local_digest
        )

    return {
        "split": split,
        "source_path": expected["path"],
        "pinned_revision": REVISION,
        "source_url": url,
        "http_final_host": urllib.parse.urlsplit(final_url).netloc,
        "http_final_path": urllib.parse.urlsplit(final_url).path,
        "http_status": status,
        "http_content_length": headers.get("Content-Length"),
        "http_etag": headers.get("ETag"),
        "response_bytes": bytes_received,
        "lfs_oid_sha256": expected_hash,
        "http_response_body_sha256": http_digest.hexdigest(),
        "local_parquet_path": str(local_path),
        "local_parquet_bytes": local_path.stat().st_size,
        "local_parquet_sha256": local_digest,
    }


def verify_jsonl_snapshot(path: pathlib.Path, split: str) -> dict[str, Any]:
    expected_count = 6_660 if split == "train" else 518
    expected_days = 90 if split == "train" else 7
    start = date.fromisoformat("2024-03-28" if split == "train" else "2024-06-26")
    product_dates: dict[int, list[date]] = {}
    keys: set[tuple[int, int, str]] = set()
    row_count = 0

    with path.open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"Invalid {split} JSONL at line {line_number}: {error}") from error
            if not isinstance(row, dict) or tuple(row.keys()) != EXPECTED_COLUMNS:
                raise RuntimeError(f"Unexpected {split} source columns/order at line {line_number}")
            if any(value is None for value in row.values()):
                raise RuntimeError(f"Unexpected null source field in {split} at line {line_number}")
            for name in ("city_id", "store_id", "management_group_id", "first_category_id", "second_category_id",
                         "third_category_id", "product_id", "stock_hour6_22_cnt", "holiday_flag", "activity_flag"):
                if type(row[name]) is not int:
                    raise RuntimeError(f"Expected integer {name} in {split} at line {line_number}")
            for name in ("sale_amount", "discount", "precpt", "avg_temperature", "avg_humidity", "avg_wind_level"):
                if type(row[name]) not in (int, float) or not math.isfinite(row[name]):
                    raise RuntimeError(f"Expected numeric {name} in {split} at line {line_number}")
            if not isinstance(row["dt"], str):
                raise RuntimeError(f"Expected source date string in {split} at line {line_number}")
            try:
                record_date = date.fromisoformat(row["dt"])
            except ValueError as error:
                raise RuntimeError(f"Invalid source date in {split} at line {line_number}") from error
            if record_date.isoformat() != row["dt"]:
                raise RuntimeError(f"Non-canonical source date in {split} at line {line_number}")
            if row["store_id"] != 0:
                raise RuntimeError(f"Unexpected store in {split} at line {line_number}")
            for name in ("hours_sale", "hours_stock_status"):
                vector = row[name]
                if not isinstance(vector, list) or len(vector) != 24:
                    raise RuntimeError(f"Unexpected {name} vector in {split} at line {line_number}")
                if any(type(item) not in (int, float) or not math.isfinite(item) for item in vector):
                    raise RuntimeError(f"Non-numeric {name} item in {split} at line {line_number}")
                if name == "hours_stock_status" and any(type(item) is not int or item not in (0, 1) for item in vector):
                    raise RuntimeError(f"Unexpected status value in {split} at line {line_number}")
            if row["stock_hour6_22_cnt"] != sum(row["hours_stock_status"][6:22]):
                raise RuntimeError(f"Out-of-stock hour count disagrees with source status vector in {split} at line {line_number}")

            key = (row["store_id"], row["product_id"], row["dt"])
            if key in keys:
                raise RuntimeError(f"Duplicate source key in {split} at line {line_number}: {key!r}")
            keys.add(key)
            product_dates.setdefault(row["product_id"], []).append(record_date)
            row_count += 1

    if row_count != expected_count or len(product_dates) != 74:
        raise RuntimeError(f"Unexpected {split} coverage: rows={row_count}, skus={len(product_dates)}")
    expected_dates = [start + timedelta(days=offset) for offset in range(expected_days)]
    for product_id, observed_dates in product_dates.items():
        if sorted(observed_dates) != expected_dates:
            raise RuntimeError(f"SKU {product_id} does not have {expected_days} continuous {split} dates")

    return {
        "split": split,
        "row_count": row_count,
        "sku_count": len(product_dates),
        "store_id": 0,
        "first_date": expected_dates[0].isoformat(),
        "last_date": expected_dates[-1].isoformat(),
        "dates_per_sku": expected_days,
        "unique_natural_keys": len(keys),
        "jsonl_path": str(path),
        "jsonl_bytes": path.stat().st_size,
        "jsonl_sha256": sha256_file(path),
    }


def extract_snapshot(snapshot_dir: pathlib.Path, duckdb_cli: pathlib.Path, duckdb_archive_sha256: str) -> None:
    download_manifest_path = snapshot_dir / "download-manifest.json"
    download_manifest = json.loads(download_manifest_path.read_text(encoding="utf-8"))
    if download_manifest.get("revision") != REVISION or download_manifest.get("dataset") != DATASET:
        raise RuntimeError("Download manifest does not describe the approved fixed dataset revision")

    for split, expected in EXPECTED_FILES.items():
        local_file = snapshot_dir / (split + ".parquet")
        if local_file.stat().st_size != expected["size"] or sha256_file(local_file) != expected["lfs_sha256"]:
            raise RuntimeError("Local Parquet file no longer matches pinned LFS object for " + split)

    train_jsonl = snapshot_dir / "train-store-0.jsonl"
    eval_jsonl = snapshot_dir / "eval-store-0.jsonl"
    if train_jsonl.exists() or eval_jsonl.exists():
        raise FileExistsError("Refusing to overwrite an existing extracted snapshot")

    cli_path = duckdb_cli.resolve()
    version_result = subprocess.run([str(cli_path), "--version"], check=True, capture_output=True, text=True)
    sql = "\n".join([
        "COPY (SELECT * FROM read_parquet('" + str(snapshot_dir / "train.parquet").replace("\\", "/")
        + "') WHERE store_id=0 ORDER BY product_id, dt) TO '" + str(train_jsonl).replace("\\", "/")
        + "' (FORMAT JSON, ARRAY false);",
        "COPY (SELECT * FROM read_parquet('" + str(snapshot_dir / "eval.parquet").replace("\\", "/")
        + "') WHERE store_id=0 ORDER BY product_id, dt) TO '" + str(eval_jsonl).replace("\\", "/")
        + "' (FORMAT JSON, ARRAY false);",
    ])
    query_result = subprocess.run([str(cli_path), ":memory:", "-c", sql], check=True, capture_output=True, text=True)

    train = verify_jsonl_snapshot(train_jsonl, "train")
    evaluation = verify_jsonl_snapshot(eval_jsonl, "eval")
    train_manifest = next(item for item in download_manifest["downloads"] if item["split"] == "train")
    eval_manifest = next(item for item in download_manifest["downloads"] if item["split"] == "eval")
    manifest = {
        "dataset": DATASET,
        "revision": REVISION,
        "license": LICENSE,
        "source_semantics": "Provider-normalized historical observations; values are not converted into physical units, inventory, prices, revenue, or profit.",
        "source_files": [
            {key: train_manifest[key] for key in ("split", "source_path", "pinned_revision", "http_status", "lfs_oid_sha256", "http_response_body_sha256", "local_parquet_bytes", "local_parquet_sha256")},
            {key: eval_manifest[key] for key in ("split", "source_path", "pinned_revision", "http_status", "lfs_oid_sha256", "http_response_body_sha256", "local_parquet_bytes", "local_parquet_sha256")},
        ],
        "decoder": {
            "name": "DuckDB CLI",
            "version_output": version_result.stdout.strip(),
            "binary_sha256": sha256_file(cli_path),
            "release_archive_sha256": duckdb_archive_sha256,
            "query_exit_code": query_result.returncode,
            "query_stdout": query_result.stdout.strip(),
        },
        "selection": "store_id = 0; source_split preserved; raw source fields emitted without conversion",
        "coverage": {"train": train, "eval": evaluation, "total_sku_count": 74, "total_continuous_days": 97},
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }
    train_products = set()
    eval_products = set()
    for path, target in ((train_jsonl, train_products), (eval_jsonl, eval_products)):
        with path.open("r", encoding="utf-8") as source:
            for line in source:
                target.add(json.loads(line)["product_id"])
    if train_products != eval_products:
        raise RuntimeError("Train/eval product_id sets differ")
    manifest_path = snapshot_dir / "extraction-manifest.json"
    with manifest_path.open("x", encoding="utf-8", newline="\n") as destination:
        json.dump(manifest, destination, ensure_ascii=False, sort_keys=True, indent=2)
        destination.write("\n")
    print(json.dumps({"manifest": str(manifest_path), "manifest_sha256": sha256_file(manifest_path),
                      "coverage": manifest["coverage"], "decoder": manifest["decoder"]}, ensure_ascii=False, sort_keys=True))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir")
    parser.add_argument("--extract-dir")
    parser.add_argument("--duckdb-cli")
    parser.add_argument("--duckdb-archive-sha256")
    args = parser.parse_args()

    if args.extract_dir:
        if not args.duckdb_cli or not args.duckdb_archive_sha256:
            parser.error("--extract-dir requires --duckdb-cli and --duckdb-archive-sha256")
        extract_snapshot(pathlib.Path(args.extract_dir).resolve(), pathlib.Path(args.duckdb_cli), args.duckdb_archive_sha256)
        return 0
    if not args.output_dir:
        parser.error("--output-dir is required unless --extract-dir is specified")

    output_dir = pathlib.Path(args.output_dir).resolve()
    if output_dir.exists():
        raise FileExistsError("Refusing to overwrite existing output directory: " + str(output_dir))
    output_dir.mkdir(parents=True, exist_ok=False)

    started_at = datetime.now(timezone.utc).isoformat()
    pinned = verify_fixed_tree()
    downloads = [
        download_file(split, expected, output_dir)
        for split, expected in EXPECTED_FILES.items()
    ]
    manifest = {
        "dataset": DATASET,
        "revision": REVISION,
        "license": LICENSE,
        "attribution": "Dingdong-Inc, FreshRetailNet-50K; data card revision " + REVISION,
        "started_at": started_at,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "tool": "Python standard library urllib/hashlib/json; no third-party packages",
        "pinned_tree": pinned,
        "downloads": downloads,
    }
    manifest_path = output_dir / "download-manifest.json"
    with manifest_path.open("x", encoding="utf-8", newline="\n") as destination:
        json.dump(manifest, destination, ensure_ascii=False, sort_keys=True, indent=2)
        destination.write("\n")

    print(json.dumps({
        "manifest": str(manifest_path),
        "manifest_sha256": sha256_file(manifest_path),
        "downloads": downloads,
    }, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        raise SystemExit(1)
