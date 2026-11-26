# RetailOps V0.2 需求追溯矩阵（已批准架构基线）

状态：**APPROVED（架构原则）**。用户于 2026-11-26 批准候选版本 `072ca30982792072bf6641eac916cbb05a5fb062` 中的八项业务与架构原则。矩阵追踪总体计划/场景和五项调查证据到已批准的 PRD/架构及后续责任 Issue；不代表实现完成。详细需求 ID 见 `RETAILOPS-PRD-V0.2.md`。

### 编号规范与 DAG 交叉映射

`RETAIL-XX` 是 `dependency-graph.json` 中的内部任务 ID；GitHub Issue 号只写作 `GitHub Issue #N`。正文不使用 `#06`、`#19` 等形式简称内部任务。以下映射按已批准 DAG 核对；例如内部任务 `RETAIL-06` 对应 GitHub Issue #27，而 GitHub Issue #19 对应内部任务 `RETAIL-01`。

| 内部任务 ID | GitHub Issue |
|---|---:|
| RETAIL-00A-01 | #6 |
| RETAIL-00F | #7 |
| RETAIL-00B-01-R2 | #8 |
| RETAIL-00B-02 | #9 |
| RETAIL-00B-03 | #10 |
| RETAIL-00B-04H | #11 |
| RETAIL-00E-01 | #12 |
| RETAIL-00E-02 | #13 |
| RETAIL-00C | #14 |
| RETAIL-00D | #15 |
| RETAIL-00B-02V | #16 |
| RETAIL-00B-03V | #17 |
| RETAIL-00B-04V | #18 |
| RETAIL-01 | #19 |
| RETAIL-01P | #20 |
| RETAIL-02 | #21 |
| RETAIL-03 | #22 |
| RETAIL-05F | #23 |
| RETAIL-05P | #24 |
| RETAIL-04 | #25 |
| RETAIL-07 | #26 |
| RETAIL-06 | #27 |
| RETAIL-08 | #28 |
| RETAIL-09 | #29 |
| RETAIL-10 | #30 |
| RETAIL-11 | #31 |
| RETAIL-12 | #32 |
| RETAIL-03M | #33 |
| RETAIL-18C | #34 |
| RETAIL-13A | #35 |
| RETAIL-13B | #36 |
| RETAIL-14 | #37 |
| RETAIL-15 | #38 |
| RETAIL-19 | #39 |
| RETAIL-20A | #40 |
| RETAIL-20 | #41 |
| RETAIL-21 | #42 |

本文件中的任务引用统一使用内部 ID；若需指向 GitHub 页面，则同时写全任务 ID 与显式 GitHub Issue 号，避免把内部编号误作 Issue number。

