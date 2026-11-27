# RETAIL-02（Issue #21）执行计划

**状态：** N0 主控核验通过；N1–N5 已获批准
**基线：** develop/retailops `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`
**原 Plan：** `docs/retailops/initial-plan-v0.2/plans/RETAIL-02-PLAN.md`（只读）
**上游：** #20 PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d`；#13 PR #79 merge `6a2ddc363f82ae9f9e66e296d2644efafb48565e`。

## 来源与语义冻结

复用已合并的 #13 调查报告、验收回执及 `RETAIL-00E-02-store-coverage.py`。FreshRetailNet-50K 数据卡 revision `c374e85975c82816c495acfa904cc55ab14a47d3`，许可 CC BY 4.0。上游 LFS 对象 SHA-256：train `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d`；eval `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e`。上游未下载整文件，LFS SHA 不代表本地文件哈希。

调查已验证编码 `store_id=0`：train 6,660 行/74 SKU、eval 518 行/同一 74 SKU，共同连续窗口 2024-03-28 至 2024-07-02（97 天）。分页响应聚合 SHA-256：train `60b5ee76e48f94549b74d21119b7b249b409edbf2748a56327cf9bc536f4ee85`；eval `f710d7bea6428190da664ada60869fca4b09b1a556f6a47579ebc916d6af671c`。单序列 train/eval 响应 SHA-256 分别为 `39cddd2a1620018cdd9f5f3590a7f9d787ed48276a4c220a4eda971bdfc88f27`、`51861701a136ccfef089eb675cf9ee22d6216dda79854a621fe0cfc4344d9a9a`。这是上游调查缓存证据；N1 按固定 revision 复核可获取数据及哈希，失败则记录限制。编码门店不代表现实门店。

保留 `source_split=train/eval`、原始字段类型、缺货标签、来源 revision、许可、日期及提供方归一化语义。`sale_amount`/`hours_sale` 不可换算为实际件数、重量、库存、售价、金额或利润。76/14/7 日历切分是后续评测候选，不改写原 source split，不在导入器中固化预测结论。所有原始/下载数据仅放忽略目录 `data/retail-02/`，禁止提交 Git。

