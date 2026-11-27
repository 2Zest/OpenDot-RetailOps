# RETAIL-05P（GitHub Issue #24）执行 Plan

状态：原 N0–N5 已验收；PR #88 最终针对性修订已完成本地定向与全量检查，正在更新原 PR 交付记录。PR #88（base develop/retailops）保持 OPEN；Issue #24 目标保持 OPEN/REVIEW，Project #2 为 Review。未合并、不标 DONE、不解锁下游。此细化 Plan 保留原 RETAIL-05P-PLAN 的节点语义，不修改总体计划或 DAG。

## 基线、授权与上游

- 集成基线：develop/retailops 8ca176ff3f9e5990b6c2487e41be2953e682c192。
- Worktree：D:/workSpace/codeAgent/OpenDot-RetailOps-05p；分支：feat/retail-05p，由核验基线创建，N0 时工作树干净。
- 用户已认领 GitHub Issue #24。当前 Open / IN_PROGRESS、执行人为 2Zest；Project #2 In Progress。
- 上游：
  - RETAIL-01 / GitHub Issue #19：PR #86 merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192，领域合同 v0.3.0。
  - RETAIL-00C / GitHub Issue #14：PR #83 merge SHA d3b402945ace1da4cd9e032690a394526079d09b；Issue #14 Closed / DONE，Project #2 Done。
- 环境：WSL Ubuntu 24.04，Node v24.22.3、npm 11.19.1；20 CPU、可用内存约 14 GiB，/mnt/d 剩余约 610 GB。没有运行模型、数据库或业务副作用。
- 输入：已批准 PRD/Architecture/ADR、待决参数清单、RETAIL-05P 原始 Plan、领域合同 v0.3.0、Issue #24 完整契约及 #19/#14 验收证据。

## 目标与算法边界

实现可重现的确定性折扣候选测算，为未来经营分析 Agent 提供纯计算能力。输出候选、收入、贡献利润、损耗测算及可解释依据；显式应用质量/效期/库存可售性、政策折扣/毛利边界；拒绝时给出具体原因。金额不得使用浮点，结果带参数来源、公式版本、假设和精度处理说明。同输入必须同输出。仿真不得表述为真实价格因果证据。

不依赖数据库、LLM、Harness 或 Runtime；不实现价格执行、完整 Agent、预测服务或 API。已有领域合同和 Policy schema 只读，不加入未批准默认值，不扩展 DAG。

## 精确文件所有权与冲突锁

