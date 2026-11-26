# RETAIL-00C V0.2 业务架构审批材料

**状态：PENDING_USER_APPROVAL。** 此包是独立架构 Review 后的候选修订，尚未得到用户对业务架构或具体参数的批准。仅表示 N0–N3 文档候选已提交供审阅；不冻结正式 PRD，不代表实现，不允许据此启动下游任务。

- GitHub Issue #14（RETAIL-00C）：[issue 页面](https://github.com/2Zest/OpenDot-RetailOps/issues/14)，Open / IN_PROGRESS。
- 分支：[`docs/retail-00c`](https://github.com/2Zest/OpenDot-RetailOps/tree/docs/retail-00c)；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-00c`。
- 文档所依据的计划基线：`develop/retailops` SHA `591ced31c0557cbb14d7b4dc6197da52923e55b6`。
- 五项已合并上游：RETAIL-00B-02（GitHub Issue #9）`0ce19d390a99aa3e14307b84094aba4aeeb74a59`、RETAIL-00B-03（GitHub Issue #10）`4bda549e7bcf250fe555d9e89e49ad59d5396d71`、RETAIL-00B-04H（GitHub Issue #11）`60590b3a03fe79476b7ee9851669c19e1c1ca929`、RETAIL-00E-01（GitHub Issue #12）`3469160b93b966e38757e48bbb3c0239362c16d3`、RETAIL-00E-02（GitHub Issue #13）`6a2ddc363f82ae9f9e66e296d2644efafb48565e`。
- 编号规则和完整 DAG 交叉映射见 [`REQUIREMENTS-TRACEABILITY-V0.2.md`](../initial-plan-v0.2/REQUIREMENTS-TRACEABILITY-V0.2.md)：内部任务只写 `RETAIL-XX`；GitHub 编号显式写 `GitHub Issue #N`，不使用 `#06`、`#19` 等任务简称。

## 本轮独立 Review 意见处理

| Review 意见 | 处理位置 | 状态/范围说明 |
|---|---|---|
| 提升 RETAIL-06（GitHub Issue #27）的真实模型、动态工具选择、两个情景轨迹差异和缺证据拒绝要求；写清 Loop、Observation、进展、预算、停止、失败和结构化结果 | PRD-R11/R14、§4.1；Architecture Agent Loop/Eval；ADR-007/009；需求追溯矩阵 | 已纳入架构候选；没有运行模型、修改 RETAIL-06 契约或宣称验收通过 |
| 明确上下文/记忆层级、工具结果裁剪/摘要、Token、时效/来源；Memory 不替代权威源，RAG 不擅自扩围 | PRD-R12、§4.2；Architecture Context；ADR-008；追溯矩阵 | 已纳入；独立 RAG、索引、工具、Agent 或 DAG 边未新增 |
| 划分经营分析与独立风控；区分 LLM 语义审查和确定性硬规则；补齐拒绝、取消、撤销、超时、失效、uncertain；避免库存重复扣减 | PRD-R03/04/07/13；Architecture 库存不变量和状态矩阵；ADR-003/005/011 | 已纳入；库存采用互斥分类守恒，状态/运行能力仍为目标合同而非现有实现 |
| 定义 RETAIL-06（GitHub Issue #27）最小 Agent Eval 与端到端 Trace；完整多场景经营比较保留给 RETAIL-19（GitHub Issue #39） | PRD-R14/15；Architecture Eval/Trace；ADR-009/010；逐任务追溯 | 已纳入；普通指标/阈值未伪称测量；安全门槛零容忍；未迁移 RETAIL-19 工作 |
| 逐条追溯场景及 RETAIL-06/07/08/09/11/12/15/19，并区分已有要求、架构澄清、新范围 | `REQUIREMENTS-TRACEABILITY-V0.2.md` 的逐任务表与 E/A/C 分类 | 已纳入；没有修改其他 Issue、Plan、验收标准或 DAG；C 类需独立提案 |
| 分类 D01–D16，修正材料路径，核验 SHA，记录 Node 环境差异 | `DECISIONS-PENDING.md`；本包路径；以下 Git Blob SHA 清单；N0/N4 回执与 RETAIL-00C Plan | 已纳入；原则待用户决定，具体值延期至责任下游任务冻结；WSL Node 基线已恢复，N5 仍等待用户批准 |

## N4 必须决定的业务/架构原则

请用户逐项接受、修改、拒绝或明确延期。此处列出的是需决策的原则，不把尚未批准的阈值写成默认值。

1. **项目目标与 V0 范围**：最终目标是面向 AI/Agent 应用开发岗位的高质量工程项目；单店零售是受限验证场景。V0 仍为单 SKU、单临期批次，不建设完整传统零售管理系统。
2. **真实 Agent 行为**：RETAIL-06 保留真实模型驱动的动态 Tool-use Loop、Observation/进展判断、不同场景下有证据解释的工具轨迹差异、来源草案和缺证据拒绝。固定顺序 Workflow 不算动态规划 Agent。
3. **上下文及事实权威**：System/Task/Working/历史经验分层；摘要须保留来源、时效及原结果引用；Memory 不拥有库存、政策、授权或审批事实。独立 RAG 不在当前范围。
4. **角色与安全**：经营分析、独立风控、店长审批、执行服务分离；LLM 做语义风险分析，确定性校验执行可计算硬规则；风控失败、审批拒绝/撤销/超时、草案失效或 uncertain 均 fail-closed。
5. **库存守恒**：`physical_on_hand = unavailable_qty + available_to_sell + reserved_qty`，三类数量互斥；预占仅从合格可售量转入，完成时物理量和预占同量扣减。
6. **评测与可观测**：RETAIL-06（GitHub Issue #27）负责最小的双情景真实模型行为评测；RETAIL-19（GitHub Issue #39）负责完整多场景经营对照。一般候选指标不等于已测值，业务效果不由 Agent 工程指标替代。
7. **零容忍安全门槛**：任意一次硬规则违规、未授权写入、审批绕过或重复业务副作用即安全验收失败并阻断；不得放宽、与普通效果指标折抵或以收益豁免。零次观测是必要条件，不单独证明通过。
8. **Runtime 与安全门槛**：优先复用现有 OpenDot/Pi 底座，不新增第二套 Runtime；RETAIL-00F（GitHub Issue #7）仍为 Open/BLOCKED，Durable/MCP/Handoff 真实运行门槛继续由既有任务和 DAG 管理。

## D01–D16 决策分类

完整描述、责任任务、现有证据和接受边界见 [`DECISIONS-PENDING.md`](../initial-plan-v0.2/DECISIONS-PENDING.md)。分类原则如下：

- **N4 必须由用户决定的原则**：决定项目目标与 V0 范围、质量/授权硬规则、角色职责分离、数据来源不可混淆、动态 Agent 行为、库存互斥守恒、零容忍安全门槛、Runtime 复用及 RETAIL-06/RETAIL-19 的评测边界。
- **候选参数**：D01–D16 保留原分类及候选选项作为后续评估输入；不在 N4 选值、不设默认。所有具体门店/SKU、单位、日期、折价、样本/时间窗、仿真、预算、TTL、Schema、治理、扩展阈值及 Provider 配置值，均明确延期到表中对应下游 Issue 按证据和其 Plan 冻结。
- **不可延期的安全门槛**：硬规则违规、未授权写入、审批绕过和重复业务副作用为零容忍条件，不得作为 D16 普通参数放宽，也不得与效果指标折抵。

无论用户接受何种原则，改变总体计划、Issue 范围、验收标准、DAG 或安全门槛都需独立变更审批；本包未修改这些内容。

## 审批文件 Git Blob 内容 SHA-256

下表值是每个路径在本次候选提交中的 **Git Blob 原始内容字节**的 SHA-256（不含 Git Blob 对象头），不是 Git Blob 对象 ID。已从最终候选提交读取实际 Blob 字节并逐项核对。审批时应将这些摘要与 GitHub 上 `docs/retail-00c` 的 HEAD 提交 SHA 一并记录；任一清单文件变化都会使摘要失效，需重算并重新 Review。审批包和 N4 回执不在表内，以避免自引用；N0–N3 回执和其他候选文件在内。

| 文件 | Git Blob 内容 SHA-256 |
|---|---|
| `docs/retailops/RETAILOPS-ROADMAP.md` | `156D36862E183C6E16636C41261583755A0B49C0C3A438B499250FA92BD45FA6` |
| `docs/retailops/initial-plan-v0.2/plans/RETAIL-00C-PLAN.md` | `9B530B8D9F476354D66E17B4232EED30E9930E5E86C45CF9A048AC7CC9915403` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-PRD-V0.2.md` | `3B976D7D6A35E320D4CE9F8303F7F8039A6F1064BA24B72E9A1A7438618C6DA4` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-ARCHITECTURE-V0.2.md` | `BB7D640E9A2B2955E6521618593EBCDD0884B56A4154BD61CC4AD3061873068F` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-ADR-V0.2.md` | `4D1857FE11219002AFB5066FBF3282863741590F7E43EE81CDA67DEF530EBE4A` |
| `docs/retailops/initial-plan-v0.2/REQUIREMENTS-TRACEABILITY-V0.2.md` | `ABF814FFAC4188FF2017BF7485429EFB7F20ED8E2D9417A036931214DFB5374C` |
| `docs/retailops/initial-plan-v0.2/DECISIONS-PENDING.md` | `7160094059AA70B6060C696F8BCB1D346C84C2C9795549E824F679785B37F039` |
| `docs/retailops/acceptance/RETAIL-00C-N0.md` | `6B6E84768BBF3B64BD4D1E5DE0C9589AC2FAF5FB697AB1D80B9615453EFD6AC1` |
| `docs/retailops/acceptance/RETAIL-00C-N1.md` | `CEE2D09DBE027979D3FA6BB2228D7A1FFA63B9B12BD5F68E240088964757AF38` |
| `docs/retailops/acceptance/RETAIL-00C-N2.md` | `1BE4985FA73F0638526524258C445B9743375CBC085F8CF6510F012C770A812E` |
| `docs/retailops/acceptance/RETAIL-00C-N3.md` | `9360DF1354FB021B3D0D14E1FEE044B4CCB4A354F70172BE9AADE9F76D94838E` |

## 审批与执行门槛

- 当前决定：`PENDING_USER_APPROVAL`；批准人、时间、接受/修改/拒绝/延期的 D 项及条件均待用户填写/确认。
- N0 初始环境发现：Windows Node `v26.13.0` / npm `11.20.0`；WSL Ubuntu 24.04.1 中 Node 缺失，npm 曾解析至 Windows fnm interop 路径。此为历史发现，已在本轮修复。
- N5 执行基线现已恢复并核验：WSL Linux x64 Node `v24.22.3` / npm `11.19.1`；`command -v node/npm` 均为 `/home/szz_user/.local/bin/...`，最终路径位于 `/home/szz_user/.local/share/node-v24.22.3-linux-x64/bin/`。Node.js 官方归档 SHA-256=`4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb`，并通过官方 `SHASUMS256.txt` 校验。来源：[Node.js v24.22.3 官方发布页](https://nodejs.org/en/download/archive/v24.22.3)。
- N5 仅在用户批准本候选后执行 `npm run docs:check`、`git diff --check` 与 Plan 定向语义检查。当前均未执行，不能表述为通过。环境恢复不等于 N4 批准。
- 本任务只提交既有 `docs/retail-00c` 分支供独立 Review；不创建 PR、不合并、不进入 N5/N6、不实施业务代码、不认领或启动下游 Issue。RETAIL-00F（GitHub Issue #7）与真实 Runtime 安全门槛保持原状态。
