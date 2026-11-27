# RETAIL-02（Issue #21）N1 固定来源与字段映射验收

日期：2026-11-27
固定数据集：`Dingdong-Inc/FreshRetailNet-50K`
固定 revision：`c374e85975c82816c495acfa904cc55ab14a47d3`
许可：CC BY 4.0

## 节点目标与范围

复核固定 revision 的实际来源文件，记录 LFS 对象 SHA、HTTP 响应体 SHA 和本地 Parquet SHA；在批准的编码门店 `store_id=0` 范围内按原 train/eval split 解码，验证 74 个 SKU 的 97 日共同覆盖和原始字段结构。这里只确认公开历史数据导入范围，不把编码门店解释为现实门店，也不将归一化销量转换为实物数量、库存、价格、金额或利润。

## 固定 revision 与文件哈希

本轮脚本实际请求 Hugging Face revision API 和该 commit 的文件 tree API。revision endpoint 返回 SHA 与请求一致。脚本对 revision/tree JSON 采用排序紧凑 JSON 序列化后计算响应对象 SHA；Parquet 下载响应体则单独按原始字节计算 SHA。Tree 中的 LFS OID 和文件大小先于下载核对。

| 文件 | 固定 commit 路径 | 大小 | Tree LFS OID SHA-256 | 本轮 HTTP 响应体 SHA-256 | 本地 Parquet SHA-256 |
|---|---|---:|---|---|---|
| train | `data/train.parquet` | 106,436,287 bytes | `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d` | `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d` | `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d` |
| eval | `data/eval.parquet` | 8,440,124 bytes | `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e` | `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e` | `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e` |

两份文件各自的响应字节数、落盘字节数和 tree 大小完全相等；本地文件 SHA 与对应 LFS OID 一致。没有用历史调查缓存或无固定 SHA 证据的 Viewer `/filter` 响应代替本轮来源文件。

本轮来源元数据对象摘要：revision API 规范化响应 SHA-256 `6872e274ff1756c0f1ac301c851d2e0a218626ece9a9972f2436155049271db4`；tree API 规范化响应 SHA-256 `1f3440bbd818eb5457dc7e16ab3a8e9a8dfc24e9cade7ddc1c69c801ff75693e`。两端实际 HTTP 状态均为 200，返回 revision 为上述固定 SHA。规范化响应摘要用于复核本轮元数据对象，不冒充原始 Parquet 哈希。

## 解码工具来源

经主控批准，使用仓库外的一次性 DuckDB CLI 解码 Parquet；没有修改项目依赖或锁文件，也没有把工具、Parquet 或 JSONL 数据加入 Git。

