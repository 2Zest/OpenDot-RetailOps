# RetailOps 领域架构 V0.2（待业务架构审批）

- 状态：**PENDING_USER_APPROVAL**；领域合同草案，不代表实现状态。
- 基线：`develop/retailops` `591ced31c0557cbb14d7b4dc6197da52923e55b6`。
- 编号规范：内部任务一律写作 `RETAIL-XX`；GitHub 编号写作 `GitHub Issue #N`。完整映射见 [`REQUIREMENTS-TRACEABILITY-V0.2.md`](REQUIREMENTS-TRACEABILITY-V0.2.md)，不以 `#06`、`#19` 等简称内部任务。

## 1. 架构原则

1. 以单店经营者可解释、可批准的损耗决策为中心；先冻结单 SKU/单临期批次闭环。
2. 领域规则采用确定性、可版本化的合同。LLM 可总结和提出草案，不拥有绕过规则或直接写业务状态的权限。
3. 历史观测、派生、仿真与未来真实设备数据具有不同语义、权限、单位与置信边界。
4. 分析、独立风控、业务审批、执行职责分离；工具授权是系统层权限，店长批准是业务决策，两者不能互相替代。
5. 所有副作用先在隔离的仿真状态中验证；真实系统集成和执行需要独立批准、验证 Issue 与门禁。
6. 可恢复并不等于可重复执行。unknown/uncertain 必须先核对外部或仿真状态，不盲重试。
7. 项目核心是可评测、可观测的 AI/Agent 工程；零售领域是受限任务环境，不是要建设完整 POS/ERP 的目标产品。
8. 经营分析 Agent 按 observation 动态规划下一步；状态机和安全 guard 是边界机制，不能把固定顺序 workflow 描述成 Agent 规划。

## 2. 逻辑边界与职责

| 边界 | 责任 | 可写对象 | V0 约束 |
|---|---|---|---|
| 数据与来源目录 | 保存不可变输入引用、字段单位、来源层、时间窗口、转换版本 | 输入快照/派生引用 | 公开数据保留源值和声明；不补造未观察到的业务事实 |
| Agent Core / Context | 解释当前任务、维护 Observation、判断进展/缺口、动态选择已授权只读工具或停止 | 本次 Agent Run 的短期工作状态 | 每步重新评估；有预算与停止条件；不拥有批准或执行权 |
| 商品与批次领域 | SKU、单位、批次日期、质量/销售资格、单店库存量 | 仿真领域状态 | V0 范围为一个 SKU、一个临期批次 |
| 政策/规则 | 临期、质量、折扣上限、适用对象、版本与失效规则 | 版本化仿真政策 | 精确阈值、舍入、优先级待业务审批 |
| 分析与决策草案 | 整理证据并生成候选动作、假设和影响估计 | 草案草拟态 | 不拥有批准/执行能力 |
| 独立风控 | 读取输入、规则、草案，返回阻断/风险/依据 | 风控回执 | 不修改草案、不代替业务批准；需真实运行验证 |
| 业务审批 | 由被授权店长批准/拒绝冻结的摘要 | 审批记录 | 数据/策略/参数变化使审批失效 |
| 受控仿真执行 | 检查摘要、规则、授权、幂等键及前置条件，改变模拟状态 | 仿真执行记录/状态 | 不连接真实 POS、支付或采购写端 |
| 恢复与审计 | 关联 Durable/应用状态、事件、审批、执行、回执 | 恢复记录/审计账本 | Node Durable 调用路径及 uncertain 语义需 RETAIL-00B-02V（GitHub Issue #16）真实验证；不据静态调查宣称通过 |

## 3. 核心概念与状态归属

以下映射是建议领域合同。具体表结构、键、持久化与迁移留给后续获授权的 Issue。

