# RETAIL-05P（GitHub Issue #24）N4 定向及包级回归回执

Issue / Plan 版本 / 节点 ID：GitHub Issue #24、RETAIL-05P-PLAN、细化 Execution Plan、N4
总体计划/PRD/ADR 版本及 SHA：已批准 RetailOps V0.2；候选公式版本 retailops.markdown-calculation/0.1.0-proposal；领域合同 v0.3.0
实际 Git HEAD / worktree / 执行角色：当前修改基于 feat/retail-05p 执行；Worktree D:/workSpace/codeAgent/OpenDot-RetailOps-05p
依赖 Issue 状态、合并 SHA、证据：#19 / PR #86 merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192；#14 / PR #83 merge SHA d3b402945ace1da4cd9e032690a394526079d09b；详情见 N0/N2 回执
允许修改路径与实际 diff：N0 冻结的 #24 纯领域计算模块、领域决策专属单测/合同测试和 #24 专属执行 Plan/验收回执；未改 #20 的 SQLite 文件、共享依赖或领域合同。
预期输出/标准：定向测试、类型检查、构建及完整 RetailOps 包回归通过，保留原有合同/领域测试和全部 N2 断言。
实际输入/输出/行为/命令与退出码：WSL Ubuntu 24.04 / Node v24.22.3 / npm 11.19.1，执行于 apps/retailops。
证据路径、数据来源、运行模式（静态/fixture/测试/真实模型/真实 runtime）：全为合成测试 fixture、领域合同测试和 TypeScript 编译；没有真实数据、模型、Runtime、数据库或副作用。

| 实际命令 | 退出码 | 实际结果 |
|---|---:|---|
| npm test -- test/unit/decision/markdown-calculation.test.ts test/contract/decision/markdown-calculation.test.ts | 0 | 2 个定向文件，19/19 通过。 |
| npm run typecheck | 0 | tsc -p tsconfig.test.json --noEmit 通过；覆盖源代码和测试代码。 |
| npm run build | 0 | tsc -p tsconfig.json 通过。 |
| npm test | 0 | 5 个测试文件、45/45 通过；原 12 项 #24 N2 测试、原领域/状态合同测试均保留。 |

N3 新增合同回归包含：输入/结果技术维度保护（4096 位字符串仍小于总文本限制）、非法 minorUnits/scale 不抛异常、结果金额 number/null/超长字符串 safeParse 不抛异常、结果状态/原因/售价一致性、候选来源回显与映射、历史来源时间窗、未来 simulationWindow、asOf/快照绑定、显式 demandAssessment、UNCERTAIN 拒绝且 metrics=null、数量守恒与卖出不超过需求、Revenue/直接成本/Contribution/报损暴露精确恒等式、负贡献与 0 毛利阈值 fixture。

测试过程保留：最初 N3 红测退出码 1（17 项中 12 fail / 5 pass）；早期实现的一次定向运行因实现变量拼写错误退出 1，修正后定向通过；早期 typecheck 的测试空值收窄错误已修正。当前唯一有效复测为本回执表内四项命令，全部退出码 0。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 PASS/DEVIATION/BLOCKED |
|---|---|---|---|
| PRD / 总体计划 | 模拟与历史来源可区分，结论有来源，不宣称真实经营因果 | sourceKind、dataMeaning、scenario/asOf/快照、公式版本随结构化结果回显；KPI 未定稿、现实价格因果未建立 | PASS |
| Issue / Plan | 可解释折扣/损耗测算，硬约束 fail-closed，不实现真实执行 | 金额/数量精确结果及候选拒绝原因有全包测试；approval=REQUIRED、executionAuthority=NONE；无副作用实现 | PASS |
| N4 节点验收 | build、typecheck、全套测试和既有领域合同保持通过 | build 0、typecheck 0、完整测试 45/45，定向 N3 19/19 | PASS |

偏差 ID / 影响 / 根因 / 修订措施：本节点无未解决偏差；实现过程中的变量错误及类型检查错误已修复并复测，失败记录见 N3 回执。
复测结果与回归范围：仅对 #24 专属测试及 RetailOps 全包执行；不运行数据库、真实数据、LLM、Harness、MCP 或 Runtime。
尚未验证项与风险：docs:check、git diff --check、最终精确文件范围和远端 PR 状态属于 N5，尚未执行。候选需求充分性由调用方显式声明 ADEQUATE；UNCERTAIN 拒绝，不设置统计阈值。
决定：N4 PASS，继续 N5 文档/差异验收及独立 PR 交付。
审核者及时间：执行 Agent，2026-11-27；主控/独立审查待 PR。

## PR #88 最终针对性修订复测

