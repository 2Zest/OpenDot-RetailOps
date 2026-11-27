# RETAIL-03（GitHub Issue #22）执行计划

**状态：** N0 主控核验通过；N1–N6 已获授权并行推进
**集成基线：** `origin/develop/retailops` `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`
**本分支同步提交：** `0344532e58fa545029818e25db3ce6ab0a6bdbe7`（将最新集成分支合入既有任务分支）
**原计划：** `docs/retailops/initial-plan-v0.2/plans/RETAIL-03-PLAN.md`（只读；本文件仅细化执行）
**Issue：** `RETAIL-03` / GitHub Issue #22
**分支 / Worktree：** `feat/retail-03` / `D:/workSpace/codeAgent/OpenDot-RetailOps-03`

## 1. 输入基线和依赖

| 输入 | 固定版本 / 证据 |
|---|---|
| 总体计划 | blob `f4baf060fc335a2844b8bf783c2f044cb3b89170` |
| PRD V0.2 | blob `8e6ad021ad6344461407cecea21da8d8b28fa28e` |
| Architecture V0.2 | blob `59e5ba533f3bbae60a62a0f357737fab4562fda7` |
| ADR V0.2 | blob `a3cbac396a0b378a8fa1d456a2452dd38bdfb5ba` |
| DECISIONS-PENDING | blob `68c134897483b1ed04ad1263b0c5f7fbc351b1de` |
| DAG | blob `b998e8a186a8ae0e6c28468a76377ee3cb66daa2` |
| 原始 RETAIL-03 Plan | blob `4f6110e1bc23265691716ed21d3dd8d5726d4298` |
| RETAIL-00E-01 领域研究 | blob `66a70c02784915df2378e1911256abc3a12a4042` |
| 零售领域合同 | PR #86 merge `8ca176ff3f9e5990b6c2487e41be2953e682c192`，contract `0.3.0` |
| RETAIL-01P 持久化能力 | PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d` |
| RETAIL-00E-01 上游 | PR #75 merge `3469160b93b966e38757e48bbb3c0239362c16d3` |
| RETAIL-02 公开数据导入 | PR #89 已合并至集成分支，integration HEAD `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；#22 不依赖其数据表或迁移 |

GitHub Issue #20（RETAIL-01P）及 Issue #12（RETAIL-00E-01）实际均 CLOSED/DONE，合并 SHA 如上；Project #2 对应状态为 Done。Issue #22 两项硬依赖均满足。本轮只认领 #22，不启动 #23 或其他下游。

## 2. V0 仿真语义与参数边界

- 只覆盖一间抽象门店、一个 Product、一个临期 Batch；不选择真实门店或 SKU，不把公开编码门店映射成现实门店。
- 初始化库存、到货、需求、价格动作和时钟都是显式输入，并标记为 `SIMULATED`。禁止将 FreshRetailNet 的归一化销量解释为库存、件数、成本或价格。
- 同一输入（含 seed、显式时钟、场景版本、事件序列和策略版本）必须产生相同事件账本与结果。seed 必填且无生产默认值；场景时钟由调用方注入，不读系统当前时间。用于随机需求生成的分布/参数须显式输入并绑定来源及版本；测试 fixture 的数值只作合成测试数据。
- Event 顺序固定为显式发生时间与输入序号；事件 ID 在单次运行内唯一，重复 ID 拒绝，不能重复计量。所有时间、数量、单位及关联 Batch 都通过已批准合同校验。
- Arrival 只能引用本场景唯一 Batch 且复用其商品、质量与效期语义；需要第二批次或多 SKU 时停止并提交范围变更，不在本 Issue 中扩张。
- 销售仅从可售量扣减；质量不合格、未知或效期边界/已过期状态按现有领域合同 fail-closed。过期导致不可售的分类变化本身不减少物理库存；只有明确的 SIMULATED 报损/移除事件才减少物理库存。
- 每一数量都满足守恒：期初实物量 + 到货量 = 累计销售量 + 累计报损移除量 + 期末实物量。期末未售库存与累计报损分开报告；可售、不可售子项仍须满足现有 Batch / StockBalance 合同，不引入线上预占流程。
- 折价/价格动作只消费显式的、由 RETAIL-05P（GitHub Issue #24）合同计算出的候选与匹配 Policy revision，在模拟生效时点更新模拟价格。此为模拟输入，不代表业务批准或实际调价执行；不得计算或声称真实价格因果效果。
- D01、D02、D03、D06、D07、D09 的责任、来源与冻结边界见第 3 节。D04 价格边界继续由已批准 Policy / RETAIL-05P 契约负责。本 Plan 不填任何未批准的业务数值。
- Event ledger 作为单次模拟结果返回，不新增 durable event store；若实施前证据表明必须持久化，则停止并提出迁移需求，由主控另行分配唯一 migration owner。不得创建 SQLite migration 或修改 migration-runner.ts。