| 概念 | 领域含义 | 主要权威状态 | 边界/限制 |
|---|---|---|---|
| Store | 单店经营上下文与时区 | 业务主数据/仿真场景 | FreshRetailNet `store_id` 是数据编码，不直接等同现实门店实体 |
| SKU | 可售商品、规格与基本单位 | 商品目录 | 现实 SKU/条码、包装换算及选择待确认 |
| Lot | 某 SKU 的批次、日期、质量与数量 | 仿真批次账 | 公开历史数据不提供目标场景可用的真实 lot/到期库存 |
| InventoryBalance | `physical_on_hand`、`unavailable_qty`、`reserved_qty`、`available_to_sell` 及更新时间 | 库存子域/模拟账本 | 三类数量互斥分区：物理在手=不可售+可售未预占+已预占；预占只能来自合格可售量；V0 单一库存池 |
| Observation | 带时间、字段和出处的外部/历史观察 | 来源目录 | 公开历史值仅按源定义解释，不转换为物理库存或金额 |
| Scenario | 仿真种子、初始状态、规则版本与可变参数 | 仿真上下文 | SIMULATED，与真实门店状态显式隔离 |
| DecisionDraft | 候选动作、依据、假设、数据快照/政策引用与摘要 | 产品草案状态 | 参数或输入改变时生成新摘要并使旧审批失效 |
| RiskReview | 独立审查结论、规则命中、时间与所审摘要 | 风控回执 | 只读审查；失败/缺失不等于通过 |
| BusinessApproval | 人类对某一不可变草案摘要的决定与授权上下文 | 业务审批账本 | 不由 MCP 工具审批或 Agent 文本替代 |
| SimulationExecution | 幂等键、受控动作、前后状态、结果/uncertain 状态 | 仿真执行账本 | 仅模拟副作用；状态不明先 reconcile |
| Checkpoint | Durable 恢复状态/执行进度 | Runtime/产品持久化各有职责 | 不等同领域事实或执行账本；粒度和边界由 RETAIL-00B-02V（GitHub Issue #16）验证 |
| Conversation / Submission / Task / Memo | 产品请求、用户输入、异步工作、摘要/记忆等产品概念 | 各自产品记录 | 不自动等于 Node Durable 的 workflow/checkpoint；关联键、事务边界待运行验证 |

### 状态所有权原则

- 产品数据库/领域账本保存决策草案、业务批准、仿真库存与执行结果等业务事实；Durable runtime 状态负责可恢复工作流进度；Conversation/Submission/Task 等承载产品交互或调度状态。它们可以通过稳定引用关联，但不应被视为同一状态副本。
- Checkpoint 是否与业务事件同事务不可由静态调用链证明；恢复后若领域账本显示动作已提交，而 workflow checkpoint 仍在动作前，必须通过幂等键/对账读取现存结果，不能再次造成副作用。
- Memo 是摘要/记忆候选，不能成为政策、授权或库存事实的权威源。

## Agent Loop、Context 与历史经验

### 动态 Agent Loop

`RetailTask → 授权与 Task Context → Observation → 进展/证据评估 → (动态只读 Tool Call | 补充信息/拒绝 | 有证据草案 | 阻塞/停止) → 新 Observation`。

控制服务负责授权、预算、状态持久化、硬规则、状态 guard 和输出 Schema 校验；模型根据当前目标和 Observation 判断“完成/继续/缺证据/失败”，再选零个或一个当前合法工具。每次调用后读取实际结果并重新规划。两种不同情景必须展示由事实与证据需求驱动、可解释的工具轨迹差异；若选择相同，需说明两情景为何需要相同证据。固定查询 A→B→C 再生成报告只是 workflow，不满足动态规划 Agent 验收。

| Loop 判断 | 动作 | 停止/失败语义 |
|---|---|---|
| 目标证据齐全且一致 | 输出带引用的草案/结论 | `READY_FOR_RISK_REVIEW`，不代表风险通过或业务批准 |
| 缺少关键事实、数据过期或冲突 | 请求补充、选择当前授权工具继续取证，或拒绝 | 缺证据不输出肯定业务建议；列明缺口与影响 |
| 存在安全且必要的只读查询 | 按 Observation 动态选择最小必要工具并记选择理由 | 工具错误是错误观察，不作为业务事实；仅可在批准预算内按安全规则重试 |
| 硬规则、授权或策略检查失败 | 停止，不通过换工具/Provider 规避 | `BLOCKED`/`REJECTED`；不得提交可执行草案 |
| 取消、超时、预算耗尽 | 结束循环并保存最后状态 | 未发生效果可记 `CANCELLED`/`TIMED_OUT`；可能已有副作用则进入 `UNCERTAIN` 对账 |
| 结构化输出无效 | 在批准预算内进行有限格式修复 | 仍无效则 `FAILED`，不提交草案 |

分析 Agent 输出需为结构化草案或明确 abstention/refusal，并含任务/运行引用、结论或候选动作、证据/来源/时效、假设与不确定性、证据缺口、硬规则/风控状态及停止原因。具体字段 Schema 留给 RETAIL-07/下游接口任务。预算至少有轮数、工具调用数、LLM token、总耗时与安全重试上限；具体值由 RETAIL-06 N0 候选冻结，本 ADR 不填默认值。未登记工具默认拒绝，分析 Agent 不执行副作用。Agent 角色保持为经营分析与独立风控；预测/折扣计算、库存规则、审批服务和运行调度作为确定性模块/服务，不因追求 Agent 数量而智能体化。

