# RETAIL-07（GitHub Issue #26）N4–N5 验收回执

Issue / Plan 版本 / 节点：#26 RETAIL-07 / `RETAIL-07-PLAN.md` 与 `RETAIL-07-EXECUTION-PLAN.md` / N4、N5
总体计划/PRD/ADR：已合并的 V0.2 文件；本任务未修改总体计划、DAG 或领域合同。
基线 / 执行 HEAD：`develop/retailops` 基线 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；执行分支 `feat/retail-07`，基线合并提交 `f27d823432e9091ee063439d66c028c50f477565`；当前 Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-07`。
依赖：PR #89 已实际合并后，主控核实并正式移交 SQLite migration lock；实现前既有 migration ledger 为 v1/v2。

## N4：正式 SQLite schema 与持久化验收

### 实际执行与结果

- 新增 migration v3 `0003_draft_revisions.ts`，由 #26 独占。表 `draft_revisions` 使用 `(draft_id, revision)` 主键、合同及 canonicalization 版本、SHA-256 摘要、DRAFTED 初始状态及冻结内容；表 `draft_revision_events` 使用全局唯一 `event_id`、单调 `sequence`、复合外键关联冻结 revision。
- 两张表均安装拒绝 UPDATE/DELETE 的 append-only 触发器。SQL 约束拒绝非法合同/摘要格式、初态、事件类型及无效 JSON。
- `migration-runner.ts` 注册 v3。依据已应用账本版本分别校验 v1、v2、v3 所需 schema；v3 检查列、主/唯一键、复合 FK、外键完整性和四个不可变触发器。存在未登记 v3 表时拒绝启动；迁移后校验在同一事务提交前执行，失败会回滚 v3 表及 ledger。
- SQLite revision adapter 测试由手工造表切换为 `openRetailOpsDatabase` 正式应用 schema；关闭并重开也使用应用 migration runner。验证摘要读回复核、事务内版本分配和事件追加、eventId 全局唯一、重复事件幂等、冲突拒绝、审批/执行 guard、孤立事件 FK 拒绝、revision/event 不可变及重开后历史状态/trace 保留。
- migration 回归覆盖空库 v1→v2→v3、已含合成 v1 数据的 v2→v3 升级、重复迁移、v1 初始化不提前要求 v2/v3、缺表/缺唯一键/缺 FK/缺触发器拒绝、未登记 v3 表拒绝及 v3 schema 校验失败事务回滚。合成旧库只用于 migration fixture，不声称真实历史数据库迁移。
- 正式应用 schema 的真实内存账本由 `migration-runner.test.ts` 及 `database.test.ts` 核对为：`1 initial-retailops-contract-storage`、`2 public-history-import-storage`、`3 draft-revision-append-only-storage`。

### 测试和检查

| 命令 | 退出码 / 实际结果 |
|---|---|
| `npm --prefix apps/retailops test -- --run test/unit/persistence/sqlite/migration-runner.test.ts test/unit/persistence/sqlite/draft-revision-repository.test.ts` | 0；2 个文件、32/32 通过（migration 26，Repository 6） |
| `npm --prefix apps/retailops run build`（WSL Node 24.22.3） | 0；TypeScript 生产构建通过 |
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3） | 0；测试 TypeScript 检查通过 |
| `npm --prefix apps/retailops test`（WSL Node 24.22.3） | 0；16 个测试文件、136/136 通过 |
| `npm run docs:check`（WSL Node 24.22.3，显式 `GIT_DIR` / `GIT_WORK_TREE`） | 0；277 份仓库 Markdown 通过（最终文档状态复跑；临时 Issue 正文文件已移除） |
| `git diff --cached --check`（Windows Git） | 0；暂存差异无 whitespace error |

历史失败记录保留：N4 初次定向回归包含一个 v2 fixture ledger 断言未计入 synthetic v0 行，修正期望后通过。首次全量回归发现既有 `database.test.ts` 仍预期最高 ledger=2；更新为 v3 断言后全量回归通过。未删除或弱化既有测试。早先所有 N1–N3 回执中 108 项既有测试/断言继续保留；本轮仅追加覆盖，并按最终完整测试结果报告总量。

### 三层语义一致性

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| 总体计划 / PRD / Architecture | 草案内容独立于聊天、冻结摘要可复核、trace 可追溯，批准/执行仍受安全门槛控制 | v3 只保存 revision/event；`canTransitionDraft` 继续由应用仓储调用；不产生真实审批或执行能力 | PASS |
| Issue #26 / 执行 Plan | v3 持久化不可变、事务一致、eventId 全局唯一，重放幂等，迁移账本可靠 | adapter 使用正式应用 schema；迁移与账本、schema validation、负向约束测试通过 | PASS |
| N4/N5 节点标准 | v1/v2/v3 升级、回滚、重开、FK/唯一键/触发器及全包回归有实际证据 | 定向 32/32、全包 136/136、build/typecheck/docs:check/diff check 实际通过；PR 信息及 GitHub 状态回读在 N5 补录 | PASS |

## N5：交付与状态同步

- 实际 PR：[#90 Draft 修订正式 SQLite 持久化](https://github.com/2Zest/OpenDot-RetailOps/pull/90)，目标 `develop/retailops`，状态 OPEN / MERGEABLE；创建时 head 为 `69386c78119bacc171d346ac3f8e2e7212461c3a`。未自动合并。
- 本轮初始实施提交：`69386c78119bacc171d346ac3f8e2e7212461c3a`；其后仅追加计划/回执状态的文档提交 `cfb17ff43cd6b4e813072df1b8ee96105a1c435d`。PR HEAD 在最终状态补录后以该 PR 当前 GitHub 读取为准。
- 实际修改路径：`apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts`、`apps/retailops/src/adapters/persistence/sqlite/migrations/0003_draft_revisions.ts`、`apps/retailops/test/unit/persistence/sqlite/database.test.ts`、`apps/retailops/test/unit/persistence/sqlite/draft-revision-repository.test.ts`、`apps/retailops/test/unit/persistence/sqlite/migration-runner.test.ts`、本执行计划及 `RETAIL-07-N0.md`、`RETAIL-07-N1-N3.md`、本回执。没有改 package/lockfile、基础领域合同、共享根注册入口或 #21 实现文件。
- `git diff --cached --check` 退出 0。GitHub 回读确认 Issue #26 为 OPEN、标签 `REVIEW`；Project #2 item `PVTI_lAHODjlUWM4BtKkTzhLw5Eg` 标签 `REVIEW`、Status=`Review`；PR #90 为 OPEN / MERGEABLE，目标 `develop/retailops`。
- Issue #26 保持 OPEN / REVIEW；不得标记 DONE 或关闭。Project #2 同步 REVIEW。
- 不运行真实模型、Harness、MCP、审批、业务执行或 Runtime；不解锁下游任务。#7 仍 BLOCKED。

尚未验证：真实店长审批、Durable/Agent Runtime trace、业务操作副作用、真实用户数据库运行。这些不属于本任务范围。
