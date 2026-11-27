# RETAIL-01 任务 C 细化执行计划

状态：N0 已冻结，供主控复核；不修改原始 [`RETAIL-01-PLAN.md`](../initial-plan-v0.2/plans/RETAIL-01-PLAN.md)、Issue 契约、总体计划或 DAG。

## 任务与基线

- RETAIL 编号 / GitHub Issue：`RETAIL-01` / [#19](https://github.com/2Zest/OpenDot-RetailOps/issues/19)。已获用户认领授权。
- 当前状态：Issue Open / IN_PROGRESS；Project #2 为 In Progress；分配给仓库账号 `2Zest`。
- 依赖：RETAIL-00C / GitHub Issue #14，PR #83 merge SHA `d3b402945ace1da4cd9e032690a394526079d09b`；RETAIL-00D / GitHub Issue #15，PR #84 merge SHA `4110e8e5f429ccd021e4cc0ada2e4eb188f037da`。两项均 Closed/DONE，Project 为 Done。
- 业务安全状态：RETAIL-00F / GitHub Issue #7 仍 Open/BLOCKED；它不是本任务硬依赖。本任务不运行真实模型、Runtime、容器或有副作用服务。
- 基线 `develop/retailops`：`8922d6aed84530779d2641d817ca01ec40ec76f0`，与 Issue #19 最新任务 C 要求一致。
- Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-01`；分支：`feat/retail-01`，tracking `origin/develop/retailops`；创建时干净。
- 环境：WSL2 Ubuntu 24.04，Node `v24.22.3`、npm `11.19.1`、`linux/amd64`。可用内存 `13,332,084 KiB`，WSL `/` 可用约 940 GiB，`D:` 可用约 611 GiB。

## 只读输入及固定版本

| 输入 | 基线文件 Blob SHA-1 | 用途 |
|---|---|---|
| Master Plan | `f4baf060fc335a2844b8bf783c2f044cb3b89170` | G1、领域切片与依赖边界 |
| Scenario | `88ec6f760ad92fbd071dc1cea86685bf9dc15b79` | V0 单 SKU、来源分层与不做项 |
| 已批准 PRD | `8e6ad021ad6344461407cecea21da8d8b28fa28e` | 库存守恒、来源与 fail-closed 原则 |
| 已批准 Architecture | `59e5ba533f3bbae60a62a0f357737fab4562fda7` | DDD 边界、状态语义及依赖方向 |
| 已批准 ADR | `a3cbac396a0b378a8fa1d456a2452dd38bdfb5ba` | 版本、审批和 uncertain 边界 |
| D01–D16 清单 | `68c134897483b1ed04ad1263b0c5f7fbc351b1de` | 决策责任与延期节点 |
| Issue 契约 | `62677bab973a11f86c66de39831ed2e6fd57e4d5` | #19 允许范围与验收标准 |
| 原始 Plan | `43e7d2bba938a17523fbd6d8f3900e2406ae66eb` | N0–N5 原节点 |
| 结构/路径所有权 | `e12ada6020bfdfaa0667ad50f6bde1112520105d` | 独立包与允许边界 |
| 状态同步规范 | `7370d7c0295670883c90ed4d854f7506024ff60c` | Issue/PR/Project 同步 |

同时读取了 RETAIL-00E-01 与 RETAIL-00E-02 合并研究：公开销量为归一化观测，缺少实际单位、库存批次、成本与真实门店映射；仿真值必须显式标 `SIMULATED`，派生值保留父来源。RETAIL-00E-01 中参考项目的阈值、公式和字段不自动成为本项目合同。

## N0 冻结的包、依赖与文件所有权

`apps/retailops/**` 当前不存在；根 `node_modules` 与 `apps/cloud-agent/node_modules` 也不存在。新增独立 npm 包 `@opendot/retailops`，不启用 workspace，不从宿主私有路径导入，不依赖根安装偶然解析。依赖严格取自基线锁文件的已解析版本：Zod `4.4.3`、TypeScript `5.9.3`、Vitest `4.1.8`、`@types/node` `22.19.19`。包使用自己的 `package-lock.json`；没有依赖源码以外的 Runtime、数据库、网络或 SDK。

测试发现由包自己的 Vitest 配置限定到 `test/unit/**/*.test.ts` 和 `test/contract/**/*.test.ts`。执行入口固定为 `npm ci --ignore-scripts --no-audit --no-fund`、`npm run build`、`npm run typecheck`、`npm test`；在 WSL Node 24 执行。根 `package.json`、根 `package-lock.json`、根 `tsconfig.json`、根 Vitest 配置及 `apps/cloud-agent/**` 只读。

| 路径 | 操作/owner | 验证 |
|---|---|---|
| `apps/retailops/package.json`、`package-lock.json` | 新增；RETAIL-01 独立包 | 精确依赖、独立 `npm ci` 与 lockfile 可复现 |
| `apps/retailops/tsconfig.json`、`tsconfig.test.json`、`vitest.config.ts` | 新增；RETAIL-01 独立配置 | build/typecheck 独立；unit/contract 测试发现边界准确 |
| `apps/retailops/src/domain/shared/primitives.ts` | 新增；领域共享值对象 | ID、版本、数量/金额/时间显式且无默认 |
| `apps/retailops/src/domain/product/product.ts` | 新增；Product 合同 | 必需标识和显式计量单位 |
| `apps/retailops/src/domain/inventory/{batch,stock-balance,operation}.ts` | 新增；库存能力 | 批次来源/质量/效期；精确守恒；不实现 V1 预占服务 |
| `apps/retailops/src/domain/expiry/expiry.ts` | 新增；效期能力 | 未知/无法按已批准语义判断的批次不返回可售通过 |
| `apps/retailops/src/domain/policy/policy.ts` | 新增；Policy 身份/版本合同 | 不添加 RETAIL-05P 阈值或策略服务 |
| `apps/retailops/src/domain/evidence/evidence.ts` | 新增；Evidence 来源合同 | 显式来源类型、快照/定位、派生父项 |
| `apps/retailops/src/domain/decision/draft.ts` | 新增；Draft 类型与纯状态 guard | 保留批准架构 fail-closed 状态，不实现审批/digest 服务 |
| `apps/retailops/src/domain/index.ts` | 新增；本包领域公共导出 | 仅导出本包合同 |
| `apps/retailops/test/unit/domain-values.test.ts`、`state-guards.test.ts` | 新增；纯单测 | T01 数量/金额/日期/状态边界与合法迁移 |
| `apps/retailops/test/contract/domain-schemas.test.ts` | 新增；契约测试 | 六类 schema、未知状态/非法对象拒绝 |
| `docs/retailops/plans/RETAIL-01-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-01.md` | 新增；本 Issue 自有计划/回执 | N0–N5、逐节点三层语义、集中待决策清单 |

未列路径一律只读。特别不改根依赖/锁、宿主、共享类型、数据库、路由、API、MCP、真实 Agent、运行配置、PRD/ADR/DAG 或其它 Issue 文件。不存在文件所有权冲突。

## 领域合同快照与未决参数处理

- 六类合同为 Product、Batch、Policy、Evidence、Draft、Operation；按业务能力放入 `domain/product`、`inventory`、`policy`、`evidence`、`decision` 与 `expiry`，共享值对象留在本包 `domain/shared`。
- 所有实体 `id`、外部业务 ID 和 revision 都是必填、不透明、非空且不生成的字符串；不假定 UUID、门店号或 SKU 业务映射。
- `Quantity` 为 `{ value: nonnegative decimal string, unitCode }`。字符串禁止指数/浮点格式；守恒运算对齐小数位后用整数精确求和，比较前要求单位完全相同。不定义单位目录、换算、最大业务数量或舍入。
- `Money` 为 `{ minorUnits: signed integer string, currencyCode, minorUnitScale }`。币种只校验显式的三位大写 code 形状，不默认真实币种或 scale；不换汇、不计算折扣/毛利、不用浮点。
- 日期为严格 `YYYY-MM-DD`；时刻为带 `Z` 或明确 offset 的 RFC 3339。效期用 `DATE_ONLY + timeZone` 或 `INSTANT + offset timestamp` 显式区分。检查时也必须给同类、显式 `asOf`；日期/时刻恰在效期边界时返回 `UNRESOLVED`，不推断该边界可售。
- Product 必须引用计量单位与 Evidence；Batch 包含 Product 键、效期、质量状态与库存分区；库存分区严格校验 `physical = unavailable + availableToSell + reserved`。`PASS/FAIL/UNKNOWN` 仅表示质量结论状态，`UNKNOWN` 不可售；不添加检测阈值。
- `PUBLIC_HISTORICAL`、`DERIVED`、`SIMULATED`、`LIVE_DEVICE` 为来源分类。Evidence 必须有快照、记录定位和观测时刻；派生来源必须有非空父 Evidence 与方法版本；仿真来源必须有显式 scenario/seed/generator；当前无 LIVE_DEVICE 接入。历史数据不转换为实物单位。
- Policy 仅包含身份、revision、来源和输入引用；不在 RETAIL-01 写折价/临期/毛利政策默认值。Draft 绑定输入快照、Policy revision、Evidence 和候选 Operation，但不计算 digest。状态 guard 只判断允许的纯转换，不做审批或执行。
- Operation 仅描述 V0 的折价候选或损耗处置意图；不实现 V1 reservation/release/order-completion，也不执行副作用。`PRECHECK` 阶段有明确 `NO_EFFECT` 才能取消，结果 `UNKNOWN` 转入 `UNCERTAIN`；执行阶段沿用同样的确定无副作用/结果未知区分。`UNCERTAIN` 只能在显式对账证据存在时离开。审批、预检和执行回执不一致或跨阶段复用时，Guard 拒绝迁移。状态 guard 不是授权或执行入口。
- 当前候选合同版本为 `0.3.0`。初始 `0.1.0` 与上一轮 Review `0.2.0` 均为历史快照，当前 schema 拒绝这两个版本；缺失或未知版本同样拒绝。任何输入/状态语义变化按 N3 使用新的显式合同版本；0.x 消费者固定精确版本，不自动迁移/补字段。

待决事项集中放在本 Issue 回执中，覆盖 D01、D02、D03、D07 的责任范围。基本 Schema 采用显式参数和不透明引用即可表达已批准原则；未知值不会被默认化。若后续评审认定某业务规则必须在本 Issue 固定，停止该规则对应节点并等待用户决定，不以普通实现选择替代审批。

## 节点计划

| 节点 | 原 Plan 目标 | 本轮动作/验收 | 判定与证据 |
|---|---|---|---|
| N0 | 基线/依赖/范围预检 | 锁定上游 merge SHA、最新 HEAD、Node/锁版本、独立包文件清单和命令 | 已完成；见 `acceptance/RETAIL-01.md` N0 |
| N1 | 确认命名/键及单位，产出契约快照 | 形成六类对象、单位/金额/日期/来源/版本表示；列出 D01/D02/D03/D07 的建议和影响，不设值 | 与已批准 PRD/ADR 对齐后记录快照；必需待决策则停该子项 |
| N2 | Schema 与状态 guard | 实现 Zod Schema、精确库存守恒、fail-closed 效期判断、纯状态迁移 guard；覆盖非法值 | unit/contract tests 直接断言允许/拒绝转换和库存边界 |
| N3 | 版本规则 | 明确当前合同版本、兼容/破坏变更规则、未知版本行为；输入必须显式带版本 | 兼容说明写入回执与代码常量；不做自动迁移 |
| N4 | 定向测试与回归 | 独立包安装、build、typecheck、test discovery、docs:check、diff 与范围检查 | 保留完整命令、版本、退出码、数量、失败/修复记录 |
| N5 | 交付与 Review | 推送 `feat/retail-01`，目标 `develop/retailops`，PR 关联 #19，回读 Issue/PR/Project | 所有必需节点通过时转 REVIEW；不自动合并，不启动 #20/#24/#35 |

## 交付门槛

- 必需边界输入有正例/负例；金额和数量不使用浮点近似；未知状态、缺来源、非法状态迁移、库存不守恒拒绝。
- 过期/质量失败/信息不足不能取得可售通过；未批准的单位、货币、精度、时区和效期规则作为必填输入或列入用户决策，不设默认。
- 独立包 build/typecheck/test 从其专属 package 和 lock 工作，不依赖根 `node_modules`；测试发现不得越过包内 unit/contract 目录。
- 没有 DB/API/Agent/MCP/Runtime/宿主边界改动；静态合同/fixture 测试不声称真实运行验收。
- 每节点用总体计划 `NODE-RECEIPT-TEMPLATE.md` 对照 PRD/总体计划、Issue/Plan、节点标准三层复核。N5 通过后仅提交独立开放 PR 等待 Review/人工合并。
