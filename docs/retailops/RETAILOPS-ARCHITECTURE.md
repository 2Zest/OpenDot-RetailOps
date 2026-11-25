# RetailOps 领域扩展架构（设计草案）

基线 `0db0ba1bbf658d217f248bf29b5715bcbf09ccac`。本文件是候选设计，不是已实现说明；需用户确认业务口径及 Codex 本地核对扩展入口。

## 目标与边界

复用 OpenDot 的 Pi Durable、Goal、Handoff、MCP、审批与观测。RetailOps 新增行业语义、确定性计算、业务状态、约束、数据适配及审计。P0 只做竞品价格变化→同规格核验→促销毛利→草案→风控→审批→仿真执行回执。P1 库存调拨；P2 监测及跨端；P3 巡店图片。实际企业接口、公式、阈值、域名缺失，不默认连接真实业务系统；无审批不写外部系统，禁止 POS 改价、结算、采购合同。

## 候选工程目录（非现存路径）

```
src/retailops/
  domain/           # Zod schemas、领域类型与计算规则
  connectors/       # ERP/POS/WMS/竞品只读契约与 Fixture 实现
  policy/           # 版本化权威配置、工具分类、业务权限
  workflow/         # 领域状态、证据、草案、风控编排
  persistence/      # SQLite 领域表、迁移、事务与幂等
  agents/           # 领域角色、结构化输出、Handoff 适配
  approval/         # 业务意图与通用审批绑定、执行适配
  audit/            # 结构化回执、导出、Trace 关联
src/routes/         # 按原有路由注册约定增加入口
web/src/features/   # 按原有功能结构增加业务展示与审批摘要
tests/              # 按原仓库测试约定新增 retailops-* 用例
```

具体文件拆分、数据库注册、共享类型及 Cloud/Runner 边界需依 RETAIL-00 本地核实后定稿。不得让云端跨工程直接导入 Node 私有模块；不得重写通用 Runtime/审批表。

## 实体与权威数据

候选最小结构（正式 Schema 由 RETAIL-01 确定）：MerchandisingPlan（planId, workspaceId, SKU_ID, scope, status, revision, evidenceRefs, policyVersion）；PricingReplenishmentDraft（draftId, planId, revision, actionType, SKU_ID, typed parameters, evidenceDigest, policyVersion, ruleResults, reviewReceipt, approvalRef, executionReceipt）。附属 Evidence（source, capturedAt, sourceRevision, contentDigest, normalizedData），Policy（scope, version, effectiveAt, rules），ReviewReceipt（draftDigest, reviewer identity, ruleResults, outcome），BusinessOperation（operationId, approvalRef, idempotencyKey, state, receipt）。金额采用整数最小货币单位；数量和折算明确单位；毛利口径、叠券及安全库存公式必须先明确为仿真规则并建立边界测试，不假定企业真实规则。

## 业务状态机

Monitor → Detect → Investigate → Decide → Approval → Act。领域状态候选：detected, investigating, draft_ready, reviewing, risk_blocked, awaiting_approval, approved, executing, completed, denied, stale, uncertain, cancelled, failed。状态转换由服务端事务管理，不由 LLM 自报；重复事件使用稳定业务 ID；恢复后读持久化状态。硬性红线不能通过审批覆盖。未授权、旧政策、数据过期、草案变更一律拒绝或重新审查。uncertain 禁止盲目重试，必须查权威回执或人工对账；通用 Goal 完成与业务执行完成分别记录。

## 工具与 Agent

READ_AUTO：仅明确注册、限定范围、服务端校验的只读工具（ERP/POS/WMS/CSV/竞品）；默认拒绝未知工具，不依据名称/Prompt 判断。MCP 普通调用存在审批路径，自动读取策略须单独评估并以最小授权实现；不得扩大 Computer Use 例外。

APPROVAL_REQUIRED：模拟指导价/优惠券/调拨提交。优先评估 MCP 审批账本；普通 ProductApproval 仅 create_private_artifact。绑定 workspace、操作者、SKU、草案版本、完整参数摘要、政策版本、证据版本、到期时间；执行前重新校验风控与权限。独立业务幂等键与外部回执。

BLOCKED：直接修改 POS、结算、采购合同、跳过审批、超权限访问；不注册相关执行工具且服务端阻断。

分析 Agent 调查数据并生成候选草案；风控 Agent 使用独立只读授权并审查相同不可变草案，返回结构化审查回执。规则函数负责规格、金额、优惠、库存等强约束；模型仅解释和提出方案。风控挂起是状态而非聊天文本。冲突时输出合规分级方案；不得批准违反硬约束的动作。

## R07 与 R08

R07：巡店附件引用/归档，按模型预算选择当前图片，历史只留占位；不把设备截图临时管理直接当作通用上传归档。R08：权威政策使用版本化配置，记忆仅解释/历史经验；旧政策关联的待审批草案必须失效或重新计算。分别测试上下文预算与政策版本失效。

## 外部内容及审计

Browser 仅允许授权 HTTPS Origin、只读动作；跨域、重定向、页面状态变化、超预算时失败关闭。商品文本是数据，不作为指令；结构化提取、验证、注入样例与负向工具授权测试并行。Trace 关联 plan/draft/run/tool/approval/operation ID，避免泄漏敏感成本、凭证及不必要的原始内容。审计包含比价叠券毛利表、库存平衡、风控回执、负责人签批账本；P0 仅生成已完成范围的定价审计包，库存部分标记不适用，不伪造数据。

## 验收原则

每个 Issue 建立 Schema→Fixture→Connector/Tool→Workflow→Trace→Eval→Reviewer/Approval→Tests 的相关纵向证据。区分规则测试、仿真连接器、真实模型、容器、云端、真实手机。第一阶段不声称真实 ERP/POS/WMS 接入、企业签批或生产部署；保留原项目许可证和归属。
