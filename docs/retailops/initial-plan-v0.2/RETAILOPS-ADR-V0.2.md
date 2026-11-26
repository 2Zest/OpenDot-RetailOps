# RetailOps 架构决策记录 V0.2（待审批）

- 状态：**PROPOSED / PENDING_USER_APPROVAL**。下列决策为待批准架构提案，不在 N4 之前自动生效。
- 范围：RETAIL-00C 文档定稿；没有实施架构代码、配置或迁移。
- 固定源码调查版本：OpenDot-RetailOps `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；产品计划基线为本任务 N0 记录的 `591ced31c0557cbb14d7b4dc6197da52923e55b6`。

## ADR-001：V0 先做单店单 SKU 临期损耗闭环

- **状态**：待用户批准。
- **背景**：V0.2 场景把一店、一 SKU、一临期批次作为首条切片；公开数据调查能支持编码门店 0 的 74 个 SKU、97 天共同窗口，却不提供可识别的现实门店、批次、单位库存或成本。
- **提案**：V0 只验证单 SKU、单临期批次的可解释建议与模拟治理闭环。V1 在闭环和数据适用性验收后再扩展多 SKU、共享订单库存与补货。20–50 SKU 保持候选目标，不设为当前验收要求。
- **后果**：早期产品不承诺完整门店经营自动化；数据样本与模拟库存可以关联，但来源层不能混合。
- **拒绝/重开条件**：业务批准若改变首条切片或扩大规模，需更新 PRD、DAG 与下游计划。

## ADR-002：所有业务数据必须保留来源类别及单位语义

- **状态**：待用户批准。
- **提案**：对 `PUBLIC_HISTORICAL`、`DERIVED`、`SIMULATED`、`LIVE_DEVICE` 进行显式标记；每个派生值保存父输入、方法/模型版本、时间窗、单位及参数。当前没有 LIVE_DEVICE 集成证据。
- **依据**：RETAIL-00E-02 固定 FreshRetailNet 数据卡 revision `c374e85975c82816c495acfa904cc55ab14a47d3`。公开规范化销量/折扣/缺货字段不代表实物件数、售价、成本、批次、库存或收入；缺货观察具有需求截断；模拟价格反应不是因果证据。
- **后果**：跨来源指标不允许无明确转换与标注地直接聚合。未来真实接入必须独立审查来源、授权、单位和脱敏条件。

## ADR-003：业务规则确定性执行，Agent 只产出受限草案

- **状态**：待用户批准。
- **提案**：模型生成解释或候选方案；数量守恒、质量/保质期、授权、政策阈值、状态转换、摘要校验、幂等和最终状态判定由版本化确定性逻辑负责。独立风控只读检查，店长明确批准，执行服务仅改变仿真状态。
- **依据/边界**：Inventra 仅用于“确定性计算、提案版本校验与审批后再验证”的设计参考；未复制代码或资产。OpenDot MCP Product Approval 静态调查为受限工具授权机制，不能充当零售业务审批。MCP grant/catalog 未登记或未知工具默认拒绝；人工批准不得绕过注册、Grant 或安全政策。
- **后果**：草案绑定输入快照与政策版本；更改会使先前风险审查/批准失效。业务写入仍受独立授权及仿真环境限制。

## ADR-004：复用现有平台作为候选，不引入第二套 Agent Runtime

- **状态**：待用户批准技术方向；版本和适配需在后续 Issue 中确认。
- **提案**：优先评估现有 TypeScript/Hono/SQLite/Zod/Pi 产品结构；业务域规则与 LLM/Runtime 解耦。不在 RETAIL-00C 中修改依赖、运行时开关、数据库或代码。
- **静态源码依据**：固定 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a` 的 [Session 创建与 Runtime 选择](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L661-L748)、[产品模型配置](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L42-L113)、[Durable Adapter 的打开/恢复边界](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L180-L239)。报告记录 Node Product Durable 依赖显式开关、Host/容器授权及冻结 provider/model fingerprint；静态调查不等于运行验收。
- **职责提案**：OpenDot 产品层负责 owner/workspace/授权、输入 requestId/digest、产品 DB 状态投影和 recovery receipts；`pi-durable` 负责 Harness/Conversation/Submission/Task/checkpoint/memo 调度持久化；`pi-ai` 提供模型 API adapter。SDK 状态不是零售领域账本。
- **DeepSeek 兼容性**：固定源码接受 OpenAI Completions / Anthropic Messages API 类型；`openai-completions` 路径可静态确认调用该适配器，[product-model.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L81-L83)、[模型调用](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L276-L292)。DeepSeek 的 URL、鉴权、模型别名、工具调用、流式响应、错误与用量行为尚未真实验证。Anthropic Messages 端点也不能据 URL 声称 DeepSeek 已兼容。OAuth bridge 不可据普通 Pi 历史会话推断已打通。
- **运行门槛**：#7 安全环境当前 BLOCKED；Durable 恢复需 #16、MCP exact-call 需 #17、Handoff 需 #18 分别完成并满足 DAG。不得为本 ADR 启用 Runtime、Provider、Session 或外部效果。