| 需求 | 来源 | PRD / 架构位置 | 依赖证据或候选任务 | 验收边界/状态 |
|---|---|---|---|---|
| 项目目标：AI/Agent 工程能力 | 用户已批准总体方向；场景 §1、6–8 | PRD §1；架构 §1 | RETAIL-06/07/08/11/15/19 | 单店零售为受限工程场景，不建设完整传统零售管理系统；能力必须真实证据化 |
| PRD-R01 单店、V0 一个 SKU | 总体计划 §2、场景 §1–2 | PRD §1–2；架构 §1–3 | RETAIL-00C（GitHub Issue #14）本次定稿；后续 RETAIL-01、RETAIL-03 | 单店/单 SKU V0 原则已获 N4 批准；具体门店/SKU 延期至责任 Issue；不代表已建商品/库存功能 |
| PRD-R02 SKU、批次、质量与到期硬规则 | 场景 §2；00E-01 单店模型 | PRD §4；架构 §3–4 | `../investigation/RETAIL-00E-01.md`；后续 RETAIL-01、03 | 单位、字段和阈值待决策；过期/质量拦截为目标硬约束 |
| PRD-R03 库存守恒与共享口径 | 场景 §2；00E-01 业务模型案例 | PRD §4；架构 §3–4；ADR-011 | 后续 RETAIL-01、03、18C | 三类互斥分区守恒；预占只从可售转入，完成时物理与预占同量扣减；线上共享库存属 V1 |
| PRD-R04 收货、POS、订单、损耗、盘点事件 | 场景 §2；00E-01 调查 | PRD §4；架构 §4 | 后续 RETAIL-01、03、18C | 事件语义遵循已批准架构原则；具体字段/参数及订单预占由责任 Issue 冻结，非本任务/V0 实现承诺 |
| PRD-R05 来源分层与不可混算 | 总体计划 §2–3；场景 §3；00E-02 | PRD §5；架构 §6；ADR-002 | `../investigation/RETAIL-00E-02.md` 固定 FreshRetailNet revision；后续 RETAIL-02 | 历史/派生/模拟分开；无 LIVE_DEVICE 接入证据 |
| PRD-R06 解释与不确定性 | 总体计划 §2；场景 §3；00E-02 缺货截断限制 | PRD §4–6；架构 §6 | 00E-02；后续 RETAIL-05F、05P | 价格响应是仿真假设/派生估计，不是因果结论 |
| PRD-R07 分析、风控、审批和执行分离 | 场景 §2；00B-03、00B-04H | PRD §1、3、7；架构 §2、5；ADR-003 | `../investigation/RETAIL-00B-03.md`、`../investigation/RETAIL-00B-04H.md`；RETAIL-00B-03V（GitHub Issue #17）/RETAIL-00B-04V（GitHub Issue #18）运行门槛；RETAIL-06/08/09 | MCP 工具审批不替代业务批准；未知工具默认拒绝；当前无 RetailOps risk reviewer |
| PRD-R08 冻结摘要/重新校验 | 场景审批边界；00E-01 设计参考；00B-03 exact-call | PRD §4、7；架构 §5；ADR-003/005 | `../investigation/RETAIL-00E-01.md`、`../investigation/RETAIL-00B-03.md`；后续 RETAIL-07/09 | 摘要绑定参数和审批为目标合同，未实现 |
| PRD-R09 幂等、恢复与 uncertain | 总体计划 G3；00B-02 Durable；00B-03 MCP；00B-04H | PRD §4、7、9；架构 §3、5；ADR-005 | `../investigation/RETAIL-00B-02.md`、`../investigation/RETAIL-00B-03.md`、`../investigation/RETAIL-00B-04H.md`；RETAIL-00B-02V（GitHub Issue #16）/RETAIL-00B-03V（GitHub Issue #17）/RETAIL-00B-04V（GitHub Issue #18） | 静态/fixture 不能证明真实恢复；RETAIL-00F（GitHub Issue #7）BLOCKED 不解除 |
| PRD-R10 审计、指标与反馈 | 总体计划 §2、G4–G5；场景 §1 | PRD §6–7；架构 §2、6 | 后续 RETAIL-12、19、21 | 指标公式、数据单位待决策；模拟反馈与真实业务结果分开 |
| PRD-R11 动态 Agent Loop | 场景 §1、6–7；RETAIL-06 §1、7、9 | PRD §4.1；架构 “Agent Loop”；ADR-007 | RETAIL-04、06；安全运行门槛按批准 DAG | 真实模型、Observation→进展判断→动态工具/停止；双情景轨迹可解释不同；固定流程不等同 Agent |
| PRD-R12 Context/Memory 分层 | 场景 §6（上下文最小化、Memory 边界）；RETAIL-06 输入/输出限制 | PRD §4.2；架构 “上下文分层”；ADR-008 | RETAIL-04/06；若需要独立检索系统须范围变更 | Context 层次、裁剪/摘要、token 预算、来源/时效与权威边界明确；未新增 RAG |
| PRD-R13 风控及生命周期 fail-closed | 场景 §2；RETAIL-07/08/09/11 §2、7、9；00B-03/04H 静态限制 | PRD §4、7；架构 §5；ADR-003/005/011 | RETAIL-07、08、09、11；RETAIL-00B-03V（GitHub Issue #17）/RETAIL-00B-04V（GitHub Issue #18）/RETAIL-00B-02V（GitHub Issue #16）及 RETAIL-00F（GitHub Issue #7）门槛 | 风控拒绝/失败/取消/超时、批准撤销/过期、草案 stale、uncertain 对账不绕过；未实现声明 |
| PRD-R14 最小 Agent 行为评测与零容忍门槛 | RETAIL-06（GitHub Issue #27）T01/T02、双情景验收；RETAIL-19（GitHub Issue #39）§1、7、9 | PRD“RETAIL-06 与 RETAIL-19 的评测边界”；架构“最小 Agent Eval”；ADR-009 | RETAIL-06 最小双场景真实模型评测；RETAIL-19 完整经营对照 | 一般效果指标阈值可候选/待定；硬规则违规、未授权写入、审批绕过、重复业务副作用为零容忍安全门槛，任意一次即验收失败；不声称有实测 |
| PRD-R15 端到端 Trace | RETAIL-07 N3；RETAIL-11 run/draft/operation；RETAIL-12 feedback receipt；RETAIL-15 occurrence；RETAIL-19 原始指标 | PRD “Agent 风险、审批与可观测要求”；架构 “端到端 Trace”；ADR-010 | RETAIL-07/09/11/12/15/19 按已有依赖实现 | Retail Task→Agent Run→LLM/Tool Call→Handoff→Approval→Execution Receipt 相关联；具体字段留各 Issue |
| V0/V1 分阶段 | 总体计划 §2、DAG；场景 §2 | PRD §2；架构 §8；路线图 V0.2 段 | 00E-01/02；DAG 后续 RETAIL-03M、18C、13A/13B、14 | 多 SKU/共享库存/补货需依赖门槛和实际覆盖证据，不由 RETAIL-00C（GitHub Issue #14）自动解锁 |
| 技术栈候选和 Runtime 门槛 | 总体计划 G1–G5；00B-02/03/04H | 架构 §2、7；ADR-004 | 固定源码调查 SHA `e8db2b6...`；RETAIL-00F（GitHub Issue #7）、RETAIL-00B-02V（GitHub Issue #16）、RETAIL-00B-03V（GitHub Issue #17）、RETAIL-00B-04V（GitHub Issue #18） | 仅是候选静态结构；Node/Cloud/DeepSeek/真实效果未验收 |
| 历史规划边界 | V0.1 路线图/架构；批准 V0.2 总体计划 | 路线图当前索引；ADR-006 | 本次改动路线图顶部，保留旧正文 | 旧比价/叠券/跨店内容是历史，不是当前承诺 |

