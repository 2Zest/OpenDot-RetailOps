# RetailOps 架构决策记录 V0.2（原则已批准）

- 状态：**ACCEPTED（原则）**。用户于 2026-11-26 批准候选提交 `072ca30982792072bf6641eac916cbb05a5fb062` 中的八项业务与架构原则。各 ADR 记录原则层批准；具体参数、版本、Schema 和运行能力仍按待决策清单延期至责任 Issue/Plan 的指定节点冻结或验证，不在本任务补默认值。
- 范围：RETAIL-00C 文档定稿；没有实施架构代码、配置或迁移。
- 固定源码调查版本：OpenDot-RetailOps `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；产品计划基线为本任务 N0 记录的 `591ced31c0557cbb14d7b4dc6197da52923e55b6`。
- 编号规范：内部任务一律写作 `RETAIL-XX`；GitHub 编号写作 `GitHub Issue #N`。完整映射见 [`REQUIREMENTS-TRACEABILITY-V0.2.md`](REQUIREMENTS-TRACEABILITY-V0.2.md)，不以 `#06`、`#19` 等简称内部任务。

## ADR-001：V0 先做单店单 SKU 临期损耗闭环

- **状态**：ACCEPTED（原则；2026-11-26）。具体门店、SKU、单位和目标参数延期至责任 Issue/Plan 冻结。
- **背景**：V0.2 场景把一店、一 SKU、一临期批次作为首条切片；公开数据调查能支持编码门店 0 的 74 个 SKU、97 天共同窗口，却不提供可识别的现实门店、批次、单位库存或成本。
- **提案**：V0 只验证单 SKU、单临期批次的可解释建议与模拟治理闭环。V1 在闭环和数据适用性验收后再扩展多 SKU、共享订单库存与补货。20–50 SKU 保持候选目标，不设为当前验收要求。
- **后果**：早期产品不承诺完整门店经营自动化；数据样本与模拟库存可以关联，但来源层不能混合。
- **拒绝/重开条件**：业务批准若改变首条切片或扩大规模，需更新 PRD、DAG 与下游计划。

## ADR-002：所有业务数据必须保留来源类别及单位语义

- **状态**：ACCEPTED（原则；2026-11-26）。真实数据接入授权及字段口径仍须按责任 Issue 审查。
- **提案**：对 `PUBLIC_HISTORICAL`、`DERIVED`、`SIMULATED`、`LIVE_DEVICE` 进行显式标记；每个派生值保存父输入、方法/模型版本、时间窗、单位及参数。当前没有 LIVE_DEVICE 集成证据。
- **依据**：RETAIL-00E-02 固定 FreshRetailNet 数据卡 revision `c374e85975c82816c495acfa904cc55ab14a47d3`。公开规范化销量/折扣/缺货字段不代表实物件数、售价、成本、批次、库存或收入；缺货观察具有需求截断；模拟价格反应不是因果证据。
- **后果**：跨来源指标不允许无明确转换与标注地直接聚合。未来真实接入必须独立审查来源、授权、单位和脱敏条件。

## ADR-003：业务规则确定性执行，Agent 只产出受限草案

- **状态**：ACCEPTED（原则；2026-11-26）。确定性硬规则及授权边界不得放宽；阈值和实现仍留给对应任务。
- **提案**：模型生成解释或候选方案；数量守恒、质量/保质期、授权、政策阈值、状态转换、摘要校验、幂等和最终状态判定由版本化确定性逻辑负责。独立风控只读检查，店长明确批准，执行服务仅改变仿真状态。
- **风控分工**：风控 Agent 的 LLM 用于语义风险分析、证据缺口识别和风险理由；确定性代码负责食品安全/授权/digest/库存/数值边界等硬约束。LLM 风险判断通过不能覆盖硬规则失败；硬规则通过也不等于 LLM 语义审查完成。普通确定性算法与业务服务不应为了增加 Agent 数量被包装为 Agent。
- **依据/边界**：Inventra 仅用于“确定性计算、提案版本校验与审批后再验证”的设计参考；未复制代码或资产。OpenDot MCP Product Approval 静态调查为受限工具授权机制，不能充当零售业务审批。MCP grant/catalog 未登记或未知工具默认拒绝；人工批准不得绕过注册、Grant 或安全政策。
- **后果**：草案绑定输入快照与政策版本；更改会使先前风险审查/批准失效。业务写入仍受独立授权及仿真环境限制。

