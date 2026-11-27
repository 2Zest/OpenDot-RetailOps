# RETAIL-03（GitHub Issue #22）N6 交付与 Review 回执

日期：2026-11-27
状态：REVIEW；PR #91 已创建并等待独立 Review
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
| N6 节点交付标准 | 独立分支推送、PR 目标 develop/retailops、Issue/Projects 回读 REVIEW，不合并、不 DONE、不启动下游 | PASS |

未验证/限制：本项目仍不具备从此仿真结果推断真实需求、价格因果、生产经营 KPI 或业务执行授权的证据。#7 仍 BLOCKED。

## 最终交付回读

- 实现提交：`3e4a6f69ef5d619c27bd5aac794680059244dc05`；分支 `feat/retail-03` 已推送，PR 分支目标为 `develop/retailops`。
- PR：[ #91 RETAIL-03：单 SKU 经营仿真器](https://github.com/2Zest/OpenDot-RetailOps/pull/91)，回读状态 OPEN，等待独立 Review。
- 全包回归：`npm --prefix apps/retailops run build`、`npm --prefix apps/retailops run typecheck`、`npm --prefix apps/retailops test` 均退出码 0；测试 14 个文件、120/120 通过（含原109项）。仿真定向测试 11/11 通过。
- 文档与差异：`npm run docs:check` 检查281份 Markdown 并退出码 0；`git diff --check` 与 `git diff --cached --check` 均退出码 0。
- Issue #22 回读 OPEN，标签 REVIEW，assignee 2Zest；Project #2 回读状态 Review。未关闭 Issue、未标记 DONE、未启动下游任务。
- N6 三层对齐均为 PASS；未验证限制保持如上。Issue #7 保持 BLOCKED。

## PR #91 最终针对性修订（2026-11-27）

审查输入 HEAD：`c63411a7368f01979af34fc50b39a65957d8ce7c`。PR #90 已合并，最新集成基线为 `2850f918bc22cbf1c44bc7ea7a560f991ba4cdfc`；当前 `feat/retail-03` 通过非强制 merge commit `583c3b813f63c2ff460dd14de6a2c0ea6390e9e8` 同步基线，未发生冲突。原始 PR、Review 历史和三个文件所有权不变。

### 红绿回归证据

修复前在原分支上对 19 项仿真定向测试实测：**8 项失败、11 项通过**。失败覆盖同 ID 价格候选库存快照不符、候选基准售价不符、单位成本不符、生效时点过期、结果数量精度错误导致 `safeParse` 异常、账本库存迁移被篡改、需求汇总与事件不一致、收入/贡献汇总被篡改。

针对修复增加/完善回归：应用候选时按当前模拟库存、当前价格、单位成本、单位、Policy revision 与有效窗口重核；事件顺序后库存已变化的候选拒绝。结果 Schema 在 BigInt 转换前校验声明精度和输出尺寸。账本 Schema 校验事件 ID/顺序、相邻库存连续性、库存分类守恒、各类数量汇总、收入/直接成本/报损成本暴露汇总和最终状态。另覆盖重复事件 ID、成本/报损暴露篡改及 301 位数量字符串。

修复后仿真定向测试 **23/23 通过**；保留原始测试及断言，未新增数据库迁移、依赖、领域合同或运行时能力。

### 本轮实际检查

| 命令 | 环境/退出码 | 结果 |
|---|---|---|
| `npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts` | WSL Node 24；0 | 1 个文件，23/23 通过。 |
| `npm --prefix apps/retailops run build` | WSL Node 24；0 | TypeScript production build 通过。 |
| `npm --prefix apps/retailops run typecheck` | WSL Node 24；0 | 源码与测试 TypeScript 检查通过。 |
| `npm --prefix apps/retailops test` | WSL Node 24；0 | 17 个测试文件，159/159 通过。 |
| `npm run docs:check` | WSL Node 24；首次 1，修正 Git 环境后 0 | 首次 WSL Git 将 Windows Worktree `.git` 指针误解为相对路径；设置 `GIT_DIR=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps.git/worktrees/OpenDot-RetailOps-03`、`GIT_WORK_TREE=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-03` 后，285 份 Markdown 通过。 |
| `git diff --check` | Windows Git；0 | 无空白错误。 |

### 文件范围与语义验收

- 本轮修改严格限于 `apps/retailops/src/domain/simulation/simulator.ts`、对应 `apps/retailops/test/fixtures/simulation/single-sku-scenario.ts` 和 `apps/retailops/test/unit/domain/simulation/simulator.test.ts`。
- 总体计划/场景：只加强 SIMULATED 单 SKU 价格候选的时点与状态绑定、精确结果校验和账本一致性，不引入真实执行权限或业务副作用。**PASS**。
- Issue #22/原 Plan：没有改总体目标、DAG、基础领域合同、依赖配置或迁移；价格动作仍只接收合同校验通过的 RETAIL-05P 候选。**PASS**。
- 节点验收：红测确实捕获旧缺陷，修复后定向和全量检查退出码为 0；输出 Schema 对精度和汇总进行结构化拒绝。**PASS**。

Issue #22 和 Project #2 保持 REVIEW；PR #91 保持 OPEN 等待最终独立 Review；未合并、未标 DONE、未启动下游。Issue #7 继续 BLOCKED。

### 推送后的 HEAD 回读

- 核心代码修订提交：`accb01e41a01c72cbe65eb0cd5403b2e421f1f56`；首次补充回执提交：`efff19efd6d2e3154026ae5a7f71bc02e009d90c`。两次提交均已推送至 `feat/retail-03`，无强推；后续回执修订不改变上述提交的历史含义。PR 当前 HEAD 以最终 GitHub 回读为准。
- PR：[RETAIL-03：单 SKU 经营仿真器](https://github.com/2Zest/OpenDot-RetailOps/pull/91)，该回执提交后实际回读为 OPEN，目标 `develop/retailops`，HEAD 为 `efff19efd6d2e3154026ae5a7f71bc02e009d90c`；本次回执勘误后的最新 HEAD 以 GitHub 回读为准。