| 路径 | 权限 / 唯一 owner | 用途与限制 |
|---|---|---|
| docs/retailops/plans/RETAIL-05P-EXECUTION-PLAN.md | #24 修改 | 本细化 Plan；记录 N0 核验决定及 N1 设计文档 |
| docs/retailops/plans/RETAIL-05P-N1-FORMULA-DECISIONS.md | 新增；#24 | N1 候选公式、精度/口径、手算 fixture 与集中待决清单，不是生产合同 |
| docs/retailops/acceptance/RETAIL-05P-N0.md、docs/retailops/acceptance/RETAIL-05P-N1.md、docs/retailops/acceptance/RETAIL-05P-N2.md、docs/retailops/acceptance/RETAIL-05P-N3.md、docs/retailops/acceptance/RETAIL-05P-N4.md、docs/retailops/acceptance/RETAIL-05P-N5.md | 新增；#24 | 各节点回执，保留失败历史 |
| apps/retailops/src/domain/decision/markdown-calculation.ts | 新增；#24 | 纯领域函数和本任务输入/候选/解释结果 schema；不导入 DB/应用/Runtime |
| apps/retailops/src/domain/index.ts | 修改；#24 独占 | 仅导出本模块公开合同；不得改其它领域导出 |
| apps/retailops/test/unit/decision/markdown-calculation.test.ts | 新增；#24 | 测算规则单元测试 |
| apps/retailops/test/contract/decision/markdown-calculation.test.ts | 新增；#24 | 输入和结果 schema/合同边界测试 |
| apps/retailops/src/domain/product/**、batch/expiry/inventory/policy/existing decision contracts | 只读；RETAIL-01 owner | 复用 0.3.0；无合同修改授权 |
| apps/retailops/package.json、package-lock.json、tsconfig*.json、vitest.config.ts | 只读；包共享 | 不增加依赖、不改发现范围 |
| #20 的 application ports、adapters/persistence/sqlite/**、test/**/persistence/** | 只读；#20 独占 | 无重叠可写路径 |
| 根清单/锁文件、根 src/**、共享模块、总体计划、DAG、Issue 原文 | 只读；共享 owner / 主控 | 不得修改 |

## 已批准原则与未决参数门禁

N0 从 DECISIONS-PENDING.md 核验到：D04 已批准折价须受确定性政策硬约束，但折价步长、上限、最低价/毛利、适用时段及优先级明确延期到 RETAIL-05P；D05 损耗目标、公式、分母、反事实基准和报告单位由 RETAIL-12 / RETAIL-19 负责；D06 折价需求响应、替代性、弹性和不确定性仍未冻结；D02 单位、数量精度、舍入和时区也未冻结。

因此：
- 不允许在模块或生产输入里填充任意折扣步长、上限、价格底线、毛利阈值、需求响应、损耗公式、单位换算或舍入默认值。
- 测算调用方必须提供明确参数、单位/尺度、策略/来源引用和公式版本。缺少决定结果所需输入时返回结构化不可计算/拒绝结果。
- N1 先列出 PRD、Issue 和 D04–D06 允许的公式/假设，使用标注为 test fixture 的手算样例；不能以 fixture 值成为生产默认值。若损耗公式或舍入/候选生成语义无法由批准文档确定，N1 暂停并将所需业务决策集中提交，不进入 N2。
- Policy v0.3.0 目前仅含身份、revision 和 evidence IDs，不得自行扩字段或从其空缺推断阈值。新的计算输入仅能表达由调用方明确提供并带来源的参数。

## N1–N5 具体执行与验收

| 节点 | 工作 | 验收标准 / 证据 |
|---|---|---|
| N1 公式/假设 | 对照批准 PRD、RETAIL-05P Issue 和已批准合同，形成候选规则；写明收入、贡献利润、损耗的变量、单位、来源、公式版本、精度/舍入前置。建立可手算 fixture 并在 docs/retailops/plans/RETAIL-05P-N1-FORMULA-DECISIONS.md 汇总主控待决项。必要口径未批准前不得冻结生产公式或进入 N2。 | 公式/假设表与手算结果；每个参数有来源或明确标为 fixture；无默认生产阈值；主控核验后才继续。 |
| N2 候选与硬规则 | 实现候选生成和可售/质量/效期/库存/显式策略边界校验。候选不满足任一硬规则时不能变为 executable/accepted；错误原因稳定且具体。 | 单元测试证明通过/拒绝及每条原因；质量非 PASS、过期/边界未解析、零库存/缺输入都不能产生可执行候选。 |
| N3 可解释输出 | 返回收入、贡献利润、损耗的结构化结果，以及公式版本、输入引用、来源、单位、参数/假设、硬规则结果和拒绝原因。显式区分观察窗、未来模拟窗、asOf 与快照；每个候选必须显式声明需求证据为 ADEQUATE 或 UNCERTAIN，缺字段不可计算、UNCERTAIN 拒绝且不给指标。 | 结果 schema 校验候选与来源映射、状态/原因/售价一致性、数量守恒与精确金额恒等式；历史来源不得晚于快照；无 KPI/因果声明。 |
| N4 定向回归 | 执行 Issue 全部案例和原领域合同测试；保留原有测试断言。 | 覆盖手算常规案例、多候选、折扣边界、舍入/精度、过期、质量异常、毛利、零库存/缺失、需求不确定、无可行解、确定性。Build/typecheck/test 与原合同均记录真实结果。 |
| N5 交付 | 更新节点回执、差异和 PR 文档；推送独立分支，创建目标 develop/retailops 的 PR，保持 Issue REVIEW。 | docs:check、git diff --check、文件范围与包 build/typecheck/test 证据齐全；不合并/不 DONE。 |

## 命令及测试发现

- 使用 WSL Ubuntu 24.04 / Node 24 / npm 11 和 apps/retailops 专属 lockfile。
- N0 仅执行根 npm run docs:check 与 git diff --check；不运行生产或模型。
- N4 在 apps/retailops 执行 npm run build、npm run typecheck、npm test；定向测试使用 npm test -- test/unit/decision/markdown-calculation.test.ts test/contract/decision/markdown-calculation.test.ts。
- Vitest discovery 保持现有 test/unit/**/*.test.ts、test/contract/**/*.test.ts，不改配置。原领域合同测试作为全套 npm test 的一部分必须继续通过。
- N5 根目录运行 npm run docs:check、git diff --check 和仅本任务路径的文件范围审查。

## N0 三层语义对齐

- PRD / 总体计划：决策测算是可解释、确定性业务能力；Agent 可使用但不取代规则；模拟不是现实因果结论。
- Issue #24 / 原 RETAIL-05P-PLAN：折扣候选、利润和损耗、硬边界与解释输出；不实现实际执行。此 Plan 补充未决参数 fail-closed 门槛。
- N0 标准：基线、上游、独立工作区、可写路径、互斥锁、参数状态及检查命令已记录；证据见 N0 回执。N0 回执中的“等待 N1 核验”是该节点完成时的历史快照；当前 N1 已通过主控复核，N2 实施中。