## 来源等级与验证状态

- **A：批准需求**：总体计划、场景及用户批准；形成目标约束。
- **S：静态源码/调查**：固定 SHA 的源码路径及调查报告；用于能力边界判断，不等于运行通过。
- **F：fixture/unit**：上游已记录的隔离 fixture 测试，仅说明受测路径。
- **R：真实 Runtime/外部效果**：本 Issue 尚未执行；必须由专门运行验证 Issue 和安全环境门槛提供。
- **D：数据事实**：固定数据版本及可复现筛选/覆盖证据；不能将编码样本外推为真实门店运营记录。

本矩阵没有将任何未实现需求标为 DONE。架构原则已获 N4 批准；业务指标目标及各任务具体业务/风险参数仍按责任 Issue/Plan 延期冻结。每个下游 Issue 仍需在自己的 N0 固定实际基线、输入和节点验收。

## N4 独立架构 Review 逐项语义对齐

### 既有 Issue 契约逐项对照

| Issue | 已有计划/验收语义（E） | 文档澄清（A） | 新增范围（C）及本次处理 |
|---|---|---|---|
| RETAIL-06（GitHub Issue #27） | 两个不同情景真实调用模型；观察驱动动态工具选择及轨迹差异；来源草案；证据不足时拒绝；不得执行副作用 | PRD-R11/12/14、架构 Agent Loop/Context/Eval、ADR-007/008/009 明确 Observation、进展判断、预算、停止、结构化结果和最小评测 | 独立 Runtime/RAG/额外 Agent 属 C；未增加，不改变 RETAIL-06 验收或 DAG |
| RETAIL-07 | 草案 revision、证据摘要/政策版本绑定、同输入幂等、变化生成新版本、模型不能自批 | PRD-R08/13/15、架构状态与 Trace 明确摘要失效、审批前再校验和引用关联 | 新 Schema/API 属 C；留给原 Issue，不修改其范围 |
| RETAIL-08（GitHub Issue #28） | 独立风控审阅同一冻结草案；硬限制可阻断；失败不进入审批；风控不能执行 | PRD-R07/13、架构状态机、ADR-003/005 区分 LLM 语义审查与确定性硬规则 | 新风控架构/Grant/Handoff 实现属 C；仍须 RETAIL-00B-04V（GitHub Issue #18）/RETAIL-00B-03V（GitHub Issue #17）/RETAIL-00F（GitHub Issue #7）门槛 |
| RETAIL-09（GitHub Issue #29） | 人类业务批准/拒绝/到期/撤销绑定冻结草案；批准不等于执行 | PRD-R07/08/13、架构状态机及 trace 标明 actor、digest、expiry 和失效状态 | 审批存储/API 扩展属 C；字段实现留给原任务，不修改验收 |
| RETAIL-11（GitHub Issue #31） | Durable 恢复需关联同一任务/草案/操作；覆盖停止、取消、幂等回执及 uncertain | PRD-R09/13/15、架构对账转换与产品账本/Runtime checkpoint 权威边界 | 新恢复方案/真实 Runtime 属 C；仍须 RETAIL-00F（GitHub Issue #7）/RETAIL-00B-02V（GitHub Issue #16）运行验证，未启动 |
| RETAIL-12 | 仿真反馈、指标/手算可核对，模拟结果与现实数据分开 | PRD-R05/10/14、架构数据谱系及 Trace 明确来源、单位、反馈关联 | 新评测平台属 C；不新增实现，不将仿真说成真实效果 |
| RETAIL-15（GitHub Issue #38） | Goal/Scheduler occurrence 标识、停止/恢复；不能自动触发未经批准的业务动作 | PRD-R09/15、架构 uncertain 状态不完成且不推进下一 occurrence | 调度器/工具改造属 C；不改 RETAIL-15 验收或依赖 |
| RETAIL-19（GitHub Issue #39） | 固定数据切分/种子/条件开展完整多场景经营对照，报告原始指标和负例，不预设 Agent 更优 | PRD-R14、架构最小 Eval、ADR-009 划清 RETAIL-06 行为验收与 RETAIL-19 业务比较 | 把对照套件移入 RETAIL-06 属 C；明确保留给 RETAIL-19 |

