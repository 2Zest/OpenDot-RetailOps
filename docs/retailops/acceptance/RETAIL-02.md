# RETAIL-02（Issue #21）节点验收回执

## 当前状态

- N0：主控核验通过并授权 N1–N5，详见 [N0 回执](./RETAIL-02-N0.md)。
- N1：固定来源获取、样本覆盖和原始字段结构 PASS，详见 [N1 回执](./RETAIL-02-N1.md)。
- N2：来源合同、manifest、JSONL 导入校验及事务写入测试 PASS。
- N3：SQLite v2 仓储、来源追溯查询及固定样本实际数据库比对 PASS。
- N4：WSL Node 24 包级 build/typecheck/test、docs:check、staged diff check 与 17 文件范围审计均 PASS。
- N5：实现已提交至 PR #89 并推送；PR 当前回读为 OPEN/CLEAN，等待独立 Review；Issue #21 为 OPEN/REVIEW，Project #2 为 Review。

## 基线与边界

- GitHub Issue：#21 RETAIL-02；分支：`feat/retail-02`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-02`。
- 集成基线：`develop/retailops` `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`；N0 范围提交 `44669981675f7e6afd7db27deb760e76acdb87e9`；实现交付提交 `b7d81d39dbb10f82fa26abfdfa9ba4a3ace63a83`。
- 上游：#20 PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d`；#13 PR #79 merge `6a2ddc363f82ae9f9e66e296d2644efafb48565e`。
- 包合同保持 0.3.0；未修改根/包依赖、锁文件、构建配置或测试发现配置。没有提交 Parquet、JSONL、SQLite 或其他数据文件。
- 不实施需求预测、价格弹性、仿真、Agent Tool、API、业务执行或真实商超写接口。

## N2：原始合同、manifest 与导入校验

Domain 合同保留 FreshRetailNet 固定 revision、CC BY 4.0、原 train/eval split、来源列名和值。19 个来源字段保持为其提供方类型和值；`sale_amount`、`hours_sale` 只作为归一化历史观测，不换算成件数、库存、价格、金额或利润。来源行在写入前后执行运行时合同校验，包含固定 Parquet 列序、日期、整数标识、有限数值、24 项向量和缺货小时标签与状态向量的一致检查。

导入 manifest 同时记录数据集 revision、split、许可、来源文件路径/字节数、LFS OID SHA-256、HTTP 响应体 SHA-256、本地 Parquet SHA-256、行数、门店/SKU/日期覆盖和筛选 JSONL SHA-256。应用固定 JSONL 字节合同：UTF-8、无 BOM、原始列序、按 `product_id, dt` 升序、每行一个对象、LF 分隔、最终 LF、无空行。Use Case 与 SQLite Adapter 都对传入的原始 `Uint8Array` 重算 SHA-256；Adapter 还逐行核对解码来源值与传入记录，不能只持久化调用方提供的摘要。

Use Case 对无效 manifest、空输入、UTF-8/JSONL 格式错误、摘要不匹配、非法字段、重复自然键、source revision/split/store 不匹配、计数/SKU/日期缺失及 SKU 日期不连续返回结构化拒绝，不调用仓储。SQLite Adapter 进一步运行时校验写入行、自然键、manifest 和读取的 payload。

## N3：SQLite 持久化、迁移和查询

本任务独占 migration v2 与 `migration-runner.ts`。v1 和 v2 各自校验对应 schema；v1 ledger 验证阶段不要求 v2 表存在。v2 新增 `public_history_imports`、`public_history_records`、`public_history_import_rows`，保存不可变导入 manifest、原始行 payload、自然键、内容 SHA-256 及记录到导入的外键关联。相同键/相同内容的重复导入幂等；同键不同内容报冲突；多行导入冲突回滚整笔事务。读取结果会验证 payload、规范列、内容摘要和 manifest 关联，并返回可回溯的来源 manifest。

单测覆盖空库 v1→v2、合成 v1 历史数据升级、重复迁移、v1 与 v2 schema guard、账本/表不匹配和提交前验证失败的迁移回滚；仓储测试覆盖重复导入、内容冲突原子回滚、损坏 payload 拒绝、来源关联缺失拒绝和日期过滤。合成旧库 fixture 明确标注为测试构造数据，不代表真实旧用户数据库。