## 3. 待决参数及来源映射（本轮只记录，不冻结数值）

| 决策 | 候选内容与证据来源 | 本 Plan 处理 |
|---|---|---|
| D01 | V0 单店/单 SKU 原则来自 PRD；实际门店、商品及代表性未由 RETAIL-00E-01 研究固定 | 使用调用方提供的抽象/合成标识；不固定真实门店或 SKU |
| D02 | 数量单位、包装换算、精度、舍入及时区来自 DECISIONS-PENDING；RETAIL-01 合同提供 Quantity、Money、Date/Instant schema | 复用现有精确合同；场景必须给出单位和时间基准；不换算、不添加舍入默认 |
| D03 | Batch、质量和效期语义来自 RETAIL-01 的 Batch/Expiry/StockBalance 与 PRD 安全规则 | 复用 `batchSchema`、`expirySchema`、`assessSellability`；不设临期窗口、质量阈值或时间区默认 |
| D04 | 折价步长、价格底线与策略来自 Policy 和 RETAIL-05P 计算合同 | 仿真只接收显式且合同有效的候选/Policy revision；不重算或扩大折扣边界 |
| D06 | 需求响应/弹性尚未实证；00E-01 明确参考项目的数据与策略不能直接作为 RetailOps 真实因果结论 | 需求来自显式 SIMULATED 场景输入；没有显式响应模型时不推断价格导致的需求变化 |
| D07 | 初始库存、到货及盘点差异由 PRD 和 DECISIONS-PENDING 列为来源决策；FreshRetailNet 不提供本目标 Batch 库存 | 输入库存和 arrival 必须标 SIMULATED；禁止从公开归一化销量推导初始物理库存 |
| D09 | seed、仿真时钟、场景组合及 horizon 延期至 RETAIL-03 N0 | seed、clock、场景版本和 horizon 都为必填参数；本轮不写生产默认值。需求数量显式输入，不引入未经批准的随机分布/生成器；seed 记录于仿真输入和输出以便场景复现 |

## 4. 精确文件范围与所有权

下表列出未来 N1–N5 计划修改路径；当前 N0 只允许新增本 Plan 与 N0 回执。未列路径默认只读。

| 路径 | 计划操作 | Owner | 边界 / 验证 |
|---|---|---|---|
| `docs/retailops/plans/RETAIL-03-EXECUTION-PLAN.md` | N0 新增；后续只更新本 Issue 计划 | #22 | 保留原 Plan，不改总体计划/DAG |
| `docs/retailops/acceptance/RETAIL-03-N0.md` | N0 新增 | #22 | 本节点真实状态和三层回执 |
| `docs/retailops/acceptance/RETAIL-03-N1.md`–`N6.md` | 后续按节点新增 | #22 | 每节点一个 receipt；记录命令、SHA、源码证据；N6 独立交付回执 |
| `apps/retailops/src/domain/simulation/simulator.ts` | 后续新增 | #22 | 单 SKU/BATCH 仿真输入、纯确定性转移、事件账本与守恒；无 DB/Runtime 依赖 |
| `apps/retailops/src/application/use-cases/run-single-sku-simulation.ts` | 只读；本轮不新增 | #22 不修改 | 纯领域仿真已足以协调现有 Product/Batch/Policy/RETAIL-05P 合同；不加包装层或 Agent/tool 接口 |
| `apps/retailops/test/fixtures/simulation/single-sku-scenario.ts` | 后续新增 | #22 | 仅合成测试 fixture，不得作为生产默认值 |
| `apps/retailops/test/unit/domain/simulation/simulator.test.ts` | 后续新增 | #22 | 守恒、质量/效期拒绝、seed/clock 确定性、重复事件 |
| `apps/retailops/test/unit/application/run-single-sku-simulation.test.ts` | 不新增 | #22 不修改 | 无应用服务实现；生效时间由领域仿真定向单测覆盖 |
| `docs/retailops/acceptance/RETAIL-03-N6.md` | N6 新增 | #22 | 独立交付回执；记录 PR/Issue/Project 回读和实际 HEAD，不表示合并或 DONE |
| `apps/retailops/src/domain/index.ts` | 只读 | #22 不拥有 | 不导出给 Agent/公共 API；保持内部模块边界 |
| `apps/retailops/src/application/ports/retail-repositories.ts`、`adapters/persistence/sqlite/**`、任何 migration / `migration-runner.ts` | 只读 | 当前 migration lock owner 为 #21；后续需主控移交 | 本 Plan 不修改、不创建迁移，不依赖 #21 尚未合并的 v2 |
| `apps/retailops/package.json`、lockfile、tsconfig、Vitest 配置、根配置 | 只读 | 共享配置 | 不加依赖、不改发现范围 |
| Agent、MCP、Harness、composition、宿主私有源码、真实写接口 | 只读 / 明确不做 | 无授权 | 不注册工具、不连接运行时、不触发业务副作用 |