### 上下文分层

| 层 | 内容与生命周期 | 权威边界 |
|---|---|---|
| System Context | 角色/系统指令、数据边界、工具与授权规则、输出合同；按受信任版本发布 | 不接受用户、商品描述、检索文档或模型输出改写安全策略 |
| Task Context | 目标、门店/SKU/批次范围、数据快照和政策版本、停止条件、actor/grant 摘要；每次 Task/Run 绑定不可变引用 | 当前库存/政策/审批从权威服务或账本复查，不从聊天记忆推断 |
| Working Memory | 当前 Run 的 Observation、Tool Result 引用、已验证证据、待补项、短期计划 | 有时效和 token 上限；摘要保留 source/Tool Call ID 与结果 digest；不是领域账本 |
| 历史经验 | 带版本、来源、适用范围、时间和不确定性的历史摘要 | 只作为检索线索；不授予权限、不作批准、不覆盖库存或政策 |

工具结果按 schema/字段白名单、相关性与大小预算裁剪。可摘要/分块，但保留来源标识、时间、单位、截断标记、摘要 digest 与原结果定位；不能把空响应、过期结果或摘要改写成确定事实。Token 紧张时先裁掉低相关历史经验，不能裁掉 System Context、安全策略、当前目标、授权范围、来源引用或未解决证据缺口。预算值在 RETAIL-06 N0 确认并随 Trace 记录。

非结构化经营知识检索是候选能力。只可评估现有授权只读工具/来源范围能否提供版本化引用；本任务不新增 RAG 服务、向量库、检索 Agent 或 DAG 边。场景计划已将复杂 RAG/Memory/Context 优化放到后续评估；如需独立子系统须另提变更提案。

## 最小 Agent Eval 与端到端 Trace

RETAIL-06 必须保留原契约的真实模型双情景验收：情景输入真实模型、检查动态工具选择与合理的轨迹差异、输出带来源的草案；关键证据缺失时须拒绝/请求补充。这里的两情景是行为验收，不是多策略经营对照实验。完整多场景、多策略收益/损耗/缺货对照仍由 RETAIL-19 执行。

一般效果指标的候选集合：任务成功/正确拒绝率、工具选择/参数正确率、工具轨迹对场景的区分性、证据覆盖率、无依据结论率、结构化输出有效率、token、延迟与成本。其目标值尚未批准，须由 RETAIL-06 N0 或相应下游任务冻结。

**零容忍安全门槛（不可作为一般指标调参）**：任意一次硬规则违规、未授权写入、审批绕过或重复业务副作用，即安全验收失败并将任务阻断；不能以总体成功率、平均分、收益或成本折抵，也不能设置大于零的容忍值。零次观测只是必要条件，不单独证明系统安全或验收通过。不得把这些门槛表述为当前已测为零。

RETAIL-19（GitHub Issue #39）的经营效果对照应报告负例和数据/仿真局限；它与 RETAIL-06（GitHub Issue #27）的 Agent 行为评测分离。

| 记录对象 | 关联关系与至少可观测信息 |
|---|---|
| Retail Task | 稳定 `task_id`、目标/范围摘要、输入快照和 policy 版本、最终状态 |
| Agent Run | `run_id` → `task_id`、attempt、模型配置 fingerprint、起止时间、预算和 run 状态 |
| LLM Call | `llm_call_id` → `run_id`、父步骤、模型/参数版本、输入/输出摘要、token、延迟、finish/error 状态；不存密钥 |
| Tool Call | `tool_call_id` → `run_id`/`llm_call_id`、工具/Schema/grant/catalog 版本、参数 digest、来源结果引用、延迟和结果状态 |
| Handoff | `handoff_id` → task/run、来源/接收角色与 Session 引用、grant revision、冻结 draft digest、结构化回执 |
| Approval | `approval_id` → task/draft digest、actor、批准/拒绝/撤销/过期、policy 版本和有效期 |
| Execution Receipt | `receipt_id` → task/draft/approval、幂等键、前后状态引用、完成/失败/uncertain 与 reconciliation 状态 |

每条记录应带 parent/correlation ID、UTC 时间、版本/digest 与 outcome，保证可按 Retail Task 追到 Agent Run 和下游决策证据。实现字段与存储由 RETAIL-07/09/11/12/15/19 各自 Issue 定义，本文件不增加表、API 或 DAG 依赖。