## ADR-004：复用现有平台作为候选，不引入第二套 Agent Runtime

- **状态**：ACCEPTED（平台复用方向；2026-11-26）。依赖版本、Provider 适配与运行能力由后续责任 Issue 核验；静态调查不等于真实验收。
- **提案**：优先评估现有 TypeScript/Hono/SQLite/Zod/Pi 产品结构；业务域规则与 LLM/Runtime 解耦。不在 RETAIL-00C 中修改依赖、运行时开关、数据库或代码。
- **静态源码依据**：固定 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a` 的 [Session 创建与 Runtime 选择](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L661-L748)、[产品模型配置](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L42-L113)、[Durable Adapter 的打开/恢复边界](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L180-L239)。报告记录 Node Product Durable 依赖显式开关、Host/容器授权及冻结 provider/model fingerprint；静态调查不等于运行验收。
- **职责提案**：OpenDot 产品层负责 owner/workspace/授权、输入 requestId/digest、产品 DB 状态投影和 recovery receipts；`pi-durable` 负责 Harness/Conversation/Submission/Task/checkpoint/memo 调度持久化；`pi-ai` 提供模型 API adapter。SDK 状态不是零售领域账本。
- **DeepSeek 兼容性**：固定源码接受 OpenAI Completions / Anthropic Messages API 类型；`openai-completions` 路径可静态确认调用该适配器，[product-model.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L81-L83)、[模型调用](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L276-L292)。DeepSeek 的 URL、鉴权、模型别名、工具调用、流式响应、错误与用量行为尚未真实验证。Anthropic Messages 端点也不能据 URL 声称 DeepSeek 已兼容。OAuth bridge 不可据普通 Pi 历史会话推断已打通。
- **运行门槛**：RETAIL-00F（GitHub Issue #7）安全环境当前 BLOCKED；Durable 恢复需 RETAIL-00B-02V（GitHub Issue #16）、MCP exact-call 需 RETAIL-00B-03V（GitHub Issue #17）、Handoff 需 RETAIL-00B-04V（GitHub Issue #18）分别完成并满足 DAG。不得为本 ADR 启用 Runtime、Provider、Session 或外部效果。

## ADR-005：副作用使用摘要绑定、幂等和 uncertain 对账

- **状态**：ACCEPTED（原则；2026-11-26）。摘要绑定字段和幂等/对账实现仍由对应 Issue/Plan 冻结与验收。
- **提案**：业务批准绑定不可变 `draft_digest + input_snapshot_id + policy_version + parameters + actor + expiry`。执行前再次验证来源、摘要、规则、业务批准、权限、质量/库存前置条件及幂等键。重复请求返回既有结果；状态不明转 `UNCERTAIN` 并先对账，禁止盲目重试。
- **依据**：Durable 调查说明 checkpoint 不是逐指令快照；外部效果与新 checkpoint/receipt 之间存在不确定窗口。Conversation、Submission、Task/checkpoint/memo 与产品数据库业务事实分属不同权威域。Handoff 现有 coordinator/recipient 分隔不能代表 RetailOps 已有独立风险角色或草案 digest 绑定。
- **不变量**：质量/过期硬规则高于商业指标；风险审查失败/缺失、审批缺失/过期、授权撤销或输入变化均不得执行。失败、取消、uncertain 均不得投影成完成。

## ADR-006：历史方案只作为存档，不覆盖 V0.2

- **状态**：ACCEPTED（原则；2026-11-26）。历史文档保持存档语义，不作为当前实现承诺。
- **提案**：旧 `docs/retailops/RETAILOPS-ARCHITECTURE.md` 及路线图中的 V0.1 内容保留为历史；当前 V0.2 索引只描述已批准总体计划、当前架构审批状态及依赖门槛。旧比价、叠券、跨店调拨不可成为当前功能承诺。
- **后果**：路线图新增内容不可覆盖或删改旧业务原文；旧架构正文不在本 Issue 修改范围。

## ADR-007：分析 Agent 采用有界动态 Tool-use Loop，而非固定工作流

- **状态**：ACCEPTED（原则；2026-11-26）；保持 RETAIL-06（GitHub Issue #27）已有验收，不改 Issue 或 DAG。预算数值延期至责任 Issue 的指定节点冻结。
- **背景/已有要求**：RETAIL-06（GitHub Issue #27）要求真实模型生成有来源草案、按场景动态选工具、两个不同情景产生可解释工具路径差异、证据不足时拒绝，且不能以固定顺序冒充动态规划。
- **提案**：运行时提供可观察的 `Task → Observation → progress/evidence judgment → authorized tool or abstain/stop → Observation` 循环。每一步模型基于当前 Observation 决定已完成、继续、缺证据、失败或停止；控制层只强制授权、预算、硬规则、状态转换及 Schema，不规定固定查询脚本。工具只从当前登记且已授权的只读集合中动态选择。
- **预算/失败边界**：设置轮次、工具次数、token、总时限与安全重试预算；具体数值由 RETAIL-06 N0 审核配置，不在 N4 填默认值。工具错误/空响应不是证据；授权失败 fail-closed；分析 Agent 无写副作用权限；超时/取消若效果不明则 `UNCERTAIN`。
- **验收与边界**：RETAIL-06 两情景真实模型行为是最小 Agent 评测要求；RETAIL-19（GitHub Issue #39）仍负责完整多场景经营对照。静态计划、fixture、预先写死的工具轨迹不能冒充真实 Agent 行为。

## ADR-008：Context 分层，Memory 不作为业务事实源

- **状态**：ACCEPTED（原则；2026-11-26）；不新建检索系统或改变 DAG。具体 Token 预算和裁剪参数延期至责任 Issue 冻结。
- **提案**：分离 System Context（可信规则/工具边界）、Task Context（当前任务和冻结快照）、Working Memory（本次 Run 中的 Observation 与证据引用）、历史经验（带来源/版本/时效的检索线索）。工具返回需按 schema 和 token 预算裁剪/摘要并保留原始定位、source/Tool Call ID、时间、单位和截断标记。
- **约束**：Memory/摘要/检索结果不可替代库存、政策、授权、草案审批等权威服务。已有场景把复杂 RAG/Memory 优化列作以后候选；本 ADR 不引入独立 RAG、向量数据库、额外 Agent 或工具。超出已授权只读能力时另提范围变更。

## ADR-009：行为 Eval 留在 RETAIL-06 最小验收，完整经营对照由 RETAIL-19 执行

- **状态**：ACCEPTED（原则；2026-11-26）；不改任何下游验收标准。普通指标目标值延期；零容忍安全门槛不可放宽。
- **提案**：RETAIL-06（GitHub Issue #27）的两个不同场景真实模型调用必须保留，核对动态工具选择、场景驱动的轨迹差异、来源证据、缺证据拒绝和结构化输出；其目的是 Agent 行为可证伪，不宣称业务 uplift。
- **一般效果指标候选**：任务成功/正确拒绝率、工具选择和参数正确率、场景轨迹区分性、证据覆盖、无依据结论、结构化输出、token、延迟、成本。普通指标目标值待批准或下游冻结，不表示已有测量。
- **不可权衡的零容忍安全门槛**：任何硬规则违规、未授权写入、审批绕过或重复业务副作用均直接导致安全验收失败并阻断；不得调宽阈值、按平均分折抵或以业务收益豁免。零次观测是必要条件，不足以单独证明安全通过。这些项目不是普通效果指标。
- **分工**：RETAIL-19（GitHub Issue #39）固定数据/seed/模型/策略并执行完整多场景算法与 Agent 对照，报告原始指标、负例和仿真限制；不能把其套件挪入 RETAIL-06，也不能削弱 RETAIL-06 的真实模型双情景验收。

## ADR-010：Trace 从 Retail Task 贯通到副作用回执

- **状态**：ACCEPTED（原则；2026-11-26）；字段/存储实现留给现有 Issue，不在此新增 Schema/API。
- **提案**：关联 `Retail Task → Agent Run → LLM Call → Tool Call → Handoff → Approval → Execution Receipt`，每条记录含 parent/correlation IDs、版本/digest、时间、输入/输出摘要、调用预算和 outcome。保存 evidence/source 引用，不记录 secret。
- **范围对齐**：草案 revision/evidence digest 属于 RETAIL-07（GitHub Issue #26）；approval 身份与撤销属于 RETAIL-09（GitHub Issue #29）；Durable 恢复关联属于 RETAIL-11（GitHub Issue #31）；反馈指标属于 RETAIL-12（GitHub Issue #32）；occurrence/停止恢复属于 RETAIL-15（GitHub Issue #38）；完整聚合分析属于 RETAIL-19（GitHub Issue #39）。此 ADR 不增加数据库字段/API、业务范围或 DAG 边。

## ADR-011：拆分物理在手、不可售、预占与可售口径

- **状态**：ACCEPTED（库存语义原则；2026-11-26）；为 PRD 领域合同，不指定数据库 Schema。单位、事件持久化和订单实现延期至责任 Issue。
- **提案**：`physical_on_hand` 含店内所有实物，且被互斥划分为 `unavailable_qty`（不可售）、`available_to_sell`（合格可售未预占）和 `reserved_qty`（合格但已预占），满足 `physical_on_hand = unavailable_qty + available_to_sell + reserved_qty`。预占只能从 `available_to_sell` 转入 `reserved_qty`；取消反向转移；完成订单时 `physical_on_hand` 与 `reserved_qty` 同量扣减，不能再扣一次 `available_to_sell`。过期/质量隔离是类别转移而非出库，实物移除才扣 `physical_on_hand`。任何实物不得同时计入 unavailable 和 reserved。
- **边界**：该语义符合当前单店守恒方向；数值单位、盘点差异、事件持久化和订单功能由 RETAIL-01/03/18C 及其既有依赖确定，不在本 Issue 实施。

## 关键静态证据与运行证据隔离

| 能力 | 调查证据 | 本次架构可下结论 | 尚未验证/门槛 |
|---|---|---|---|
| Node Product Durable | 固定 SHA `e8db2b6...` 的路由、产品 DB 和 adapter 代码；`pi-durable/pi-ai/chord` 版本及职责见调查报告 | 源码中存在候选 Node Durable 路径及产品/SDK 状态边界 | 真实 Provider、恢复点、取消/重启、外部副作用 uncertain 均未作为本 PRD 验收；RETAIL-00F（GitHub Issue #7）与 RETAIL-00B-02V（GitHub Issue #16）门槛 |
| MCP | 固定源码有 consent、catalog/grant、exact-call intent 与审批台账路径 | 可作为平台候选安全接口；未登记工具不能进入 grant/catalog；Product Approval 不是零售审批 | 无 RetailOps 注册工具或真实服务运行；RETAIL-00F（GitHub Issue #7）与 RETAIL-00B-03V（GitHub Issue #17）门槛 |
| Handoff | 固定源码有 Node/Cloud 开关与受限 grant；Node 与 Cloud 能力不同 | 现有协作能力可供后续评估 | 无 RetailOps risk-reviewer、独立风控结论或 digest 消费门禁；RETAIL-00F（GitHub Issue #7）与 RETAIL-00B-04V（GitHub Issue #18）门槛 |
| Fixture 测试 | 上游报告列出隔离 fixture/unit 结果 | 仅能证明受测 fixture/code path | 不得表述为真实 Runtime/Provider/业务效果通过 |

## 审批和修改流程

用户已按候选提交 `072ca30982792072bf6641eac916cbb05a5fb062` 批准上述原则，故原则状态记录为 ACCEPTED。D01–D16 的具体值仍由对应责任 Issue/Plan 在指定节点依据证据冻结；不得自行补默认值。N5 仅执行本 Plan 规定的文档、差异和语义检查；Runtime、Provider、Durable、MCP、Handoff 与真实业务效果仍须通过各自安全门槛和下游验收。
