# RETAIL-01（GitHub Issue #19）节点验收回执

状态：N0–N5 PASS（含独立 Review 修订）；当前候选领域合同 `0.3.0`（npm 包版本仍为 `0.1.0`）；PR #86 Open、未合并，等待独立 Review；Issue 尚未 DONE。各节点事实按时间追加，不覆盖失败记录。

## N0：预检、依赖和文件范围冻结

### 基线与依赖

- GitHub Issue #19：Open / IN_PROGRESS，标签 `IN_PROGRESS`，分配给 `2Zest`；Project #2：In Progress。用户明确授权认领。
- 远程 `develop/retailops` 与本 Worktree HEAD：`8922d6aed84530779d2641d817ca01ec40ec76f0`。
- PR #83 实际 `merged=true`，merge SHA `d3b402945ace1da4cd9e032690a394526079d09b`；Issue #14 Closed/DONE，Project Done。
- PR #84 实际 `merged=true`，merge SHA `4110e8e5f429ccd021e4cc0ada2e4eb188f037da`；Issue #15 Closed/DONE，Project Done。
- Issue #7 当前 Open/BLOCKED；不属于 #19 的硬依赖。本任务无真实模型、Runtime、容器或副作用步骤。
- 独立 Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-01`；分支 `feat/retail-01`，tracking `origin/develop/retailops`；创建时干净，原始 Plan 未修改。

### 输入与版本

| 文件 | 基线 Blob SHA-1 |
|---|---|
| `RETAILOPS-MASTER-PLAN-V0.2.md` | `f4baf060fc335a2844b8bf783c2f044cb3b89170` |
| `RETAILOPS-SCENARIO-V0.2.md` | `88ec6f760ad92fbd071dc1cea86685bf9dc15b79` |
| 已批准 `RETAILOPS-PRD-V0.2.md` | `8e6ad021ad6344461407cecea21da8d8b28fa28e` |
| 已批准 `RETAILOPS-ARCHITECTURE-V0.2.md` | `59e5ba533f3bbae60a62a0f357737fab4562fda7` |
| 已批准 `RETAILOPS-ADR-V0.2.md` | `a3cbac396a0b378a8fa1d456a2452dd38bdfb5ba` |
| `DECISIONS-PENDING.md` | `68c134897483b1ed04ad1263b0c5f7fbc351b1de` |
| Issue 契约 `issues/RETAIL-01.md` | `62677bab973a11f86c66de39831ed2e6fd57e4d5` |
| 原始 Plan `plans/RETAIL-01-PLAN.md` | `43e7d2bba938a17523fbd6d8f3900e2406ae66eb` |
| `PROJECT-STRUCTURE-AND-OWNERSHIP.md` | `e12ada6020bfdfaa0667ad50f6bde1112520105d` |
| `ISSUE-PR-PROJECT-STATUS.md` | `7370d7c0295670883c90ed4d854f7506024ff60c` |

已读取 RETAIL-00E-01 与 RETAIL-00E-02 合并研究。公开销量仅为归一化观测；批次、物理库存、成本及真实门店映射不存在于所调查字段。研究项目中的参数/公式不作为 RetailOps 业务默认。

### 环境、依赖与允许路径

- WSL2 Ubuntu 24.04；Node `v24.22.3`，npm `11.19.1`，`x86_64` / `linux/amd64`。
- 预检时 `MemAvailable=13,332,084 KiB`（约 12.72 GiB）；WSL `/` 可用约 940 GiB，`D:` 可用约 611 GiB。
- 根 `node_modules`、`apps/cloud-agent/node_modules`、`apps/retailops/**` 均不存在。
- 基线根锁中已解析版本：Zod `4.4.3`、TypeScript `5.9.3`、Vitest `4.1.8`、`@types/node` `22.19.19`。由本任务的独立 manifest/lock 固定，不修改根 package/lock。
- 精确允许新增路径及依赖/测试入口见 [`RETAIL-01-EXECUTION-PLAN.md`](../plans/RETAIL-01-EXECUTION-PLAN.md)。未列路径只读；不改数据库、API、Agent、MCP、Runtime、宿主、根配置或其他 Issue。
- N0 环境命令实际退出码均为 0：`node --version`、`npm --version`、`grep '^MemAvailable:' /proc/meminfo`、`df -h / /mnt/d`、`git status --short --branch`、`git diff --check`。

### N0 三层语义一致性

| 对齐层 | 预期 | 实际及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 领域合同先于消费任务；V0 单 SKU，来源分类明确；保留运行门槛 | #14/#15 实际合并；基线含已批准 PRD/Architecture/ADR；#7 BLOCKED 但非硬依赖，本任务不启动 Runtime | PASS |
| Issue / 原 Plan | 新增独立包，只实现六类类型/schema/状态 guard；不落库 | `apps/retailops` 尚不存在；锁定本包独占路径；原始 Plan 和 DAG 保持只读 | PASS |
| N0 节点标准 | HEAD、上游、授权、环境、文件边界和检查入口固定 | HEAD=`8922d6aed84530779d2641d817ca01ec40ec76f0`；两个 PR merge SHA 已经 GitHub 实际回读；Node/npm 与锁版本已核对 | PASS |

- N0 结论：PASS。允许进入 N1–N3；无需修改范围或 DAG。
- 审核者/时间：主控 Agent，2026-11-26。

## N1：契约快照

- 目标：确认命名/键、单位、金额、日期、来源与版本合同，集中列出 D01/D02/D03/D07 的推荐、依据、影响和责任节点。
- 实际动作：新增本回执中的 N1 决策表与合同快照；推荐显式字符串 ID、十进制数量、显式币种/scale、区分日期与 instant、所有来源显式标记。具体门店/SKU、单位/换算、币种/精度、时区/效期/质量阈值和初始库存来源全部保持未冻结。
- 证据：基线 PRD/Architecture/ADR、`DECISIONS-PENDING.md` Blob SHA `68c134897483b1ed04ad1263b0c5f7fbc351b1de`、RETAIL-00E 真实数据调查。公开历史销量没有物理库存、批次和真实门店映射，因此不推导上述业务值。
- 实际修改：`docs/retailops/plans/RETAIL-01-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-01.md`。
- 测试命令/退出码：本节点产物为合同快照，无单独运行测试；最终文档检查见 N4。
- 阻塞/未验证：如果 Review 认定某个业务值必须在 #19 冻结且不能保持显式输入/延期，则该值不予定默认，暂停对应合同并等待用户决策。
- 节点结论：PASS；三层对齐见下方矩阵。

## N2：Schema 与状态 guard

- 目标：仅实现 Product、Batch、Policy、Evidence、Draft、Operation 的类型、校验与纯状态迁移 guard，不落库、不执行外部副作用。
- 实际修改：独立包 `apps/retailops/**`。数量/金额/日期有显式输入校验；库存分区以 BigInt 十进制运算验证 `physicalOnHand = unavailable + availableToSell + reserved`（调用方仍须提供互斥分区汇总）；Evidence 来源分层及 `DERIVED`/`SIMULATED` 元数据必填；效期需要显式同类 `asOf`，未知质量、缺输入、时间形式不符或边界相等 fail-closed；Draft 与 Operation 阻断未经风险审查、有效审批、硬规则/授权/快照/策略/idempotency 前置检查的执行迁移，`UNCERTAIN` 只能凭对账结果离开。
- 状态覆盖：`RISK_REJECTED`、`RISK_FAILED`、`RISK_TIMEOUT`、`APPROVAL_REJECTED`、`APPROVAL_REVOKED`、`APPROVAL_EXPIRED`、`STALE`、`FAILED`、`CANCELLED`、`UNCERTAIN`；拒绝或失败不通往审批/完成，未知副作用不自动转完成。
- 实际修改文件：
  - 包边界：`apps/retailops/package.json`、`package-lock.json`、`tsconfig.json`、`tsconfig.test.json`、`vitest.config.ts`。
  - 领域代码：`src/domain/shared/primitives.ts`、`product/product.ts`、`inventory/{batch,stock-balance,operation}.ts`、`expiry/expiry.ts`、`policy/policy.ts`、`evidence/evidence.ts`、`decision/draft.ts`、`index.ts`。
  - 测试：`test/unit/domain-values.test.ts`、`test/unit/state-guards.test.ts`、`test/contract/domain-schemas.test.ts`。
- 失败及修正记录：首次 build 因状态表 `.includes()` 字面量类型收窄失败（两个 TS2345）；改为不需要类型断言的 `.some()` 校验后 build 通过。首次测试命令误指向不存在的 WSL 工作目录，退出 1；修正目录后重跑通过。均未降低断言或扩大范围。
- 阻塞/未验证：没有跨对象持久化一致性、运行时授权、真实审批或真实副作用能力；它们不在 #19 范围。
- 节点结论：PASS；三层对齐见下方矩阵。

## N3：合同版本规则（初始实现历史快照，合同 `0.1.0`）

- 目标：明确合同版本、消费者兼容策略及未知版本行为。
- 实际动作：六类 Schema 共用必填字面版本 `0.1.0`；缺失/未知版本拒绝；不 coercion、不补字段、不自动迁移；任何字段语义、接受范围或状态转换改变都需显式新版本；0.x 消费者必须固定精确版本；本包不带多版本 adapter。
- 实际修改：`src/domain/shared/primitives.ts` 中 `CONTRACT_VERSION` 与 `contractVersionSchema`；兼容说明写入本回执与细化执行计划。具体 D01–D07 业务值未被冻结。
- 测试：`test/contract/domain-schemas.test.ts` 覆盖缺失及未知版本拒绝。
- 阻塞/未验证：未实现版本迁移或跨版本消费。
- 节点结论：PASS；三层对齐见下方矩阵。

## N4：定向测试与工程回归

### 环境与实际结果

- 执行环境：WSL2 Ubuntu 24.04、Node `v24.22.3`、npm `11.19.1`、`linux/amd64`。
- 独立锁依赖：Zod `4.4.3`、TypeScript `5.9.3`、Vitest `4.1.8`、`@types/node` `22.19.19`；`npm ls --depth=0` 退出码 0。
- `apps/retailops` 独立执行 `npm ci --ignore-scripts --no-audit --no-fund`：退出码 0，安装 48 个包；未修改根 package/lock 或启用 workspace。
- `npm run build`：退出码 0。
- `npm run typecheck`：退出码 0。
- `npm test`：退出码 0；Vitest 实际仅发现 `test/unit/**/*.test.ts` 和 `test/contract/**/*.test.ts` 下 3 个文件、17 项通过。
- 根 `npm run docs:check`：首次从 WSL 直接执行因 Windows Worktree `.git` 指针路径不能由 WSL Git 解析而退出 1；设置对应 `GIT_DIR`、`GIT_WORK_TREE` 与 `core.autocrlf=true` 后重跑退出码 0，检查 254 个 Markdown 文件。
- `git diff --check` 与 `git diff --cached --check`：最终暂存内容检查均退出码 0；仅路径在冻结清单内。

### T01 与验收标准

| 检查项 | 证据 | 结果 |
|---|---|---|
| 数量非法值、非数字及指数格式 | `test/unit/domain-values.test.ts` | 负数、number 和指数形式拒绝 |
| 金额形式、缺币种/scale | 同上、`test/contract/domain-schemas.test.ts` | 小数文本、缺币种或 scale 拒绝；金额使用明确最小单位整数字符串 |
| 日期、时区和 offset | 同上 | 不存在日期、未带 offset、未知 timezone、未知 offset 拒绝 |
| 缺 Policy、未知状态、非法迁移 | `test/contract/domain-schemas.test.ts`、`test/unit/state-guards.test.ts` | Draft 缺 policy ref、未知 status、绕过风控/审批/预检、无回执完成、无对账清除 uncertain 均拒绝 |
| 来源分层/证据与 fail-closed 边界 | `test/unit/domain-values.test.ts` | PUBLIC_HISTORICAL、DERIVED、SIMULATED 元数据形状；质量 FAIL/UNKNOWN、缺效期、边界/格式不匹配均不获正向可售结论 |
| 库存守恒 | 同上 | 精确十进制平衡通过；不守恒、负分区、单位不一致拒绝 |
| 无未批准默认值 | 源码检查及测试 fixture | 无 schema `.default()`、无浮点业务计算；测试 `fixture-*`、USD/UTC 等仅为显式 fixture，不充当生产配置 |

### N4 三层语义一致性

| 对齐层 | 实际结果 | 判定 |
|---|---|---|
| 总体计划 / PRD / Architecture / ADR | 单 SKU V0、来源分层、库存守恒、安全审批/副作用门槛保留；未启用 Runtime、数据库或 Agent | PASS |
| Issue #19 / 原 Plan / task C | 六类对象 schema/类型、单位与状态合同、版本规则和独立单测实现；原 Issue、Plan、DAG 未改 | PASS |
| 节点测试与交付标准 | 独立 install/build/typecheck/test、T01、文档和差异检查均有真实结果；无外部运行验收宣称 | PASS |

## N5：独立 PR 与 Review

- 代码交付提交：`5c5caa15782f7b327e90626aecfe5f9e5f2937f9`；分支 `feat/retail-01` 已推送并 tracking `origin/feat/retail-01`。
- PR：[https://github.com/2Zest/OpenDot-RetailOps/pull/86](https://github.com/2Zest/OpenDot-RetailOps/pull/86)，目标 `develop/retailops`，创建时 GitHub 回读 `state=open`、`merged=false`、base SHA `8922d6aed84530779d2641d817ca01ec40ec76f0`、head SHA `5c5caa15782f7b327e90626aecfe5f9e5f2937f9`。
- 回滚：`git revert 5c5caa15782f7b327e90626aecfe5f9e5f2937f9`；无数据库数据迁移。
- Issue #19 已通过 GitHub API 更新并回读：Open，标签 `REVIEW`，指派仍为 `2Zest`；正文顶部已记录 PR #86 与 REVIEW 状态。
- 首次交付时 Project 状态同步曾失败：当时使用的 GitHub connector 无看板写入能力，Windows PATH 无 `gh`，浏览器自动化亦未完成。独立 Review 修订中已在 WSL 找到 `/home/szz_user/.local/bin/gh` `2.106.0`，`gh auth status` 确认账号 `2Zest` 有 `project` scope；执行 `gh project item-edit 2 --owner 2Zest --url https://github.com/2Zest/OpenDot-RetailOps/issues/19 --field Status --value Review --format json` 后，用 `gh project item-list 2 --owner 2Zest --limit 500 --format json --jq '.items[] | select(.content.number == 19) | {id,title,status}'` 回读 `status=Review`。
- PR #86 保持 Open、目标 `develop/retailops`，未合并；未关闭 Issue、未标 DONE、未启动下游任务。
- 未启动下游 RETAIL-01P（GitHub Issue #20）、RETAIL-05P（#24）或 RETAIL-13A（#35）；不处理 #7 的 N1 阻塞任务。
- 节点结论：PASS，等待独立 Review 与用户后续决定；未合并不代表 DONE。

