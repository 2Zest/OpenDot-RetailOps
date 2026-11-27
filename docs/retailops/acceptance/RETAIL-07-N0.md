# RETAIL-07（Issue #26）N0 节点回执

- 目标：核对基线、依赖、合同、精确文件 owner、测试及迁移共享锁；等待主控核验，不进入 N1。
- 基线：develop/retailops `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`；Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-07`；分支 `feat/retail-07`；起始干净。
- 依赖：#20 CLOSED/DONE，PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d`；合同 v0.3.0。#20 已有 SqliteDraftRepository 与 Policy/Evidence Repository。
- 只读检查确认 `domain/decision/draft.ts` 提供 draftStatusSchema/canTransitionDraft；SQLite migration ledger v1，runner 目前只登记 v1。#21 独占迁移 v2/runner，本任务只能在 #21 合并后由主控转交共享锁。
- 环境：WSL Ubuntu、Node v24.22.3/npm 11.19.1、gh 2Zest；Zod 4.4.3、better-sqlite3 12.11.1、types 7.6.13；Vitest discovery 为 unit/contract。无依赖安装、测试或 Runtime 执行。
- 文件清单见 `docs/retailops/plans/RETAIL-07-EXECUTION-PLAN.md`。本轮仅新增 Plan 与本回执，没有改 #20 源码、共享入口、迁移或配置。
- Project #2 实际回读：#26 Status=In Progress，item ID `PVTI_lAHODjlUWM4BtKkTzhLw5Eg`；Issue #26 Open/IN_PROGRESS/指派 2Zest。#21 已加入并为 In Progress；#22 仍 Ready、未认领。
- N0 回执三层检查：总体计划/Architecture（复用合同且不绕过审批）PASS；Issue/Plan（immutable revision/digest/trace）PASS；节点（基线、owner、命令、迁移序列）PASS。
- 实际动作：只读读取 Issue/Plan、PRD/Architecture/ADR/DECISIONS-PENDING、ownership/status 规范、#20 包配置和 Draft/SQLite 代码；创建计划和回执。
- 测试：N0 源码测试不适用；build/typecheck/test 未运行（NOT_RUN），没有标成 PASS。
- 未验证：digest 实际算法/持久化、trace Runtime、审批/业务副作用；N1 尚未开始。
- 结论（历史）：N0 文档化 PASS，待主控核验；批准与部分放行见本回执末尾。


## N0 文档检查（2026-11-27）
- 在本 Worktree 的 WSL Node v24.22.3 环境执行 `git -c core.autocrlf=true diff --check`：退出码 0。
- 执行 `npm run docs:check`：退出码 0，271 份仓库 Markdown 通过。
- `npm --prefix apps/retailops run build/typecheck/test`：N0 不执行，均为 NOT_RUN；本轮未改业务源码。


## 主控 N0 审查与部分放行（2026-11-27）

- 主控核验 N0 HEAD `c758ca355474eb431f6346f87f80084e77a6e90d`、基线 `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`、上游 #20 merge SHA `048f3a7ef64a54986bfda1e839396b961969e46d`；N0 通过。
- 批准开始 N1–N3，范围仅领域合同、Application Service、Repository port 与测试；摘要规则以执行 Plan 的“主控批准与部分放行”章节为准。
- SQLite adapter、所有新 migration 和 `migration-runner.ts` 修改仍禁止，待 #21 实际合并、同步最新 develop、主控移交迁移锁后再进入。
- 内存替身仅验证应用逻辑，不代表 SQLite 持久化验收。#7 保持 BLOCKED；#22 保持 READY 且未认领。
- 三层检查：Architecture 的不可变摘要/批准绑定 PASS；Issue #26 revision/status/trace 目标 PASS；部分放行的文件边界与迁移暂停标准 PASS。

## 主控批准后的环境补充（2026-11-27）

- 按主控批准，在该 Worktree 使用锁定的 `package-lock.json` 执行 `npm ci`：WSL Node `v24.22.3`、npm `11.19.1`，退出码 0；没有改 `package.json`、lockfile、依赖版本或全局配置。安装输出包含 better-sqlite3 安装脚本由当前 allowScripts 策略跳过的提示；本次没有手工放宽该策略。
- N1–N3 的 Application/领域测试仅用内存 Repository 替身；这不构成 SQLite revision 持久化、迁移或事务回滚证据。包全量历史 SQLite 测试结果在后续回执中单独记录，不据此宣称 #26 SQLite adapter 通过。
- 本次批准界限继续有效：只新增 #26 独占领域合同、Application Service、Repository port、单元测试和本任务回执/计划；SQLite adapter/migration/runner 仍待 #21 合并并由主控移交共享锁。