本表的 E 为 Issue/场景已有要求；A 为不改变验收的架构解释；C 为需单独变更提案的扩围。本次未更改其他 Issue、Plan、验收文本、DAG 或其依赖关系。

| Review 要求 | 分类 | 既有范围对齐 | 本次文档落点/处理 |
|---|---|---|---|
| 真实模型、多步进展、动态工具选择、两个情景轨迹差异、缺证据拒绝 | E：已有验收要求 | RETAIL-06（GitHub Issue #27）的目标、N1–N3、T01/T02 与验收标准 | PRD-R11、Agent Loop；保留 RETAIL-06 真实模型与双情景，不以 fixture/固定脚本代替 |
| System/Task/Working/历史经验边界，结果裁剪、摘要、来源、时效、token 预算 | A：架构补充 | 场景要求上下文最小化；不新增业务能力 | PRD-R12、Architecture Context contract、ADR-008；具体预算由 RETAIL-06（GitHub Issue #27）N0 冻结 |
| 确定性硬规则与 LLM 风险分析分工，拒绝/撤销/超时/stale/uncertain 状态 | E+A：已有安全/状态要求加明确语义 | RETAIL-07/08/09/11 和 00B-03/04H 的现有目标 | PRD-R13、ADR-003/005、Architecture 状态转换；不改其他 Issue 文本/验收 |
| 单 SKU/多场景评测与 trace 关联，候选指标和阈值 | E+A：最小 RETAIL-06 验收 + 跨任务可观测解释 | RETAIL-06 双真实情景；RETAIL-19 全面经营对照；RETAIL-07/11/12/15 各自 trace/receipt | PRD-R14/R15、ADR-009/010；一般指标目标未批准、未声称有结果；零容忍安全门槛独立执行 |
| 单独 RAG、额外 Agent、额外 Issue/DAG 关系、将 RETAIL-19 实验塞入 RETAIL-06 | C：若要实施则属新增范围 | 现有场景把复杂 RAG/Memory/Context 列为后续候选；批准 DAG 未包含本次新依赖 | 明确不纳入，不改任务/Plan/DAG；如确需实施另提用户审批变更 |

### 三类语义定义

- **E（Existing）**：RETAIL-06/07/08/09/11/12/15/19 或原场景已有明确目标/验收，本次只是使其在 PRD/Architecture 中可追溯，不改其范围和验收阈值。
- **A（Architecture clarification）**：为了让既有合同可实现和可审查而补充状态、来源、上下文或可观测语义；不创建新服务/Agent、工具、Issue、DAG 边或实现承诺。
- **C（Change required）**：任何独立 RAG、额外 Agent/运行时、改动其他任务验收、跨任务接口/依赖变化、把 RETAIL-19 的对照实验移动至 RETAIL-06，均需独立变更提案及用户审批；本轮没有实施。