### N1 候选决策（未批准值不冻结）

以下是实现需要的表示建议和延期项，不构成业务参数批准；在未收到明确决策前，schema 只要求调用方显式提交参数，不替调用方填值。

| 决策 | 本任务建议/现有批准边界 | 依据、影响与延期责任 | 当前处理 |
|---|---|---|---|
| D01 标识与业务键 | 用必填、不透明字符串标识 Product、Batch、Policy、Evidence、Draft、Operation 及外部引用；不生成、不推断真实门店/SKU映射 | D01 指定试点门店与 SKU/品类值由 RETAIL-01（GitHub Issue #19）/RETAIL-03 按数据覆盖与业务确认冻结；公开编码不等于真实业务映射 | 本包只冻结引用形状；未选择具体门店、SKU 或业务 ID 编码 |
| D02 数量、金额、单位与精度 | 数量使用必填非负十进制字符串及必填单位码，守恒使用整数精确运算；金额使用必填最小单位整数字符串、币种码和 scale，不做换算/舍入 | D02 将单位、包装换算、精度/舍入、时区/营业日边界列为 RETAIL-01（GitHub Issue #19）/RETAIL-03 的责任决策；公开历史销量为归一化观测，不能充当实物数量或金额 | 只定义无默认的表示形状；未选择单位目录、币种、scale、换算或舍入 |
| D03 批次、效期与质量 | 日期与带 offset 的时刻使用不同显式形式；必须传入明确时区/offset 与 `asOf`；无法判断或恰处边界返回 `UNRESOLVED` | D03 指定批次字段、到货/生产/到期语义、临期窗口和质量检查由 RETAIL-01（GitHub Issue #19）/RETAIL-03 的责任节点结合业务/食品安全规则冻结；仅执行已批准的过期/质量异常不可售原则 | 未选择具体效期边界、临期窗口或质量阈值 |
| D07 库存来源 | 输入必须引用 Evidence；来源限定为 `PUBLIC_HISTORICAL`、`DERIVED`、`SIMULATED`、`LIVE_DEVICE`；派生/仿真记录要求其来源元数据 | D07 指定初始库存、到货、批次的真实/仿真来源及盘点差异流程由 RETAIL-01（GitHub Issue #19）/RETAIL-03 负责；研究显示 FreshRetailNet 不含目标批次库存 | 无隐式来源；未选择 LIVE_DEVICE 接入、真实库存映射或仿真默认 |