## 5. 节点计划

| 节点 | 对应原 Plan 目标 | 执行动作与路径 | 验收条件 |
|---|---|---|---|
| N0 | 预检与范围冻结 | 核验基线、上游、Issue/Project、环境和文件 owner；仅修改本计划与 N0 回执 | 上游 merge SHA 和当前状态有远端证据；未来路径精确冻结；无源码改动 |
| N1 | 初始批次及需求情景 | 实现 `domain/simulation/simulator.ts` 输入合同和合成 fixture | 库存/价格/成本/需求/到货/动作来源均标 SIMULATED；seed、clock、scenario version、horizon、需求及到货显式；无未批准的随机需求默认 |
| N2 | 推进与库存守恒 | 在纯函数内按时间和显式序号推进单 Batch 事件账本 | 同输入账本完全一致；期初 + 到货 = 销售 + 显式报损 + 期末；停售只改分类；非法事件不得造成负库存 |
| N3 | 内部价格命令接口 | 仅接受 RETAIL-05P schema 通过且 CALCULATED/hardRulesPassed 的指定候选 | Policy ID/revision、Product/Batch、Scenario 与候选证据绑定；有效时间受 horizon/候选 asOf 限制；仅模拟，不授权审批/执行；无 Agent/tool/public export |
| N4 | 输出指标 | 汇总需求、销售、未满足需求、到货、未售、报损、期末库存及模拟金额 | 由事件账本手算复核；BigInt 与显式 scale，无浮点/隐式舍入；不冻结最终损耗 KPI，不宣称价格因果 |
| N5 | 定向测试与回归 | T01 全覆盖；执行 package build/typecheck/test、docs:check、diff check | 不删除原测试；集成基线 109 项与新增测试全通过；失败完整记录 |
| N6 | 交付与 Review | 精确范围审计；提交中文回执和独立 PR 指向 develop/retailops；Issue/Project 回读 REVIEW | PR 开放且 HEAD 核实；不自动合并、不标 DONE、不启动下游 |

## 6. 检查命令和测试发现

- 包：`apps/retailops` 独立包；Node `>=24 <25`；依赖和 lockfile 不改。
- Test discovery：Vitest，`test/unit/**/*.test.ts` 与 `test/contract/**/*.test.ts`。
- N0 不运行源码测试，不存在源码变更。
- 后续定向：`npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts`。
- N5 完整回归：`npm --prefix apps/retailops run build`、`npm --prefix apps/retailops run typecheck`、`npm --prefix apps/retailops test`、`npm run docs:check`、`git diff --check`。
- N0 实际环境：WSL2 Linux x86_64；Node v24.22.3；npm 11.19.1；可用内存约 14 GiB。无高负载任务启动。

## 7. 安全与停机条件

- `#7` 保持 BLOCKED；本 Issue 不启动 Runtime、模型、MCP、Harness、真实业务写入或隔离实例。
- `#21` PR #89 已合并到 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；#22 不依赖其导入数据表，也不编辑 migration 文件。
- `#26` 独占当前 DraftRevision migration/runner 路径；#22 完全不写共享 schema、migration 或 runner，不与其争抢文件锁。
- #22 的直接下游 RETAIL-04（GitHub Issue #25）、RETAIL-10（GitHub Issue #30）、RETAIL-12（GitHub Issue #32）均不在本轮启动。
- 如实现需要第二 Batch、SKU 扩展、未批准的业务参数、公开数据单位变换、migration 或 Agent 工具，停止受影响节点，提交具体变更/锁移交请求；不自行更改计划。

## R1 审查补充：结果 Schema 异常安全

- 范围限定为 `computedResultSchema` 与仿真器单元测试，不修改仿真业务规则、迁移、依赖或历史断言。
- 所有数量/金额格式、长度、小数位和金额整数文本必须在 `decimalToScaledInteger`/`BigInt` 前校验；三项 scale 必须是安全整数且处于 schema 允许范围；结果日期/时刻在比较前再次验证。
- 对非法指数数量、非法/超长金额、非法 scale 和无效日历时刻逐项验证 `safeParse` 不抛异常且拒绝输入。
- R1 验收命令：原定 build、typecheck、完整包测试、docs:check、diff check；定向命令仍为 simulator 单测。命令结果与 SHA 追加至 N6 回执。
