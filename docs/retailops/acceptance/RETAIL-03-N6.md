# RETAIL-03（GitHub Issue #22）N6 交付与 Review 回执

日期：2026-11-27
状态：准备交付；PR 创建后更新为 REVIEW
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
目标分支：`develop/retailops`
集成基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 交付内容

- 纯领域单 SKU 仿真输入合同、事件账本和确定性状态转移。
- 仅测试使用的单 SKU 合成场景与有效 RETAIL-05P 候选。
- N0–N6 执行计划、节点验收回执、完整回归和文件范围记录。

## 语义、测试与范围

- 单抽象门店/单 Product/单 Batch；场景、库存、需求、到货、报损、价格动作均为显式 SIMULATED 输入。
- 过期停止销售仅改变 available/unavailable 分类，不扣物理库存；仅显式 arrival/sale/disposal 改变物理量；未售与报损独立统计。
- 只接受 RETAIL-05P 通过合同校验且绑定同一 Product/Batch/Policy revision/Scenario 与生效时点的候选；结果不包含业务批准或执行权限。
- 金额和数量用 BigInt 与显式 scale；价格贡献、库存守恒、候选拒绝与效期边界均有合成回归测试。
- 已执行 Node24 build、typecheck、全包 test、docs:check、git diff 检查和文件范围检查。具体最终退出码、测试文件数/数量、HEAD、commit SHA、PR URL 与 Issue/Project 回读结果将在提交后填入。

## 三层语义一致性

| 对齐层 | 实际核对 | 判定 |
|---|---|---|
| 总体计划/PRD/场景 | 保持已批准的 V0 单 SKU/单 Batch 仿真与数据来源隔离，无真实运行或业务副作用 | PASS |
| Issue #22/原 Plan/Execution Plan | 只实现 #22 的仿真合同、事件、指标和测试；不改基础合同/DAG/共享 migration/config | PASS |
| N6 节点交付标准 | 独立分支推送、PR 目标 develop/retailops、Issue/Projects 回读 REVIEW，不合并、不 DONE、不启动下游 | 待提交后更新 |

未验证/限制：本项目仍不具备从此仿真结果推断真实需求、价格因果、生产经营 KPI 或业务执行授权的证据。#7 仍 BLOCKED。