### N1 合同快照（初始实现历史快照，合同 `0.1.0`）

- 六类对象统一携带必填 `contractVersion: "0.1.0"`；未知或缺失版本拒绝。该版本只标识本独立包的工程合同，不含业务默认。
- `Quantity` 采用十进制字符串 `value` 与必填 `unitCode`；所有库存分区必须同单位，`physicalOnHand = unavailable + availableToSell + reserved` 使用精确十进制算术。合同将三个数量解释为互斥分区，schema 校验非负、同单位和算术守恒；它不能从汇总数推导实物行是否重复，调用方必须提供互斥统计。单位转换和舍入不属于本合同。
- `Money` 采用最小单位整数字符串、必填 `currencyCode` 与非负整数 `minorUnitScale`；只检查明确字段与格式，不选择实际币种或精度，不进行折扣、汇率、毛利计算。
- `Expiry` 显式区分 `DATE_ONLY + timeZone` 与 `INSTANT + offset timestamp`；判断还需显式同类 `asOf`。效期前且质量为 `PASS` 才可能返回候选可售；超过边界返回阻断，边界相等、缺信息或形式不匹配返回 `UNRESOLVED`。未批准的业务效期和质量政策仍需由下游冻结。
- Evidence 明确记录来源分类、snapshot/locator、观测时刻；`DERIVED` 要求父 Evidence 和方法版本，`SIMULATED` 要求 scenario、seed 和 generator 版本。Policy 仅携带身份、revision、来源引用，不含业务阈值。
- Draft 绑定显式输入快照、Policy revision、Evidence、候选 Operation 和不透明 digest 字段；本任务不生成/验证摘要，不处理审批或执行副作用。Draft/Operation guard 仅校验批准状态机中的合法迁移，并要求明确风险审查、审批、执行前置条件或 uncertain 对账结果。
- Operation 只覆盖 V0 折价候选与损耗处置意图；不实现 V1 预占/释放、补货/订单完成或执行服务。
- D01/D02/D03/D07 的证据、推荐、影响及责任节点已集中列于上表。若独立 Review 判定某个业务参数必须由 #19 固定而不能保持必填或延期，将暂停该参数相关实现并等待用户决定。