先行红测（WSL Ubuntu / Node v24.22.3 / npm 11.19.1）：新增回归第一次执行时，定向两文件共 24 项，19 通过、5 失败，失败分别复现 quantity scale 未覆盖 demand 引发未捕获 RangeError、合法 292 位计算输出超出旧 260 位 schema 上限、重复 inputOrdinal 被接受、伪造 CALCULATED 输出绕过 loss/expiry/margin 约束、DATE_ONLY 时区跨日 snapshot 被错误接受。实施修复后曾有一次最大精度 fixture 断言状态失败；核对后发现 fixture 的正数 loss 大于售后余量，修正为零数量但保留 18 位精度的 fixture 输入，此失败不是实现偏差。

| 实际命令 | 退出码 | 结果 |
|---|---:|---|
| `npm test -- test/unit/decision/markdown-calculation.test.ts test/contract/decision/markdown-calculation.test.ts` | 0 | 2 个定向测试文件，24/24 通过，覆盖数量统一 scale、292 位最大合法金额乘数量、146 位 fractional ending、timezone offset、唯一 inputOrdinal、伪造 quality/expiry/loss/price-floor/margin 成功输出拒绝、非法精度 safeParse 不抛异常。 |
| `npm run build` | 0 | `tsc -p tsconfig.json` 通过。 |
| `npm run typecheck` | 0 | `tsc -p tsconfig.test.json --noEmit` 通过。 |
| `npm test` | 0 | 5 个测试文件，50/50 通过；原有测试与断言保留。 |

环境：WSL Ubuntu 24.04，Node v24.22.3，npm 11.19.1。没有真实数据、模型、Runtime、数据库或业务副作用。

| 对齐层 | 本轮事实 | 判定 |
|---|---|---|
| PRD / 总体计划 | 模拟结果仍来源可追溯、无损耗 KPI 或真实因果主张；审批仍 REQUIRED、执行权限 NONE。 | PASS |
| Issue / Execution Plan | 仅修订 #24 自有计算模块及测试，未改基础领域合同、共享依赖、#20 文件或 DAG。 | PASS |
| 节点验收 | 红测真实捕获五类缺陷；修复后定向 24/24、build、typecheck、全包 50/50 均通过。 | PASS |

未解决事项：无代码或测试阻塞；等待主控复核及 PR #88 独立 Review。N5 文档检查、差异检查和 GitHub 状态回读记于 N5 追加记录。

## PR #88 精度边界最终修订与合并基线集成

PR #87 已于 2026-11-27 实际合并至 `develop/retailops`，merge SHA 为 `048f3a7ef64a54986bfda1e839396b961969e46d`。本分支从最新远程 `develop/retailops`（该 merge SHA）同步；集成 merge commit 为 `a42228aa1260cf2c1e10db25c098b81c27c7dc78`，无冲突。#20 持久化测试与 #24 计算测试在同一包内完成集成回归。

本轮先增加两个精度负向测试：非 null `endingQty` 的 scale 高于声明 scale；`simulatedSoldQty` 的小数位高于声明 `quantityScale`。修复前契约测试 14 项中 12 通过、2 失败，均复现 `RangeError: Scale must be a non-negative safe integer that covers the decimal fraction`。修复后两种输入均由 Schema 返回结构化失败，不再有未捕获异常。

修复限定为计算模块与该契约测试：`checkQuantityConservation` 将非 null `endingQty` 纳入共同数量 scale；`checkMetricArithmetic` 在任何数量 BigInt 转换前验证 `quantityScale` 有界且所有输出数量精度不超过该 scale。没有更改公式、业务默认值、执行授权、基础领域合同或下游能力。

| 实际命令（WSL Ubuntu，Node v24.22.3 / npm 11.19.1） | 退出码 | 结果 |
|---|---:|---|
| `npm test -- test/contract/decision/markdown-calculation.test.ts`（新增测试修复前） | 1 | 14 项中 12 通过、2 失败；分别复现 ending/sold 小数精度导致未捕获 RangeError。 |
| 同上（修复后） | 0 | 14/14 通过，两个异常结果均被结构化拒绝。 |
| `npm ci`（锁文件未修改） | 0 | 安装独立包依赖；better-sqlite3 12.11.1 原生模块可加载，SQLite 3.53.2。 |
| `npm run build` | 0 | 集成后的 RetailOps 包编译通过。首次运行因合并后尚未安装 #20 新增依赖而报 TS2307；按 lockfile 安装后复跑通过。 |
| `npm run typecheck` | 0 | 源代码和测试类型检查通过。 |
| `npm test` | 0 | 9 个测试文件、87/87 通过；包含 #20 SQLite 持久化与 #24 计算合同测试。 |

三层一致性：PRD 语义与业务边界未变（PASS）；Issue #24/Plan 仍限于确定性计算与结果精度校验（PASS）；两个新异常精度用例先红后绿，集成全量回归通过（PASS）。无真实数据、Runtime、模型或业务副作用。