本轮使用固定 revision `c374e85975c82816c495acfa904cc55ab14a47d3` 的 train/eval Parquet，而不是 #13 历史调查缓存。完整运行数据只在被忽略的 `data/retail-02/` 中。

| 实际样本 | 导入行数 | 查询行数 | 与 JSONL 源行逐条比较 |
|---|---:|---:|---|
| train / store_id=0 | 6,660 | 6,660 | 全部 `deepEqual` |
| eval / store_id=0 | 518 | 518 | 全部 `deepEqual` |
| 合计 | 7,178 | 7,178 | 全部相符 |

样本回读运行于 WSL Node v24.22.3、临时 SQLite DB；实际 SQLite `3.53.2`，迁移账本 `[1, 2]`。基于 `dist` 运行的 smoke summary SHA-256：`6099c593e821c1469dc6a67d1e2fc5a81c1029948e56d6b6f417f87e42b76b04`。对应临时 DB 和 smoke 脚本保留在 ignored 数据目录，不提交。

## N4：命令与结果

实际 Node 环境：WSL Ubuntu；Node `v24.22.3`、npm `11.19.1`。`npm ci` 退出码 0，使用现有 lockfile，未改 package/lock；`better-sqlite3` 已实际在 Node 24 加载并连接内存/临时 SQLite DB。

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm run build`（`apps/retailops`） | 0 | TypeScript 构建通过，dist migration smoke 可加载并迁移至 v2 |
| `npm run typecheck`（`apps/retailops`） | 0 | 源码与测试类型检查通过 |
| `npm test`（`apps/retailops`） | 0 | 13 个测试文件、107/107 测试通过；保留原有 87 项，新增 20 项 |
| `npm run docs:check`（仓库根目录） | 0 | WSL Node 24 环境下 273 份仓库 Markdown 通过。为兼容 Windows worktree `.git` 指针，仅向该次命令设置 `GIT_DIR`/`GIT_WORK_TREE` 环境变量，未修改 Git 元数据 |
| `git diff --cached --check` | 0 | 主控独立复核已暂存 17 个路径，退出码 0 |

过程中的失败均已保留并修复：首次 build 发现仓储行类型不满足 `assertStoredFields`，改为传入具备记录索引签名的副本；首次 typecheck 发现测试 fixture 的 `sale_amount` 拼写错误并修正。两次测试中迁移版次断言及 v1 fixture ledger 重建错误已修正；后续一次测试暴露仓储输入排序校验引用未初始化局部变量，已改为校验前一输入；另一次测试发现查询样例未限定 `productId`，已修正查询条件。最新一轮完整 build/typecheck/test 全绿。

依赖安装输出报告 3 个 audit advisory（2 moderate、1 high）。本任务未运行 `npm audit fix`，未修改依赖版本，也未扩大处理范围。

## 三层语义一致性

| 对齐层 | 实际事实与证据 | 判定 |
|---|---|---|
| 总体计划 / PRD / 场景 | 保留历史公开来源和 train/eval 切分；归一化销量不冒充实物单位或经营金额 | PASS |
| Issue #21 / 执行 Plan | 固定 revision 真正重取；导入、幂等、异常报告、SQLite 查询及来源追溯在批准路径内实现 | PASS |
| 节点标准 / T01、T02 | 7,178 行来源逐条回读一致；自然键、hash、模式、迁移、回滚和完整包测试均有实际证据 | PASS |

## 文件范围

本轮当前差异（精确 17 个文件）均位于 #21 已批准文件范围：

| 路径 | 操作与用途 |
|---|---|
| `docs/retailops/plans/RETAIL-02-EXECUTION-PLAN.md` | 更新节点状态及 JSONL 字节/摘要验收约束 |
| `docs/retailops/acceptance/RETAIL-02-N1.md` | 新增固定来源、哈希、样本覆盖与语义回执 |
| `docs/retailops/acceptance/RETAIL-02.md` | 新增 N0–N5 总回执 |
| `scripts/retail-02/fetch-fixed-snapshot.py` | 新增固定 revision 下载、LFS/HTTP/local SHA 检查、Parquet 解码与样本校验 |
| `apps/retailops/src/domain/history/fresh-retailnet-record.ts` | 新增原始字段记录合同及自然键 |
| `apps/retailops/src/domain/history/fresh-retailnet-manifest.ts` | 新增固定来源 manifest、规范摘要和导入 ID |
| `apps/retailops/src/application/ports/public-history-repository.ts` | 新增来源查询/导入端口及 provenance 返回类型 |
| `apps/retailops/src/application/use-cases/import-public-history.ts` | 新增逐行异常报告、JSONL 字节 SHA 验证、覆盖检查与导入 use case |
| `apps/retailops/src/adapters/persistence/sqlite/migrations/0002_public_history.ts` | 新增 SQLite v2 表、自然键、外键和索引 |
| `apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts` | 修改为按 v1/v2 ledger 版本分别验证 schema |
| `apps/retailops/src/adapters/persistence/sqlite/public-history-repository.ts` | 新增事务导入、幂等冲突处理、来源追溯查询及读取校验 |
| `apps/retailops/test/contract/public-history-import.test.ts` | 新增导入 use case + SQLite 合同测试 |
| `apps/retailops/test/unit/domain/history/fresh-retailnet-record.test.ts` | 新增源 schema/manifest 负向测试 |
| `apps/retailops/test/unit/import-public-history.test.ts` | 新增 hash/JSONL/覆盖/异常行测试 |
| `apps/retailops/test/unit/persistence/sqlite/public-history-repository.test.ts` | 新增来源回读、幂等、冲突回滚和数据损坏测试 |
| `apps/retailops/test/unit/persistence/sqlite/migration-runner.test.ts` | 补 v2 upgrade、schema guard、外键、重复迁移和回滚测试 |
| `apps/retailops/test/unit/persistence/sqlite/database.test.ts` | 将既有空库迁移期望更新为 v1/v2 账本 |

运行 Parquet、JSONL、临时 SQLite 与测试结果 JSON 均处于 ignored `data/retail-02/`，不进入暂存或提交。根/包依赖、lockfile、基础 domain index、宿主迁移入口及 #26 文件未修改。

## 未验证事项与风险

- 实现已通过 PR #89 提交，正在等待独立 Review；本任务不标记 DONE。
- 没有使用真实业务数据：FreshRetailNet 编码门店不代表现实门店；归一化观测不包含可还原实物单位、库存、价格或金额的系数。
- npm 安装器报告的 audit advisory 未在本任务处理。
- 测试数据库是临时隔离库；未修改 Home DB、宿主迁移入口或真实用户数据。

**节点结论：** N0–N5 的计划、实现和交付检查均通过；N5 PASS 仅表示已提交 PR 并完成状态同步，仍须等待独立 Review 与后续合并。Issue 当前保持 OPEN/REVIEW，不标记 DONE，不解锁下游任务。

## N5 最终交付与状态回读（2026-11-27）

- 实现交付提交：`b7d81d39dbb10f82fa26abfdfa9ba4a3ace63a83`，分支 `feat/retail-02`，已推送至 `origin/feat/retail-02`。
- 独立 PR：[PR #89：公开历史数据导入](https://github.com/2Zest/OpenDot-RetailOps/pull/89)，目标分支 `develop/retailops`。交付提交回读时 PR 为 OPEN，`mergeStateStatus=CLEAN`；该 PR 仍等待独立 Review，未合并。
- Issue #21 回读为 OPEN，标签 REVIEW，assignee `2Zest`；Issue 正文状态已同步。
- GitHub Project #2 条目 `PVTI_lAHODjlUWM4BtKkTzhLw7Og` 回读为 Review。
- PR 文件范围为上表列出的 17 个获准路径；无 Parquet、JSONL、临时 SQLite 或其他数据文件。实现交付时 Worktree clean。
- 本次仅更新本回执中的 N5 交付记录，不改源码、测试、计划或数据。推送本回执后 PR HEAD 会随文档提交更新，具体最新 HEAD 以 GitHub 回读为准。
- N5 验收结论：PASS（交付阶段）；独立 Review 尚待完成。当前不关闭 Issue、不标记 DONE、不解锁下游任务。

## 最终针对性 Review 修订（2026-11-27）

本节追加记录，不覆盖上述历史验收快照。修改范围仅限正式来源认证、v2 migration ledger guard、固定样本可复现导入命令及对应回归测试。

### 来源真实性边界

正式 `importPublicHistory` 必须匹配本轮验收过的 JSONL SHA-256、split 行数、store_id=0、74 个 SKU、固定 SKU 集及日期窗口。train SHA 为 `4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005`；eval SHA 为 `0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2`；74 个有序 SKU ID 集 SHA 为 `1797d24e2e407ce6ab82531549a5508e6ea257c5cd0b9853af2d2e606796834b`。调用方同步变更 JSONL 与 manifest 摘要的负向回归仅能得到 `UNAPPROVED_PUBLIC_SNAPSHOT`，仓储调用次数为 0。

结构解析器仅验证 JSONL 与通用 manifest 合同。合成 fixture 单测通过测试文件内 `importSyntheticFixtureOnly` 调用解析器及 fake/SQLite test repository；该函数不在生产代码中，且不调用正式来源认证入口。实际公开样本通过新增固定来源导入脚本覆盖。

### v2 migration ledger

先添加“ledger 只有 v1、但预先存在 v2 public-history 表”的失败回归；修复前迁移实际错误地完成并登记 v2，红测复现成功。修复后 runner 按每个 schema 版本独立判断：未登记版本若已有该版本任何受管表即拒绝，已登记版本仍以其实际表结构、唯一键、外键和数据完整性为准。空库、v1→v2、重复迁移、合成历史迁移和失败回滚保持原路径。

### 可复现固定数据 smoke

新增 `scripts/retail-02/import-fixed-snapshot.mjs`。执行方式：先构建包，再指定本轮固定 extraction 目录运行；脚本读取 extraction/download manifests 和 train/eval JSONL，调用已构建的正式导入入口，生成全新的系统临时 SQLite，并对每条 Repository 查询结果与原始 JSONL 逐条比较。预期结果为 train 6,660、eval 518、合计 7,178 行，同一 74 SKU，日期覆盖 2024-03-28 至 2024-07-02。不会改写已有临时数据库，也不会将数据或 DB 纳入 Git。

### 本轮实际验证

| 检查 | 实际结果 |
|---|---|
| 红测：新增 v2 ledger 异常测试（修复前） | 失败，预期的异常未抛出，缺陷复现 |
| 定向迁移/导入测试（首轮修复后） | 3 个测试文件中 25/26 通过；新增断言的错误消息正则过窄，未匹配正确拒绝信息，随后修正断言文本 |
| 定向迁移/导入测试（修正后） | 退出 0；3 个文件、26/26 通过 |
| `npm --prefix apps/retailops run build`（WSL Node 24.22.3） | 退出 0 |
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3） | 退出 0 |
| `npm --prefix apps/retailops test`（WSL Node 24.22.3） | 退出 0；13 个测试文件、109/109 通过，包含原有 107 项及新增两个回归 |
| `node scripts/retail-02/import-fixed-snapshot.mjs --snapshot-dir data/retail-02/freshretailnet-c374e85975c82816c495acfa904cc55ab14a47d3-2026-11-27-01` | 退出 0；使用 dist、临时 DB；train 6,660/6,660、eval 518/518、总计 7,178/7,178 逐行相同，均为 store 0、74 SKU，日期 2024-03-28 至 2024-07-02 |
| `npm run docs:check`（WSL Node 24，真实 Worktree Git 环境） | 退出 0；273 份仓库 Markdown 通过 |
| `git diff --check` / `git diff --cached --check` | 均退出 0；最终 8 个文件范围已暂存审计 |

首次 dist smoke 曾按查询顺序与 JSONL 顺序逐索引比较失败；SQLite Repository 明确按 date/productId 排序。脚本改为按自然键进行全量比对后复跑退出 0，7,178 行逐条匹配。该失败未改变数据或数据库，也未作为通过证据。

### 三层一致性

| 对齐层 | 结论 |
|---|---|
| 总体计划 / PRD：来源可追溯，真实公开快照不得伪造 | PASS：正式导入由固定原始字节摘要和覆盖元数据绑定；模拟和归一化单位语义保持不变 |
| Issue #21 / Plan：固定 revision，可重复导入并查询 | PASS：迁移异常账本拒绝新增；固定来源脚本允许独立重建并检验查询 |
| N2/N3 节点标准：异常输入拒绝、真实样本逐条一致 | PASS：正式认证负测、migration 异常红绿、dist 中固定 train/eval 7,178 行逐条比对全绿 |

本轮追加文件：`apps/retailops/src/application/use-cases/import-public-history.ts`、`apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts`、对应两个测试文件和合成 SQLite 合同测试、`scripts/retail-02/import-fixed-snapshot.mjs`、本执行计划及本回执。无 migration 新版、依赖变更、原始数据、SQLite DB 或 #26 文件修改。