### N3 兼容规则（初始实现历史快照，合同 `0.1.0`）

- 消费者固定精确合同版本 `0.1.0`；Schema 不执行 coercion、字段补齐、别名映射或自动迁移。版本缺失或不等于当前版本均拒绝。
- 任何改变字段语义、schema 接受/拒绝范围或状态迁移的变更必须使用新的显式合同版本。`0.x` 阶段不承诺 minor 版本间自动兼容；调用方须固定明确版本。
- 只有不改变合同字段、校验和状态语义的包/文档修订才可保留 `0.1.0`。本包不包含多版本 adapter 或迁移实现。

#### N1 三层语义一致性（实现前快照）

| 对齐层 | 结果 | 判定 |
|---|---|---|
| 总体计划 / PRD / Architecture / ADR | 保留单 SKU V0、库存互斥守恒、来源分层、硬规则 fail-closed、审批和 uncertain 边界；不加 Runtime/RAG/持久化 | PASS |
| Issue #19 / 原 Plan | 交付六类领域合同、schema、单位/状态合同与单测；未改 Issue、原 Plan、DAG | PASS |
| N1 节点标准 | 有候选契约快照；D01/D02/D03/D07 具体值均显式必填或延期，没有设隐式默认 | PASS |

## 独立 Review 修订（2026-11-26；修订基线 HEAD `d55910419f1e1524c4c30b8d18c20837f715b908`）