## 4. 库存与事件合同

### V0 可冻结的基础不变量

- `physical_on_hand` 表示仍在店内的实物量。将其拆成互斥的三类：`unavailable_qty`（质量/过期隔离等不可售）、`available_to_sell`（合格且未预占）和 `reserved_qty`（合格但已被订单占用）。因此 `physical_on_hand = unavailable_qty + available_to_sell + reserved_qty`，三者不可重叠；`sellable_on_hand = physical_on_hand - unavailable_qty`，`available_to_sell = sellable_on_hand - reserved_qty`。预占不是额外库存，不能在不可售量中再次计算。要求各量非负且等式守恒。若保留旧字段 `on_hand`，必须明确映射为 `physical_on_hand`，不可再从已经扣除不可售量的可售量中二次扣减。
- 过期、质量不合格或信息不足的批次不可出售；价格折让不能覆盖食品安全硬规则。
- 盘点差异只能通过带来源、操作者、原因与时间的显式调整事件处理，不能静默覆盖。
- 每个业务事件具有唯一标识及场景/批次关联；重复投递不得重复扣减或增加库存。

### 事件语义（目标合同；具体 V1 功能不在本任务实施）

| 事件 | `physical_on_hand` | `unavailable_qty` | `reserved_qty` | 幂等/校验 |
|---|---:|---:|---:|---|
| Receive | 增加验收量 | 按检验结果记入不合格量或 0 | 不变 | 仅合格部分可售；收货事件幂等 |
| POS sale | 合格可售量扣减一次 | 不变 | 不变 | 仅可售未预占量可出售；销售 event ID 唯一 |
| Online reserve | 不变 | 不变 | 从 `available_to_sell` 转入 `reserved_qty` | 仅 V1；只预占合格可售量，总量不变 |
| Release/cancel | 不变 | 不变 | 本单 `reserved_qty` 转回 `available_to_sell` | 取消只释放该 reservation 一次，不增加 physical stock |
| Complete order | 减少完成量一次 | 不变 | 本单 `reserved_qty` 同量减少 | 仅 V1；完成时物理量和预占同量减少，不再额外扣 `available_to_sell` |
| Quality/expiry block | 不变 | 从可售或预占分类转入 unavailable | 若涉及预占，先解除/失效 reservation 并阻断完成 | 只是分类变化，不是 physical 出库；需避免同一件同时留在 reserved 与 unavailable |
| Disposal/spoilage removal | 实际移出量扣减一次 | 同步扣减不可售子集量 | 不重复释放或转为可售 | 事件唯一；不可先因标记不可售扣 physical、报废时再扣一次 |
| Count adjustment | 按审批差异调整 | 复核数量归属 | 复核受影响预占 | 带审计原因，不静默覆盖 |

单店线上线下共享库存目标属于 V1。V0 首条损耗治理切片可以用模拟初始库存和一个批次演示，但不得将其描述成已经实现线上订单预占。

## 5. 决策草案与审批状态机

候选草案流程：`DRAFTED → RISK_REVIEW → AWAITING_MANAGER → APPROVED → PRECHECK → EXECUTING → COMPLETED`；分支终态/挂起包括 `RISK_REJECTED`、`RISK_FAILED`、`RISK_TIMEOUT`、`CANCELLED`、`APPROVAL_REJECTED`、`APPROVAL_REVOKED`、`APPROVAL_EXPIRED`、`STALE`、`FAILED`、`UNCERTAIN`。

| 当前状态 | 事件/校验 | 下一状态 | 必须拒绝的转换 |
|---|---|---|---|
| DRAFTED | digest 固定后开始审查 | RISK_REVIEW | digest 缺失/输入快照不可追溯 |
| RISK_REVIEW | 审查通过且同一 digest | AWAITING_MANAGER | 审查拒绝、超时、异常、取消、审查 digest 不符时不得流向审批 |
| AWAITING_MANAGER | 有权店长对同一未过期 digest 作决定 | APPROVED 或 APPROVAL_REJECTED | Agent 自批、MCP 调用批准代替业务批准、参数/策略变化后沿用旧审查 |
| APPROVED | 执行前重查 digest、审批、Grant、政策、库存和质量 | PRECHECK → EXECUTING | 批准撤销/过期、草案变 STALE、硬规则失败时执行 |
| PRECHECK / EXECUTING | 有对应运行回执 | COMPLETED / FAILED | 单靠模型文本或状态重跑宣称完成 |
| PRECHECK / EXECUTING | 取消/超时且副作用是否发生不可确认 | UNCERTAIN | 直接标 FAILED、COMPLETED 或盲目重试 |
| UNCERTAIN | reconciliation 读取幂等键及账本/receipt 证据 | COMPLETED / FAILED / 继续 BLOCKED | 无对账证据时清除 uncertain 或开始新执行 |