| 项目 | 实际值 |
|---|---|
| 工具 | DuckDB CLI `v2.0.1 (Cyanoptera) 8d78114e90` |
| 官方 release | [DuckDB v2.0.1](https://github.com/duckdb/duckdb/releases/tag/v2.0.1) |
| Linux amd64 release archive SHA-256 | `b676268be4d39e4e41a904442c9796c9914e645cc085c7505f048f2c992b5eca` |
| 实际 CLI binary SHA-256 | `47d96c334a04beb3b6b9d6571eb49b97af9f6ab2d4f96d4d8eb9a3f406962117` |
| 解码 SQL 退出码 | 0 |

## 覆盖与完整性结果

原 Parquet train、eval split 分别筛选 `store_id=0`，按 `product_id, dt` 排序，仅导出原始列，不重写字段值。

| 来源 split | 行数 | SKU 数 | 每 SKU 日期数 | 日期范围 | 复合键唯一数 |
|---|---:|---:|---:|---|---:|
| train | 6,660 | 74 | 90 | 2024-03-28 至 2024-06-25 | 6,660 |
| eval | 518 | 74 | 7 | 2024-06-26 至 2024-07-02 | 518 |
| 合计 | 7,178 | 同一 74 个 | 连续 97 日 | 2024-03-28 至 2024-07-02 | 7,178 |

每个 split 的 74 个 SKU 均分别覆盖其完整连续日期窗口；train 和 eval 的 SKU 集完全相同，时间相邻且不重叠；自然键 `(store_id, product_id, dt)` 无重复。所有 19 个字段均无空值。`hours_sale` 和 `hours_stock_status` 每行长度均为 24；前者为有限数值数组，后者为 0/1 整数状态数组。更新后的可复现 JSONL 校验脚本还对全部 7,178 行验证 `stock_hour6_22_cnt == sum(hours_stock_status[6:22])`。覆盖范围只证明该公开编码门店的已批准导入样本，不代表现实门店目录完整，也不表示 V0 多 SKU 仿真已获支持。

筛选 JSONL 快照 SHA-256：

| 文件 | 行数 | 本地 SHA-256 |
|---|---:|---|
| `train-store-0.jsonl` | 6,660 | `4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005` |
| `eval-store-0.jsonl` | 518 | `0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2` |

筛选 manifest SHA-256：`251399b529ad6c272a62e99944bc67d203e3b81272843d1a1c02b2fd7d30eb9e`。下载与提取 manifest、Parquet、JSONL 均只存于被忽略的 `data/retail-02/`，不随本回执提交。

JSONL 固定字节合同：DuckDB `COPY ... (FORMAT JSON, ARRAY false)` 产生 UTF-8 原始列序对象流，按 `product_id, dt` 升序，每行一个 JSON 对象，以 LF 分隔且最终 LF 必须存在；不接受 BOM、CRLF 或空行。N2 应用入口对收到的完整原始 `Uint8Array` 逐字节重算 SHA-256，并与 `snapshotJsonlSha256` 比较后再解析和校验；不以重序列化后对象摘要代替源快照字节摘要。

## 原始字段类型及语义边界

Parquet schema 通过 DuckDB `DESCRIBE` 检查。以下字段名、标量/数组类型与值均原样保留；字段业务含义遵循已合并的 [RETAIL-00E-02 调查](../investigation/RETAIL-00E-02.md)。

| 原始字段 | Parquet 类型 | 语义与导入边界 |
|---|---|---|
| `city_id`, `store_id`, `management_group_id` | `BIGINT` | 编码标识，不提供现实实体映射 |
| `first_category_id`, `second_category_id`, `third_category_id`, `product_id` | `BIGINT` | 编码品类/SKU 标识 |
| `dt` | `VARCHAR` | `YYYY-MM-DD` 来源日期 |
| `sale_amount` | `DOUBLE` | 提供方归一化日销量，不是实际件数、重量或金额 |
| `hours_sale` | `DOUBLE[]` | 24 项归一化小时销量，不转换为实物数量或金额 |
| `stock_hour6_22_cnt` | `INTEGER` | 06:00–22:00 缺货小时计数，是标签，不是库存数量 |
| `hours_stock_status` | `BIGINT[]` | 24 项小时库存状态；本次样本值为 0/1 |
| `discount` | `DOUBLE` | 数据集折扣指标；不据此推断本地商品售价 |
| `holiday_flag`, `activity_flag` | `INTEGER` | 来源标记 |
| `precpt`, `avg_temperature`, `avg_humidity`, `avg_wind_level` | `DOUBLE` | 来源天气字段；不从字段名猜测业务单位 |

本任务不将 `sale_amount`、`hours_sale` 转换为实物数量、价格、库存、金额或利润，不将缺货标签解释为库存数量，不把仿真字段写入 `PUBLIC_HISTORICAL`。原始 `source_split`、固定 revision、许可和来源标识都必须随导入记录保留。

## 可复现命令与结果

以下命令在 WSL Ubuntu、Node v24.22.3 / npm 11.19.1 环境执行；数据获取/解码使用 Python 标准库和获批的外部 DuckDB CLI。路径使用 `$SNAPSHOT` 表示本机被忽略的运行目录；实际命令中的目录固定为 `data/retail-02/freshretailnet-c374e85975c82816c495acfa904cc55ab14a47d3-2026-11-27-01`。

```bash
python3 scripts/retail-02/fetch-fixed-snapshot.py \
  --output-dir data/retail-02/freshretailnet-c374e85975c82816c495acfa904cc55ab14a47d3-2026-11-27-01
# 退出码：0；固定 revision/tree、LFS OID、HTTP body 和本地文件 SHA 均核对通过。

python3 scripts/retail-02/fetch-fixed-snapshot.py \
  --extract-dir "$SNAPSHOT" \
  --duckdb-cli /mnt/d/workSpace/retailops-tools/duckdb-cli-v2.0.1/duckdb \
  --duckdb-archive-sha256 b676268be4d39e4e41a904442c9796c9914e645cc085c7505f048f2c992b5eca
# 退出码：0；导出并验证 store_id=0 的 train/eval JSONL 与覆盖 manifest。

duckdb :memory: -c "DESCRIBE SELECT * FROM read_parquet('$SNAPSHOT/train.parquet');"
# 退出码：0；19 列 schema 与字段表相符。

duckdb :memory: -c "SELECT count(*) AS rows, count(DISTINCT product_id) AS skus, count(DISTINCT dt) AS dates, min(dt), max(dt), count(*) FILTER (WHERE array_length(hours_sale) <> 24 OR array_length(hours_stock_status) <> 24) AS bad_vectors, count(*) FILTER (WHERE city_id IS NULL OR store_id IS NULL OR management_group_id IS NULL OR first_category_id IS NULL OR second_category_id IS NULL OR third_category_id IS NULL OR product_id IS NULL OR dt IS NULL OR sale_amount IS NULL OR hours_sale IS NULL OR stock_hour6_22_cnt IS NULL OR hours_stock_status IS NULL OR discount IS NULL OR holiday_flag IS NULL OR activity_flag IS NULL OR precpt IS NULL OR avg_temperature IS NULL OR avg_humidity IS NULL OR avg_wind_level IS NULL) AS null_rows FROM read_parquet('$SNAPSHOT/train.parquet') WHERE store_id=0;"
# 退出码：0；结果为 6660 行、74 SKU、90 日期、bad_vectors=0、null_rows=0。

python3 -c 'import json,pathlib,sys; p=pathlib.Path(sys.argv[1]); rows=[json.loads(x) for x in p.open(encoding="utf-8")]; print(len(rows),len({r["product_id"] for r in rows}))' "$SNAPSHOT/train-store-0.jsonl"
# 退出码：0；完整逐行、字段类型、自然键和每 SKU 连续日期检查由获取脚本完成。

python3 -c 'import runpy,pathlib,sys; n=runpy.run_path(sys.argv[1]); p=pathlib.Path(sys.argv[2]); n["verify_jsonl_snapshot"](p/"train-store-0.jsonl","train"); n["verify_jsonl_snapshot"](p/"eval-store-0.jsonl","eval")' \
  scripts/retail-02/fetch-fixed-snapshot.py "$SNAPSHOT"
# 退出码：0；本轮最终脚本重新核验两份已导出 JSONL 的 7,178 行，包括 stock-hour 与 24 项状态数组一致性。
```

一次探索性 SQL 曾把 `array_length()` 错用于标量 `sale_amount`，DuckDB 返回 Binder Error；修正后只对两个数组字段检查长度，完整 schema/profile 查询与提取脚本均退出码 0。该 SQL 错误未改变任何源数据或导入状态，也没有作为通过证据。

## 节点验收与未验证事项

| 语义层 | 对齐结果 | 判定 |
|---|---|---|
| 总体计划 / 场景 | 固定来源、原始 split、归一化单位限制均保留；无虚构物理业务单位 | PASS |
| Issue #21 / Execution Plan | 本轮重取 fixed revision 数据，并得到批准的 74 SKU / 97 日范围 | PASS |
| N1 节点标准 | 来源 revision、LFS/HTTP/local SHA、原始 schema、空值/键/日期/数组检查和工具 provenance 可复核 | PASS |

- 实际动作：从固定 revision 获取 train/eval Parquet，校验 tree/LFS 元数据、响应体和落盘摘要；使用临时 DuckDB 解码 `store_id=0` 原始行；校验 74 个 SKU 与 97 日连续覆盖。
- 本节点修改文件：`scripts/retail-02/fetch-fixed-snapshot.py`（固定 revision 下载、LFS/HTTP/local hash 校验、DuckDB 解码及原始 JSONL 结构/profile 检查）、`docs/retailops/acceptance/RETAIL-02-N1.md`（本回执）。N2–N4 实现文件按执行计划的独占路径维护，不在本节点结论中提前判通过。
- 实际证据：`download-manifest.json`、`extraction-manifest.json`、原始 Parquet 与 JSONL 快照在本机 `data/retail-02/` 忽略目录中；其摘要见本回执。
- 本节点结论：来源获取与样本结构核验 PASS。该结论不等于 SQLite 导入、Repository 查询或业务运行验收通过；这些由 N2/N3 及后续节点验证。
- N1 范围外未验证事项：本回执没有单独验收 TypeScript importer/SQLite 持久化；这些由后续 N2/N3 实测记录。没有预测、仿真、Agent、API 或真实业务写入。
