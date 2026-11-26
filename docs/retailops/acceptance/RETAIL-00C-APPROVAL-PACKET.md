# RETAIL-00C V0.2 业务架构审批材料

**审批状态：PENDING_USER_APPROVAL。** 本材料冻结 N0–N3 文档候选版本，供用户审阅并作业务架构决策。批准前不得执行 N5/N6、跑文档回归、创建 PR 或把 PRD/ADR 标为已批准。

- Issue：[#14 RETAIL-00C](https://github.com/2Zest/OpenDot-RetailOps/issues/14)，当前 Open / IN_PROGRESS，由 `2Zest` 认领。
- 分支：`docs/retail-00c`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-00c`。
- 候选计划基线：`develop/retailops` SHA `591ced31c0557cbb14d7b4dc6197da52923e55b6`。
- 五项已合并上游：#9 `0ce19d390a99aa3e14307b84094aba4aeeb74a59`、#10 `4bda549e7bcf250fe555d9e89e49ad59d5396d71`、#11 `60590b3a03fe79476b7ee9851669c19e1c1ca929`、#12 `3469160b93b966e38757e48bbb3c0239362c16d3`、#13 `6a2ddc363f82ae9f9e66e296d2644efafb48565e`。

## 本次请求批准的架构基线

1. **业务目标与阶段**：以单店商超经营为核心，V0 聚焦单 SKU、单临期批次损耗治理；完成安全闭环并验证数据适用性后，V1 才逐步扩展多 SKU、共享库存与补货。20–50 SKU 不是当前硬承诺。
2. **领域合同**：明确 SKU/批次、质量/到期硬拦截、`on_hand/reserved/available` 库存口径和事件语义；线上预占/完成/取消作为 V1 目标合同，不声称 V0 已实现。
3. **数据边界**：区分 `PUBLIC_HISTORICAL`、`DERIVED`、`SIMULATED`、`LIVE_DEVICE`。FreshRetailNet 编码样本不得解释为现实门店、实物件数、批次、成本、库存或实际收入；仿真价格响应不得宣称真实因果。
4. **决策职责**：Agent 生成受限建议；确定性规则检查硬约束；独立风控只读审查；店长承担业务批准；仿真执行服务执行批准的动作。MCP 工具调用授权不等于业务审批，未知工具默认拒绝，人工审批不得绕过 Grant/工具注册/安全政策。
5. **状态与恢复**：草案绑定输入快照、政策版本、参数、主体和摘要；变更使旧审查/批准失效。副作用先在仿真中执行；重复请求幂等；`UNCERTAIN` 先对账，不能盲目重试或标记完成。
6. **技术方向提案**：优先评估既有 TypeScript/Hono/SQLite/Zod/Pi 产品平台，不引入第二套 Agent Runtime；在各自 Issue 中完成实现和真实运行验收。该提案不修改代码或依赖。
7. **历史与安全门槛**：保留 V0.1 旧架构和路线图历史；不将竞品比价、叠券、跨店调拨带入 V0.2。#7 独立安全环境维持 BLOCKED；Durable/MCP/Handoff 的真实运行门槛不由本次批准自动视为通过。

## 待负责人逐项决定

请在批准时接受、修改或明确推迟以下内容：

- V0 试点 SKU/品类/单位、包装换算、批次字段、临期窗口、质量资格标准。
- 临期折价步长/上限/最低价或毛利底线、适用时段及业务规则优先级。
- 损耗改善指标、分母/基准/单位、成本来源与价格响应假设表达。
- 使用何种公开历史样本以及如何与仿真输入关联；固定种子、情景及时间切分。
- 店长、分析 Agent、独立风控角色及执行角色的权限/职责分离、审批有效期和撤销策略。
- 审批摘要绑定字段、数据或政策变化后的失效/再审规则、审计留存和脱敏要求。
- 多 SKU V1 的扩展准入条件、规模与数据覆盖门槛。
- 是否接受现有平台作为候选技术方向；DeepSeek 与 Node/Cloud Runtime 实际兼容须由后续隔离验证另行确认。

完整参数清单见 [`DECISIONS-PENDING.md`](../initial-plan-v0.2/DECISIONS-PENDING.md)；本包不默认替用户填写任何阈值。

## 审批文件 SHA-256

下表是本次工作树中文件的 SHA-256（按文件原始字节计算）。审批时请将决定绑定到这些摘要；若用户要求修改任一文件，则候选摘要失效，需重新生成材料并审阅。审批包本身及 N4 回执在生成后不纳入本表，以避免自引用。

| 文件 | SHA-256 |
|---|---|
| `docs/retailops/RETAILOPS-ROADMAP.md` | `D134007B73BA56F512828AAE26B652BBCF300FCA5759C0D663C955EC7B1485E5` |
| `docs/retailops/initial-plan-v0.2/plans/RETAIL-00C-PLAN.md` | `55BEEA30E33E4E62891E22BE1AA7D7D0D1C7140D25BFF2F9134A479D1A108C56` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-PRD-V0.2.md` | `7782E82BDB2588F7C7B15A49989763E11C90E17FC609CCBDC9F09146F20E0381` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-ARCHITECTURE-V0.2.md` | `C63F2059128172795FC17F0B8B287C9845BEA3E7CF70A9FD29C8DEB3CD267455` |
| `docs/retailops/initial-plan-v0.2/RETAILOPS-ADR-V0.2.md` | `3FD14B783E5A3325458818562BDAE14B3F5D4209955D46EFBEB69DA1079D4475` |
| `docs/retailops/initial-plan-v0.2/REQUIREMENTS-TRACEABILITY-V0.2.md` | `E607D4D8C9790654C2D4EC80E50BD0010A4EDE6161190D1E661C06080D29E132` |
| `docs/retailops/initial-plan-v0.2/DECISIONS-PENDING.md` | `10855BE10D5F918165691D431B52814181E18B3F2093FC7D4CD83C7677DE2879` |
| `docs/retailops/acceptance/RETAIL-00C-N0.md` | `D124C5F4BAFF6F1772B36C6B3947AC4729B6F283A4AFF6C24ECA65AE9D62B139` |
| `docs/retailops/acceptance/RETAIL-00C-N1.md` | `CEE2D09DBE027979D3FA6BB2228D7A1FFA63B9B12BD5F68E240088964757AF38` |
| `docs/retailops/acceptance/RETAIL-00C-N2.md` | `1BE4985FA73F0638526524258C445B9743375CBC085F8CF6510F012C770A812E` |
| `docs/retailops/acceptance/RETAIL-00C-N3.md` | `9360DF1354FB021B3D0D14E1FEE044B4CCB4A354F70172BE9AADE9F76D94838E` |

## 审批结果记录（待填写）

- 决定：`PENDING_USER_APPROVAL`
- 批准人/时间：待用户确认。
- 接受的基线 SHA：待用户确认。
- 修改/推迟/拒绝的 D 项：待用户确认。
- 批准条件：待用户确认。

## 继续执行的界线

- 用户明确批准此 SHA 绑定的业务架构后，才进入 N5，执行 `npm run docs:check`、`git diff --check` 和 Plan 中要求的定向语义回归。
- 若检查失败，在原文件范围内修复、重新计算 SHA 并重新请求审批；不能降级门槛。
- N6 在 N5 完成后创建独立 PR，目标 `develop/retailops`，保持开放等待 Review/合并。
- 本次未启动 N5/N6；按用户追加授权，本 N0–N4 文档候选将提交并推送至既有 `docs/retail-00c` 分支供独立架构 Review。此提交仅归档待审批草案，不创建 PR、不合并、不冻结正式版本，也不解锁 RETAIL-00D、RETAIL-01、RETAIL-05P 或其他下游。