## ADR-005：副作用使用摘要绑定、幂等和 uncertain 对账

- **状态**：待用户批准。
- **提案**：业务批准绑定不可变 `draft_digest + input_snapshot_id + policy_version + parameters + actor + expiry`。执行前再次验证来源、摘要、规则、业务批准、权限、质量/库存前置条件及幂等键。重复请求返回既有结果；状态不明转 `UNCERTAIN` 并先对账，禁止盲目重试。
- **依据**：Durable 调查说明 checkpoint 不是逐指令快照；外部效果与新 checkpoint/receipt 之间存在不确定窗口。Conversation、Submission、Task/checkpoint/memo 与产品数据库业务事实分属不同权威域。Handoff 现有 coordinator/recipient 分隔不能代表 RetailOps 已有独立风险角色或草案 digest 绑定。
- **不变量**：质量/过期硬规则高于商业指标；风险审查失败/缺失、审批缺失/过期、授权撤销或输入变化均不得执行。失败、取消、uncertain 均不得投影成完成。

## ADR-006：历史方案只作为存档，不覆盖 V0.2

- **状态**：待用户批准。
- **提案**：旧 `docs/retailops/RETAILOPS-ARCHITECTURE.md` 及路线图中的 V0.1 内容保留为历史；当前 V0.2 索引只描述已批准总体计划、当前架构审批状态及依赖门槛。旧比价、叠券、跨店调拨不可成为当前功能承诺。
- **后果**：路线图新增内容不可覆盖或删改旧业务原文；旧架构正文不在本 Issue 修改范围。

## 关键静态证据与运行证据隔离

| 能力 | 调查证据 | 本次架构可下结论 | 尚未验证/门槛 |
|---|---|---|---|
| Node Product Durable | 固定 SHA `e8db2b6...` 的路由、产品 DB 和 adapter 代码；`pi-durable/pi-ai/chord` 版本及职责见调查报告 | 源码中存在候选 Node Durable 路径及产品/SDK 状态边界 | 真实 Provider、恢复点、取消/重启、外部副作用 uncertain 均未作为本 PRD 验收；#7/#16 门槛 |
| MCP | 固定源码有 consent、catalog/grant、exact-call intent 与审批台账路径 | 可作为平台候选安全接口；未登记工具不能进入 grant/catalog；Product Approval 不是零售审批 | 无 RetailOps 注册工具或真实服务运行；#7/#17 门槛 |
| Handoff | 固定源码有 Node/Cloud 开关与受限 grant；Node 与 Cloud 能力不同 | 现有协作能力可供后续评估 | 无 RetailOps risk-reviewer、独立风控结论或 digest 消费门禁；#7/#18 门槛 |
| Fixture 测试 | 上游报告列出隔离 fixture/unit 结果 | 仅能证明受测 fixture/code path | 不得表述为真实 Runtime/Provider/业务效果通过 |

## 审批和修改流程

N4 用户批准后，本 ADR 才能把已接受的记录从 PROPOSED 改为 ACCEPTED。若被拒绝，按用户决策修订 PRD/架构/ADR/待决策清单与追溯矩阵，再重新提交 N4；不得自行选择未决参数或进入 N5。