- LLM 风控 Agent 识别语义/证据风险、解释建议并可拒绝；确定性规则负责质量、授权、数量、金额边界、摘要和状态等可计算硬限制。LLM 通过不得覆盖硬规则失败，规则通过也不代表语义审查已完成。
- 风控拒绝、异常、取消、超时或缺失/摘要不一致的审查回执均 fail-closed，不进入 `AWAITING_MANAGER`。店长拒绝、撤销或批准过期不得流入执行。
- 批准绑定 `draft_digest + input_snapshot_id + policy_version + parameters + actor + expiry`。任何影响结果的变更使审批 `STALE`。
- 执行服务在副作用前再次验证签名/批准、权限、质量/库存不变量、策略版本与幂等键。
- 结果成功需仿真账本及回执核对；失败需记录失败原因；`UNCERTAIN` 进入挂起对账，禁止自动当成功或盲目重试。
- 执行前发现取消、批准撤销、草案/策略失效即阻断；执行期间若无法确认效果是否发生则保留 `UNCERTAIN` 并对账。不得把 failed/uncertain 投影成 Goal 完成或触发下一 occurrence；只有核对证据才能清为 `COMPLETED` 或 `FAILED`。
- OpenDot 已调查到的 Product Approval 对象适用范围与 MCP 工具精确调用授权不能被扩写成 RetailOps 业务审批；未知或未登记工具必须默认拒绝。相关真实运行能力由 RETAIL-00B-03V（GitHub Issue #17）、RETAIL-00B-04V（GitHub Issue #18）、RETAIL-00B-02V（GitHub Issue #16）等门槛分别验证。

## 6. 数据与计算路径

`PUBLIC_HISTORICAL → 规范化引用/字段检查 → DERIVED 特征 → SIMULATED 场景与动作 → SIMULATED 结果`。每步记录源样本、版本、时间窗、单位、变换和参数。LIVE_DEVICE 当前不可用作已接入输入。

- `sale_amount` 等公开字段按数据集原始含义处理；不能无证据换算为件数或金额。
- 缺货期间销售受截断，潜在需求只能作为带方法和不确定性的派生估计。
- 折价响应属于仿真函数或待验证假设，不宣称真实价格因果。
- 固定种子与参数便于复现，但仿真复现不代表现实预测准确。

## 7. 部署/运行时边界与门槛

- 既有 OpenDot TypeScript/Hono/SQLite/Zod/Pi Runtime 是候选技术栈，最终采用策略列入 ADR，待审批。
- Durable 调查显示 Node 产品入口与 SDK 有明确职责层次，但未进行真实 Node Durable 恢复验收。Checkpoint 粒度、副作用 uncertain 与状态对账必须由 RETAIL-00B-02V（GitHub Issue #16）验证。
- MCP 调查确认通用调用/授权机制及限制，不代表已注册 RetailOps 工具；任何新工具需独立审查和授权。真实 exact-call 授权由 RETAIL-00B-03V（GitHub Issue #17）验证。
- Handoff 调查不证明新增风控角色已具备运行时角色隔离。RETAIL-00F（GitHub Issue #7）安全环境目前 BLOCKED；不得解锁依赖该环境的 RETAIL-00B-04V（GitHub Issue #18）或其他真实验证。
- 容器/模型/网络/会话/状态数据须使用隔离的安全实例；不得触碰 Home 实例、改变安全策略或混用生产凭据。

## 8. 版本范围

- V0：单店、单 SKU、单临期批次；数据谱系、策略、草案、风控、人工批准、模拟执行、幂等恢复与反馈合同。该文档只定义目标，未实现上述闭环。
- V1：根据覆盖证据逐步扩展多 SKU、多批次、线上线下共享库存、补货与经营异常分析；需要新的依赖验收和业务审批。
- V0.1 旧架构文档保持历史，不由本文覆盖；不得将竞品比价、叠券、跨店调拨混入当前产品架构。

## 9. 关联证据

详细产品行为见 `RETAILOPS-PRD-V0.2.md`；决策及未决项见 `RETAILOPS-ADR-V0.2.md`、`DECISIONS-PENDING.md`；需求来源映射见 `REQUIREMENTS-TRACEABILITY-V0.2.md`。审批材料逐文件记录 SHA-256。本文未运行应用或 Runtime。