按 Review 要求在原架构和原 PR 内修复，不改总体计划、DAG、原 Plan 或其他 Issue，不引入新依赖，不冻结未批准业务参数。先追加负向回归测试，再执行实现；不删改原 17 项测试与断言。

### N2：缺陷修复对照

| 缺陷 | 修订 |
|---|---|
| FAIL/UNKNOWN 批次仍可带可售/预占量 | `batchSchema` 在库存 schema 已校验后加入跨字段约束；非 PASS 质量仅允许可售量与预占量均为零。库存守恒仍使用 BigInt 精确计算；未实现预占释放服务。 |
| 运行时非法效期/质量可能得到 ELIGIBLE | `assessSellability` 先对运行时输入执行严格 Zod `safeParse`；非法状态、日期、缺失/未知时区、错误结构返回 `UNRESOLVED/INVALID_INPUT`；缺失字段为 `UNRESOLVED/MISSING_INPUT`。只有合法 PASS、效期和检查时刻可以参与比较；相等边界保持 UNRESOLVED。 |
| 通用 Money 与候选售价约束未分开 | 通用 `moneySchema` 继续接收有符号最小单位金额；MARKDOWN_PROPOSAL 另加非负售价 schema。没有最低售价、折扣上限或毛利阈值。 |
| 状态 guard 对过期/撤销/失效/异常输入保护不足 | Draft/Operation guard 对状态与证据先做运行时 schema 校验，未知/非法输入返回 `false`；执行要求完整有效 precheck。新增审批撤销/过期、授权拒绝、硬规则失败、快照/策略失效、取消和对账条件。未知副作用只能进入 UNCERTAIN；无对账或 BLOCKED 对账不能清除 UNCERTAIN。 |
| timeout 与确定性无副作用失败未区分 | 增加 `TIMEOUT_NO_EFFECT` 和 `TIMEOUT_UNKNOWN`：前者允许确定性 FAILED/CANCELLED，后者才允许 UNCERTAIN；通用 UNKNOWN 也保持 UNCERTAIN。风险审查 timeout 仍进入 RISK_TIMEOUT。 |
| Zod 子字段失败后库存 refine 仍触发 BigInt 错误 | `stockBalanceSchema` 在跨字段计算前分别 `safeParse` 所有数量字段；十进制求和 helper 先核验输入格式，坏值作为 schema 失败返回，不进入 BigInt 转换。候选售价约束也不对非法数值执行 BigInt 转换。 |

