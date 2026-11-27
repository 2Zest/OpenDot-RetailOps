# RETAIL-05P（GitHub Issue #24）N2 节点回执

- 当前状态：N2 候选输入/结果 Schema、折价候选生成和确定性硬规则已实现并通过定向测试；等待主控核验。N3 未开始。
- 节点目标：根据已批准 N1 候选口径，实现显式参数化候选与 fail-closed 资格/价格/库存/毛利规则，不赋予业务执行权限。
- 日期：2026-11-27（Asia/Shanghai）。
- Issue / 原 Plan：GitHub Issue #24 / RETAIL-05P-PLAN。
- 执行 Plan：`../plans/RETAIL-05P-EXECUTION-PLAN.md`；N1 批准口径：`../plans/RETAIL-05P-N1-FORMULA-DECISIONS.md`。
- Git 基线：develop/retailops `8ca176ff3f9e5990b6c2487e41be2953e682c192`；节点开始分支 HEAD `03f568545392c00e411f9ce37d7884746b1a88fc`。
- N2 源码与测试提交：`cf871b884bc426a4415a65084c79dcbaf56ff4ca`；该提交包含本节点实现与测试，后续回执状态整理在独立提交。
- Worktree / 分支：`D:/workSpace/codeAgent/OpenDot-RetailOps-05p` / `feat/retail-05p`。
- 上游：Issue #19 / PR #86 merge SHA `8ca176ff3f9e5990b6c2487e41be2953e682c192`，领域合同 0.3.0；Issue #14 / PR #83 合并记录保持 N0 回执所载。#7 仍 BLOCKED。
- 主控决定：N1 允许每候选显式、带来源的 Q_demand/Q_loss 和版本化折价列表；Contribution 为收入减直接商品成本；BigInt 精确金额策略及显式毛利规则获准。未批准生产默认数值、损耗 KPI 或领域合同变更。

## 实际执行与证据

- 实际修改：
  - `apps/retailops/src/domain/decision/markdown-calculation.ts`：新增 N2 纯领域输入/结果 Schema、显式候选排序/生成、质量/效期/库存/折价上下界/毛利/数量守恒检查及稳定原因码。
  - `apps/retailops/src/domain/index.ts`：仅新增上述模块公开导出。
  - `apps/retailops/test/unit/decision/markdown-calculation.test.ts`：8 个规则测试。
  - `apps/retailops/test/contract/decision/markdown-calculation.test.ts`：4 个输入/结果合同测试。
  - `docs/retailops/plans/RETAIL-05P-EXECUTION-PLAN.md`、`docs/retailops/plans/RETAIL-05P-N1-FORMULA-DECISIONS.md`、`docs/retailops/acceptance/RETAIL-05P-N1.md`：同步当前阶段及 N1 已批准状态；保留 N1 发布时历史快照。
  - 本回执：`docs/retailops/acceptance/RETAIL-05P-N2.md`。
- 文件边界：只使用 N0 已批准的 #24 领域决策模块、领域导出、两份独立测试及 #24 专属计划/回执路径；未修改 #20 文件、共享依赖、锁文件、基础领域合同、总体计划或 DAG。
- 红测证据：暂时移除新 API 导出后，对两个新增测试文件运行定向 Vitest，退出码 1，12 项测试均因新 API 不存在而失败；恢复导出后复测。第一次路径校验错误没有被记为行为测试证据。
- 绿测：WSL `Ubuntu` Node v24.22.3 / npm 11.19.1：`npm test -- test/unit/decision/markdown-calculation.test.ts test/contract/decision/markdown-calculation.test.ts`，退出码 0；2 个测试文件、12 项测试通过。
- 类型检查：同一包内 `npm run typecheck`，退出码 0。
- 文档检查：WSL Node v24.22.3，设置 `GIT_DIR`/`GIT_WORK_TREE`/`GIT_OPTIONAL_LOCKS=0` 后从仓库根目录执行 `npm run docs:check`，退出码 0；259 份 Markdown 检查通过。
- 差异检查：Windows Git 执行 `git diff --check`，退出码 0；仅有既有 LF/CRLF 转换提示，无 whitespace error。
- 依赖：在 #20 重型检查结束后，`npm ci` 使用现有 RetailOps 专属 lockfile 完成，未修改 package/lock 文件；npm 输出 3 项审计告警（2 moderate、1 high），未执行自动升级。
- 本节点未运行 `npm run build`、完整 `npm test`、数据库、模型、Runtime 或真实副作用；按 Plan 留至后续定向回归节点，未把 NOT_RUN 记作通过。

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 确定性测算支撑 Agent 决策；业务硬规则不可由模型或仿真绕过 | 资格、库存、价格及毛利检查由纯领域函数执行；无 Runtime/副作用 | PASS |
| Issue #24 / RETAIL-05P-PLAN | 版本化候选、硬约束稳定拒绝；输入和来源显式；不实现执行 | 输入必须包含政策/价格/成本/来源/需求/报损/上下限/毛利约束；缺失合同字段返回 NOT_COMPUTABLE；候选通过仍标 `businessApproval=REQUIRED`、`executionAuthority=NONE` | PASS |
| N2 节点标准 | 候选生成与资格/质量/效期/库存/政策边界有通过和拒绝测试 | 覆盖候选排序、重复折价、负价、折价上限/最低价、每件贡献和毛利率、零收入、质量、过期/边界、零库存、单位不符、损耗超余量；定向 12 项与 typecheck 均通过 | PASS |

## 偏差、限制及后续

- 未设置 D02/D04/D05/D06 的生产数值默认值；Q_demand、Q_loss 和折价列表必须由调用方显式提供并带来源。
- 候选结果的业务批准仍为 REQUIRED，执行权限固定为 NONE；N2 不等同于获准执行。
- 完整收入/贡献/报损指标及解释字段仍属于 N3，不在本节点实现；不得据此宣称经营效果或损耗 KPI 已完成。
- `npm run build` 与完整 `npm test` 未运行，留待 Plan 指定的后续回归节点；本 N2 范围内的定向测试、typecheck、`docs:check` 与 `git diff --check` 均已通过。
- 决定：停留 N2，提交主控核验；N3 未开始。
