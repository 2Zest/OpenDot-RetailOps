# RETAIL-03（GitHub Issue #22）N0 节点验收回执

日期：2026-11-27
状态：IN_PROGRESS；N0 已推送并提交主控核验，N1 尚未开始。
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`
Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
基线 HEAD：`f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`

## 目标与输入

- 核验 Issue #22 READY 与用户认领授权、DAG、GitHub/Projects 状态、远程基线、环境、可改文件和测试范围。
- 读取并固定 Master Plan、PRD、Architecture、ADR、DAG、DECISIONS-PENDING、原 RETAIL-03 Issue/Plan、领域研究、领域合同及路径所有权规范。
- 不开始源码实现；只提交细化执行 Plan 和本回执供主控核验。
- 上游实际记录：#20 PR #87 merged，merge SHA `048f3a7ef64a54986bfda1e839396b961969e46d`；#12 PR #75 merged，merge SHA `3469160b93b966e38757e48bbb3c0239362c16d3`。Issue #20/#12 均 Closed/DONE。两项硬依赖满足。
- 当前远程 `develop/retailops` HEAD 与基线一致；#21 PR #89 为 OPEN/REVIEW，HEAD `237ec20a5cbabf7e1e39336347f368e881eede57`，#21 不在 #22 DAG 上游。
- 原始计划、总体计划、DAG、领域合同保持只读。候选参数值不冻结。

## 实际动作与范围

- Fetch `origin/develop/retailops`，确认实际 HEAD `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`。
- 核验 #22 两项硬依赖及合并 SHA；确认分支不存在远端同名分支、创建独立 `feat/retail-03` Worktree。
- WSL2 Node v24.22.3 / npm 11.19.1；x86_64；可用内存约 14 GiB。
- Issue #22 已由用户授权认领，已同步为 OPEN / IN_PROGRESS / assignee 2Zest；Project #2 item `PVTI_lAHODjlUWM4BtKkTzhLw5Dc` 已同步并回读为 In Progress。
- 本节点实际允许修改：`docs/retailops/plans/RETAIL-03-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-03-N0.md`。N0 没有修改业务源码、package、锁文件、迁移、测试或总体计划/DAG。
- 实际命令：`git fetch origin develop/retailops`（退出码 0）；`git worktree add -b feat/retail-03 D:/workSpace/codeAgent/OpenDot-RetailOps-03 origin/develop/retailops`（退出码 0）；远程 Issue/Project 回读成功。
- N0 不运行 build/typecheck/test；N0 没有源码改动。后续测试命令和 test discovery 已写入执行 Plan。`npm run docs:check`（WSL Node 24.22.3）退出码 0，271 份 Markdown 通过；`git diff --cached --check` 退出码 0。

## 仿真边界及决策映射

V0 限定单抽象门店、单 Product、单 Batch。初始化库存、arrival、需求、时间和价格候选均显式输入并标记 SIMULATED。种子和仿真时钟必填、无生产默认值；同输入必须生成同一事件账本。批次、质量、效期、可售和单位复用 RETAIL-01 / 0.3.0 合同。Price action 只作为内部模拟输入，来源于 RETAIL-05P 计算合同及对应 Policy revision，不导出给 Agent 或注册成 Tool。

- D01：记录单店单 SKU 原则；不指定现实门店/SKU。
- D02：复用 Quantity/Money/Date/Instant 合同；单位和时间基准由输入提供，不做换算/舍入默认。
- D03：复用 Batch/Expiry/Sellability；不设置临期阈值或新质量参数。
- D06：需求为显式 SIMULATED 场景输入；不由公开归一化销量推算件数，不假定价格弹性。
- D07：初始库存与到货只来自 SIMULATED scenario，不声称是真实库存。
- D09：seed、clock、scenario version、horizon 均显式提供，无生产默认值。
- D04：价格边界沿用 Policy / RETAIL-05P 合同，不新增折扣数值。

事件守恒提案：期初实物量 + arrival = sold + 显式 spoilage removal + 期末实物量。到期导致停售只改变可售分类，不本身扣减物理库存；未售库存与实际报损移除分开。事件序号确定同一时点排序，重复事件 ID 拒绝。

## 文件清单和验证

| 路径 | N0 操作 |
|---|---|
| `docs/retailops/plans/RETAIL-03-EXECUTION-PLAN.md` | 新增 N0 细化计划 |
| `docs/retailops/acceptance/RETAIL-03-N0.md` | 新增本节点回执 |

未来 N1+ 候选路径、唯一 owner、共享迁移锁、包配置只读边界及测试命令均列于细化 Plan。未列路径保持只读。event ledger 当前计划作为模拟结果内存返回；如需持久化须另提迁移要求，不碰 #21 的 v2 migration 和 runner。

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 / Architecture | 单店单 SKU 单 Batch 仿真；真实历史/仿真来源分离；无真实业务副作用 | 只读核对固定 SHA 的文档和 domain 0.3.0；N0 未写源码 | PASS |
| Issue #22 / 原 Plan | 固定 seed/clock、事件账本、库存守恒、单独价格动作接口；只细化 N0 | N0 Plan 冻结单 SKU/BATCH、SIMULATED 输入、PRICE action 内部边界和文件 owner | PASS |
| N0 节点标准 | 上游通过、环境/工作区/路径/test 命令明确 | 两项上游 merge SHA、远程 HEAD、Worktree/branch、Node/npm、scope 均可复核 | PASS |

## 阻塞、未验证与结论

- N0 未运行源码测试，无结果冒充；N1–N6 均未开始。
- D01/D02/D03/D06/D07/D09 的业务数值和候选场景没有冻结；本 Plan 要求运行调用方显式提供值，测试常量只属于 synthetic fixture。
- #21 仍在 REVIEW，#26 SQLite adapter 仍等 migration lock 移交；#22 本轮不申请或占用迁移锁。
- Issue #23 保持 BACKLOG；#7 保持 BLOCKED；没有下游任务被解锁。
- 总体计划、原始 Plan 与 DAG 未修改。

**N0 结论：PASS，提交主控核验。** 当前没有 N1 授权；待主控核验本 Plan 文件 owner 和执行节点后再进入 N1。

## 主控 N0 核验及 N1–N6 放行补记

- 主控批准的 N0 HEAD：`59b8a7ea295e1c2b00cf53df6c1761eb13711de9`。主控授权 N1–N6 按本计划执行，保持单店/单 SKU/单 Batch、仿真事件账本内存返回、不创建迁移、不连接 Runtime/MCP/真实写接口。
- 开发前从远程确认最新 `origin/develop/retailops` 为 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`，这是 PR #89（RETAIL-02）已合并后的集成 HEAD。将该提交合入既有 `feat/retail-03`，产生同步提交 `0344532e58fa545029818e25db3ce6ab0a6bdbe7`，无冲突；保留原始 N0 文档和工作内容，未重建 Worktree/分支或覆盖未提交文件。
- 主控批准的文件所有权继续有效。本轮不使用应用服务文件，不写共享 `domain/index.ts`、Repository、SQLite adapter、migration/runner、包 manifest、锁文件、编译或测试配置。
- Issue #22 仍 OPEN/IN_PROGRESS；PR 创建前不改变任务状态。#21 已并入最新基线；#26 拥有 DraftRevision migration/runner 路径，但本任务无重叠写入。
- 本补记不改变 N0 的历史结论、总体计划、DAG、原始 Plan 或未决业务参数。