### N3：合同版本（第一轮 Review 历史快照，合同 `0.2.0`）

- 原 PR 未合并；原 `0.1.0` 尚无正式消费者。Review 收紧 schema 接受范围并增加状态值，按原 N3 “任何接受/拒绝范围或状态语义变化使用新显式版本”规则，将 `CONTRACT_VERSION` 从 `0.1.0` 提升为 `0.2.0`。原版本现被拒绝，测试已覆盖；无版本自动迁移或 adapter。
- npm 包发布版本仍为 `0.1.0`，与领域合同版本分别表达包版本和数据合同版本；未改依赖或 lockfile。
- 未更改 D01/D02/D03/D07 业务参数；效期边界、售价阈值等仍不设默认。

### N4：修订前复现及最终复测

- 测试先行复现（修订前）：`npm test` 退出码 1，原 17 项全部通过，新加的 7 个回归用例失败；捕获负售价被接收、非法运行时效期获得 ELIGIBLE、质量/库存矛盾被接收、指数数量使 `safeParse` 抛 `SyntaxError: Cannot convert 1e2 to a BigInt`，以及状态输入/timeout/审批前置缺口。
- 一次修复后运行出现 1 项版本测试夹具错误：断言误把新当前值 `0.2.0` 当成未知值；已改为验证旧 `0.1.0` 被拒绝，未调整生产行为或降低断言。
- WSL2 Ubuntu 24.04 / Node `v24.22.3` / npm `11.19.1` / `linux/amd64`。定向检查：`npm run build` 退出码 0；`npm run typecheck` 退出码 0；`npm test` 退出码 0，3 个文件、24 项通过（原 17 项保留，新增 7 项）。
- 根 `npm run docs:check`：设置 Worktree 对应 `GIT_DIR`、`GIT_WORK_TREE` 与 `core.autocrlf=true` 后退出码 0，检查 254 份 Markdown。
- `git diff --check d559104...HEAD` 与 `git diff --check`：退出码均为 0；相对 Review 基线的文件范围检查退出码 0，10 个改动文件全部在冻结/Review 授权范围内，未发现额外路径。
- 预期文件范围：`apps/retailops/src/domain/shared/primitives.ts`、`expiry/expiry.ts`、`inventory/{batch,stock-balance,operation}.ts`、`decision/draft.ts`；`apps/retailops/test/unit/{domain-values,state-guards}.test.ts`、`test/contract/domain-schemas.test.ts`；本文件。未改 package/lock、宿主、Issue 契约、总体计划、Architecture、ADR 或 DAG。