## 环境、包和边界

Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-02`，分支 `feat/retail-02`，基线 HEAD 如上，初始干净。WSL Ubuntu；Node v24.22.3、npm 11.19.1；gh CLI 用户 2Zest。复用 @opendot/retailops v0.1.0、合同 0.3.0、Zod 4.4.3、better-sqlite3 12.11.1、@types/better-sqlite3 7.6.13。无依赖新增；不改 package/lock/tsconfig/build/test config。SQLite 仅用临时测试 DB。

## 精确文件所有权

未列路径只读。#21 是公开历史导入唯一 owner。

| 路径 | 权限/用途 |
|---|---|
| `docs/retailops/plans/RETAIL-02-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-02-N0.md`、后续 `acceptance/RETAIL-02.md` | #21 独占文档 |
| `apps/retailops/src/domain/history/fresh-retailnet-record.ts`、`fresh-retailnet-manifest.ts` | 新增来源字段/manifest；不修改基础 domain contract |
| `apps/retailops/src/application/ports/public-history-repository.ts` | 新增专属端口；不改共享 ports |
| `apps/retailops/src/application/use-cases/import-public-history.ts` | 接受固定来源快照、验证并导入；不直接取网/推断业务单位 |
| `apps/retailops/src/adapters/persistence/sqlite/public-history-repository.ts` | 新增 SQLite 实现 |
| `apps/retailops/src/adapters/persistence/sqlite/migrations/0002_public_history.ts` | 若仍需新增表，由 #21 唯一创建 |
| `apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts` | 共享注册入口，本轮唯一修改者为 #21，仅登记 v2 并校验 schema |
| `scripts/retail-02/fetch-fixed-snapshot.py` | 新增来源获取脚本，#21 独占；Python 标准库下载固定 commit Parquet、核对 LFS OID；以仓库外临时 DuckDB CLI 解码 |
| `apps/retailops/test/unit/domain/history/fresh-retailnet-record.test.ts`、`test/unit/import-public-history.test.ts`、`test/unit/persistence/sqlite/public-history-repository.test.ts`、`test/contract/public-history-import.test.ts` | #21 独占新增测试 |
| `apps/retailops/src/domain/index.ts`、`application/ports/retail-repositories.ts`、根/包配置、宿主、已合并合同、#26 路径 | 只读 |

### 迁移共享锁

#21 独占迁移 v2 和 runner 注册。#26 不得并行创建 migration 或修改 runner；等 #21 合并、同步最新 develop、核对实际账本后，再由主控将锁串行交给 #26 并分配下一实际版本。#21 实际 N1 若不需新增表，应报告原因且不创建 migration。

## 接口边界与 N1–N5

Domain 只定义 FreshRetailNet 来源记录与字段语义；Application 端口接受已解码记录并提供幂等导入/条件查询；SQLite Adapter 落库并校验读取。来源逻辑唯一键为 `(dataset revision, source split, store_id, product_id, dt)`。#21 独占的 `scripts/retail-02/fetch-fixed-snapshot.py` 用 Python 标准库从固定 commit URL 下载 Parquet 并验证 LFS OID/size；调用主控批准的仓库外临时 DuckDB CLI 解码 JSONL。原始文件、样本和运行 manifest 在忽略目录 `data/retail-02/`。逻辑键为 `(dataset revision, source split, store_id, product_id, dt)`。测试用小型合成行，源样本比对用本轮 pinned Parquet 快照；不新增仓库/应用依赖。

| 节点 | 实施与验收 |
|---|---|
| N0 | 基线、上游、来源、owner、命令冻结；本轮已整理，等待主控核验 |
| N1 | 原始映射、manifest、字段类型/来源/split/单位保真 |
| N2 | 幂等键、缺字段/空值/越界/异常行报告、重复检查、事务回滚 |
| N3 | 按 revision/split/store/SKU/date 查询；抽样 DB 与来源逐行/哈希比较 |
| N4 | 完整包回归和 T01/T02：build、typecheck、test、docs、diff；不删旧断言 |
| N5 | 范围审计，独立 PR 到 develop/retailops，Issue/Project 回读 REVIEW |

已确认 test discovery：Vitest Node，`test/unit/**/*.test.ts`、`test/contract/**/*.test.ts`。执行命令：`npm --prefix apps/retailops run build`、`npm --prefix apps/retailops run typecheck`、`npm --prefix apps/retailops test`、`npm run docs:check`、`git diff --check`。N0 不运行源码测试。不得预测、仿真、实现 Agent 工具或接真实业务写接口；#7 BLOCKED；#22 不认领。

## 三层语义验收

- 总体计划/PRD：公开历史可追溯，归一化销量不伪造成现实单位。
- Issue/Plan：可重复导入、异常可见、历史查询，不做预测。
- 节点标准：来源/单位保留，幂等、异常报告和抽样相等均需实测；未复核不得 PASS。


## 主控批准的补充范围（2026-11-27）
主控已通过 N0，并批准 N1–N5。store_id=0、74 SKU、共同连续 97 天是本任务历史数据导入与验收范围，不能据此声称 V0 多 SKU 经营仿真。执行计划允许新增唯一数据获取脚本 `scripts/retail-02/fetch-fixed-snapshot.py`（#21 独占，Python 标准库，不新增依赖）；仅将固定 revision Parquet、JSONL 样本和本轮 run manifest 写入忽略目录 `data/retail-02/`，不提交数据。#21 固定来源入口为 HF 仓库 commit `c374e85975c82816c495acfa904cc55ab14a47d3` 下的 `data/train.parquet` 与 `data/eval.parquet`。先读取该 commit tree 中的 LFS OID/size，下载 resolve/<commit> 文件并逐项校验；不使用历史调查缓存或无固定 SHA 证明的 Viewer 响应替代。

#21 唯一拥有 SQLite migration v2 与 `migration-runner.ts`。v1 的初始化/校验只检查 v1 对应 schema，v2 schema 检查只在 ledger 证明 v2 已应用后执行。必须保留 v1 数据并覆盖 v1→v2、空库→v2、重复迁移、失败回滚和 schema 不匹配测试。
