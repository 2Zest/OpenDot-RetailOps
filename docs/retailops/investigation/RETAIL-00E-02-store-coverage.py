import datetime
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request

REPO = "Dingdong-Inc/FreshRetailNet-50K"
REVISION = "c374e85975c82816c495acfa904cc55ab14a47d3"
BASE = "https://datasets-server.huggingface.co/filter"


def current_revision():
    url = f"https://huggingface.co/api/datasets/{REPO}/revision/main"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)["sha"]


def fetch_page(split, offset):
    params = {
        "dataset": REPO,
        "config": "default",
        "split": split,
        "where": '"store_id"=0',
        "offset": offset,
        "length": 100,
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            time.sleep(2 ** attempt)


def scan(split, expected_rows):
    first_body = fetch_page(split, 0)
    first = json.loads(first_body)
    total = first["num_rows_total"]
    assert total == expected_rows, (split, total, expected_rows)
    rows = []
    page_bodies = []
    for offset in range(0, total, 100):
        body = first_body if offset == 0 else fetch_page(split, offset)
        page = json.loads(body)
        assert page["partial"] is False
        assert page["num_rows_total"] == total
        assert len(page["rows"]) == min(100, total - offset)
        rows.extend(item["row"] for item in page["rows"])
        page_bodies.append(body)

    digest = hashlib.sha256()
    for body in page_bodies:
        digest.update(len(body).to_bytes(8, "big"))
        digest.update(body)

    by_sku = {}
    keys = set()
    for row in rows:
        assert row["store_id"] == 0
        sku = row["product_id"]
        day = datetime.date.fromisoformat(row["dt"])
        key = (row["store_id"], sku, day)
        assert key not in keys, (split, key)
        keys.add(key)
        by_sku.setdefault(sku, []).append(day)

    for sku, dates in by_sku.items():
        dates.sort()
        assert len(dates) == len(set(dates))
        assert all((right - left).days == 1 for left, right in zip(dates, dates[1:]))

    return rows, by_sku, len(page_bodies), digest.hexdigest(), len(keys)


assert current_revision() == REVISION
train = scan("train", 6660)
eval_data = scan("eval", 518)
assert current_revision() == REVISION

train_rows, train_by_sku, train_pages, train_hash, train_keys = train
eval_rows, eval_by_sku, eval_pages, eval_hash, eval_keys = eval_data
train_skus = set(train_by_sku)
eval_skus = set(eval_by_sku)
assert train_skus == eval_skus
assert len(train_skus) == 74
assert all(len(train_by_sku[sku]) == 90 for sku in train_skus)
assert all(len(eval_by_sku[sku]) == 7 for sku in eval_skus)
assert train_keys == len(train_rows) == 6660
assert eval_keys == len(eval_rows) == 518
assert not ({(0, sku, day) for sku, dates in train_by_sku.items() for day in dates}
            & {(0, sku, day) for sku, dates in eval_by_sku.items() for day in dates})

per_sku_dates = [set(train_by_sku[sku]) | set(eval_by_sku[sku]) for sku in train_skus]
common_dates = set.intersection(*per_sku_dates)
ordered_common = sorted(common_dates)
assert len(common_dates) == 97
assert ordered_common[0] == datetime.date(2024, 3, 28)
assert ordered_common[-1] == datetime.date(2024, 7, 2)
assert all((right - left).days == 1 for left, right in zip(ordered_common, ordered_common[1:]))
assert all(len(dates) == 97 for dates in per_sku_dates)

print(f"dataset_revision_before_after={REVISION}")
print(f"train_rows={len(train_rows)} pages={train_pages} unique_skus={len(train_skus)} unique_store_sku_date_keys={train_keys} sha256_length_prefixed_pages={train_hash}")
print(f"eval_rows={len(eval_rows)} pages={eval_pages} unique_skus={len(eval_skus)} unique_store_sku_date_keys={eval_keys} sha256_length_prefixed_pages={eval_hash}")
print(f"shared_skus={len(train_skus & eval_skus)} per_sku_days=train:90,eval:7,combined:97")
print(f"common_contiguous_window={ordered_common[0]}..{ordered_common[-1]} days={len(common_dates)}")
print("PASS: revision, pagination, store scope, SKU sets, composite keys, per-SKU continuity and common window")