### N5：Issue、Project、PR 状态

- WSL `gh 2.106.0` 从 `/home/szz_user/.local/bin/gh` 执行；`gh auth status` 确认 `2Zest` 已登录且有 `project` scope（不记录任何凭据）。Project #2 状态成功改为 Review，并通过 `gh project item-list` 回读为 `Review`。
- Issue #19 正文中的 `IN_PROGRESS` 已改为 N0 历史快照，顶部状态维持 Open/REVIEW；Project #2 与 Issue 状态统一为 Review（Issue 与 Project 均已回读）。
- 复用 PR #86，目标仍为 `develop/retailops`；该轮推送后 PR 保持 Open/未合并，Issue 未关闭且未标 DONE。第二轮修订的当前状态记录于本回执末尾并经 GitHub 回读。
- 下游 #20、#24、#35 未启动；#7 Docker 阻塞和真实 Runtime 门槛保持不变。

## 第二轮独立 Review 修订（2026-11-27）

- 审查基线：`619cc7391c17ee12876ce4308c0bf97f8a76c3ce`。本轮只修改 Draft/Operation Guard、状态合同回归测试、RETAIL-01 执行计划及本验收回执；未改总体计划、Architecture、DAG、依赖或下游文件。
- 审批证据一致性：独立审批结果与 `precheck.approval` 同时提供时必须相符；`APPROVED` 对应 `VALID`，`REVOKED`/`EXPIRED` 对应相同状态，`REJECTED` 不可与预检状态并用。矛盾或跨阶段的预检/执行/对账证据被 Guard 拒绝；撤销/过期与有效预检并存不能进入 `EXECUTING`。
- PRECHECK 结果合同：新增 `precheckOutcome`，仅含 `NO_EFFECT` 和 `UNKNOWN`。前者才允许取消；后者只能进入 `UNCERTAIN`，不能归类为普通失败或取消。执行服务、副作用实现与对账服务均未新增；UNCERTAIN 继续要求显式 reconciliation 才能解除。
- N3 版本处理：新增 `precheckOutcome` 字段及 PRECHECK 状态转换，属于输入/状态语义变更，故将当前 `CONTRACT_VERSION` 从 `0.2.0` 提升至 `0.3.0`。初始 `0.1.0` 和上一轮 `0.2.0` 保留为历史版本快照，但当前 schema 均拒绝；不做兼容映射或自动迁移。npm 包发布版本仍为 `0.1.0`。
- 测试先行：新增两组回归用例后，修复前 `npm test` 退出码 1，原 24 项通过、新增两组失败，分别捕获矛盾审批/预检被放行和 PRECHECK 无 UNCERTAIN/NO_EFFECT 区分。应用 `0.3.0` 后曾有一轮完整测试因既有 fixture 仍使用旧 `0.2.0` 而失败（7 项）；更新 fixture 并增加旧版拒绝断言后最终全量复测通过，原 24 项未删除或弱化。
- 最终验收：WSL2 Ubuntu 24.04、Node `v24.22.3`、npm `11.19.1`；`npm run build` 退出码 0；`npm run typecheck` 退出码 0；`npm test` 退出码 0，3 个文件、26/26 项通过；`npm run docs:check` 退出码 0，254 份 Markdown；`git diff --check` 与 `git diff --cached --check` 退出码均为 0。
- 最终文件范围共 8 项：`apps/retailops/src/domain/{decision/draft.ts,inventory/operation.ts,shared/primitives.ts}`、`apps/retailops/test/contract/domain-schemas.test.ts`、`apps/retailops/test/unit/{domain-values.test.ts,state-guards.test.ts}`、本执行计划和本回执。未改包清单/锁文件、宿主、API、数据库、Runtime 或业务服务。
- PR #86 继续以 `develop/retailops` 为目标并保持 Open/未合并；Issue #19 保持 Open/REVIEW；Project #2 保持 Review。未启动下游任务或改变 #7 的 BLOCKED 状态。

### 修订验收三层语义对齐

| 对齐层 | 实际结果 | 判定 |
|---|---|---|
| 总体计划 / 已批准 PRD、Architecture、ADR | 库存质量 fail-closed、授权与硬规则、审批撤销/过期、uncertain 对账、来源分层保留；无运行时和副作用实现 | PASS |
| Issue #19 / 原 Plan / Review 修订任务 | 修订严格限于 RETAIL-01 领域合同及负向测试；D01/D02/D03/D07 未设新默认，合同版本遵守 N3 | PASS |
| N2–N5 验收标准 | 前轮修订 build/typecheck/24 项测试通过；第二轮独立 Review 的失败复现、合同版本与最终检查见本回执末尾 | PASS |
