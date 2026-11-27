# RETAIL-07（GitHub Issue #26）N1–N3 阶段回执

- 状态：N1–N3 的领域合同、Application Service、Repository port 与单元测试已完成。SQLite adapter / persistence integration 尚未放行；任务整体维持 IN_PROGRESS，当前停在共享迁移锁等待点。未创建 PR、未标 DONE。
- 日期：2026-11-27（Asia/Shanghai）。
- 基线：`develop/retailops` `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`；本 Worktree 初始 N0 文档 HEAD `c758ca355474eb431f6346f87f80084e77a6e90d`，批准回执 commit `c58a5de2d884100d68837a683c0c9873e6d08ad6`。
- Worktree / 分支：`D:/workSpace/codeAgent/OpenDot-RetailOps-07` / `feat/retail-07`。
- 主控决定：批准 N1–N3 仅覆盖独立领域合同、受信任 Application Service、Repository port 和测试；#21 合并后再刷新基线，由主控移交迁移锁。现有 #19 v0.3.0 合同只读，#20、#21 及共享入口只读。
- 工具链：WSL Node `v24.22.3` / npm `11.19.1`。`npm ci` 使用现有 lockfile，退出 0，未修改依赖文件。安装输出提示 better-sqlite3 安装脚本受当前 allowScripts 策略跳过；本任务没有手动放宽策略。完整包 SQLite 历史测试通过，但不是 #26 revision SQLite adapter 的实现或持久化验收证据。

## N1：不可变业务 Revision 与 canonical digest

- 实际动作：新增 DraftRevision 严格 schema、版本号 `retail-draft-canonical-json-v1` 和受信任 freeze Application Service。服务读取并校验 Draft、Operation、Product、Batch、Evidence、Policy 来源合同；忽略 Draft 自报 digest/status 和 Agent 自报审批/硬规则字段；基于服务端重新读取的事实生成快照、Evidence 内容摘要和 SHA-256。
- 合同内容：绑定候选操作参数、Draft/input snapshot、Product/Batch 快照、Evidence 内容 digest、Policy ID/revision 与 Policy 内容。Operation 的 `draftId/productId/batchId` 必须与 Draft、input snapshot 和对应 Batch/Product 一致；Batch Product 必须属于同一快照；Evidence 必须属于同一 snapshot 且被全部引用方声明；Policy ID/revision 与 snapshot 一致且其 Evidence 全在 snapshot 内。各来源合同版本必须与 Draft 一致。schema 重复校验持久化 Revision 内跨引用关系，MARKDOWN proposedPrice 复用 #19 Operation 的非负价格 schema。
- Canonicalization：递归对象键按 Unicode code point 升序比较（显式 comparator，不用 JS 默认 UTF-16 排序），数组顺序保留；精确金额/数量字符串不转数值、不改 scale；生命周期状态、trace/event ID 和 task/run/tool 关联不进入业务 digest。
- 版本语义：无实质语义变化时可得到相同 digest；实质操作、输入、Evidence、Policy、Product 或 Batch 内容变化会生成下一个 revision，并保留旧 revision。新版本初始状态固定为 DRAFTED，不继承批准。
- 负向回归：覆盖负 proposedPrice、重复/未知/冲突引用、Operation draft 不匹配、Product/Batch 不一致、Evidence snapshot 错误、Policy 不存在或 revision 不符，以及对象键 U+E000/U+10000 排序和数组顺序语义。
- 判定：PASS（领域/API 层）。不代表任何 SQLite 持久化通过。

## N2：状态变更 guard 与幂等事件

- 实际动作：新增 append-only DraftRevision 状态事件与 Application transition 方法，只调用既有 `canTransitionDraft`；没有复制状态机。相同 event ID、同一事件语义和 trace 重放返回既有事件；同 ID 变更内容/目标/trace 拒绝。未知运行时状态和 Agent 自报 risk/approval/precheck 字段拒绝。
- 当前无可信状态证据输入，因此需要可信证据的转换明确拒绝：RISK_REVIEW→AWAITING_MANAGER/风险结论、AWAITING_MANAGER→审批结论、APPROVED→PRECHECK/撤销/过期、PRECHECK→EXECUTING/FAILED/CANCELLED/UNCERTAIN、EXECUTING→完成/失败/取消/UNCERTAIN、UNCERTAIN→对账完成/失败。由现有 guard 明确允许的 DRAFTED→RISK_REVIEW，以及可无证据的通用取消/STALE 规则仍按原合同工作；应用服务不会声称这些变化等于审核授权。
- 判定：PASS（受信任证据缺席时 fail closed；真实风控、审批、执行及对账均未实现）。

## N3：Trace 关联与权限边界

- 实际动作：revision/status event 保存 `taskId`、可选 `agentRunId` 和 `toolCallIds`；这些 ID 不进入业务 digest，也不作为 Runtime 真实发生、业务批准或执行授权的证明。实现限定为关联字段和 Repository port；无 Runtime、Durable、MCP 调用。
- 判定：PASS（结构化可追溯关联）；真实 Runtime 真实性不在本节点声明。

## 修改文件

- 新增 `apps/retailops/src/domain/decision/draft-revision.ts`
- 新增 `apps/retailops/src/application/ports/draft-revision-repository.ts`
- 新增 `apps/retailops/src/application/use-cases/freeze-draft-revision.ts`
- 新增 `apps/retailops/test/unit/domain/decision/draft-revision.test.ts`
- 新增 `apps/retailops/test/unit/freeze-draft-revision.test.ts`
- 更新 `docs/retailops/plans/RETAIL-07-EXECUTION-PLAN.md`
- 更新 `docs/retailops/acceptance/RETAIL-07-N0.md`
- 新增本回执 `docs/retailops/acceptance/RETAIL-07-N1-N3.md`

未修改 `package.json`、lockfile、`domain/index.ts`、`retail-repositories.ts`、基础 Draft/Operation 合同、SQLite adapter、migration、`migration-runner.ts` 或 #21 Worktree 文件。

## 测试及检查结果

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm ci`（现有 `package-lock.json`，WSL Node 24） | 0 | 安装完成；遵守 allowScripts 跳过本地 better-sqlite3 构建脚本提示，没有改依赖或策略 |
| `npm --prefix apps/retailops test -- test/unit/domain/decision/draft-revision.test.ts test/unit/freeze-draft-revision.test.ts` | 0 | 2 个文件、14 项通过 |
| `npm --prefix apps/retailops run build` | 0 | TypeScript 生产构建通过 |
| `npm --prefix apps/retailops run typecheck` | 0 | 测试代码类型检查通过 |
| `npm --prefix apps/retailops test` | 0 | 11 个文件、101/101 通过；含原有 87 项及本任务 14 项 |
| `npm run docs:check`（设置 WSL `GIT_DIR`/`GIT_WORK_TREE` 指向实际 worktree） | 0 | 272 份仓库 Markdown 通过 |
| `git diff --check`（Windows Git） | 0 | 无 diff whitespace error；仅显示现存 LF/CRLF 转换提示 |

历史失败保留：首次 WSL `docs:check` 退出 1，因为 worktree `.git` 文件使用 Windows `D:/...` gitdir，WSL 无法解析。显式设置真实 WSL `GIT_DIR`/`GIT_WORK_TREE` 后复跑通过。早期定向测试中两个 `toBe` 对象身份断言失败（服务安全解析后返回等值对象）；改为结构等值断言。随后加入 Evidence `snapshotId` 失配负测，确认缺少校验时会失败；实现关系拒绝后定向与全量复测通过。失败记录未删除。

## 三层语义一致性

| 层次 | 验证 | 判定 |
|---|---|---|
| 总体计划 / 已批准 Architecture | revision 与聊天会话分离、摘要可复算、证据和政策可追溯；审批/运行真实性仍需真实受信流程；未扩展 Runtime | PASS |
| Issue #26 / RETAIL-07 Plan | Draft content immutable、实质修改新 revision、复用 guard、trace 关联、幂等事件、无模型/审批/执行 | PASS |
| N1–N3 节点标准 | 2 定向测试文件 14/14；包 build/typecheck 与 101/101 全回归通过；状态 guard 和引用冲突负测通过 | PASS |

## 阻塞与后续

- N4 的 SQLite adapter、事务原子性/回滚、重开恢复、revision SQLite 查询和 persistence integration 未开始，当前标为 BLOCKED/PARTIAL：#21 尚未合并且主控尚未移交共享 migration lock。
- 当前安全停止点：可以安全提交/push 本回执及独立领域/Application/port 文件；不得新增 migration、改 runner、注册共享入口或创建 PR。待 #21 实际合并、刷新 `develop/retailops`、主控确认 ledger 并转交锁后，才继续 SQLite adapter、持久化测试、N4/N5。
- Issue #26 和 Project #2 保持 IN_PROGRESS；#22 保持 READY 未认领；#7 保持 BLOCKED。未运行真实模型、Harness、MCP、Durable 或业务副作用。

## SQLite adapter 准备追加记录（2026-11-27）

根据本轮授权新增独立 `SqliteDraftRevisionRepository` 及 SQLite adapter 单测，但不创建 migration、不修改 `migration-runner.ts`。测试仅在显式创建的隔离 SQLite test schema 上运行；不代表正式应用 schema、迁移集成或持久化节点验收已通过。

adapter 所需正式 schema 合同：

- `draft_revisions`：`PRIMARY KEY(draft_id, revision)`；记录 `contract_version`、`canonicalization_version`、`canonical_digest`、`initial_status` 和不可变 revision payload；正式 migration 必须拒绝 UPDATE/DELETE。
- `draft_revision_events`：全局 `UNIQUE(event_id)`、递增 `sequence`、`draft_id/revision`、事件类型和 payload；外键关联 revision。

`appendRevision` 在一个同步事务内读取当前最大 revision、分配下一版、插入冻结快照并追加创建事件。`appendStatusEvent` 在事务内重新读取状态事件链、核对 `fromStatus`，并用无可信证据的 `canTransitionDraft` guard 校验目标状态后追加。不能通过仓储直接进入 APPROVED 或 EXECUTING。相同事件幂等、eventId 冲突拒绝；读取 revision 时重算 canonical digest，修改后的冻结 payload 会作为损坏数据拒绝。Adapter 没有覆盖更新方法。

为满足“首次成功后源数据变化仍按同一事件幂等”，Application Service 现在在访问当前 Draft/Product/Batch/Evidence/Policy 前先按 eventId + Draft ID + trace 查找已完成事件；相同命令返回原 revision，eventId 语义冲突仍拒绝。

| 测试/命令 | 实际结果 |
|---|---|
| 首次完整 build + typecheck + test | build 退出 0；typecheck 退出 0；test 退出 1，108 项中 107 项通过。旧冲突测试把“源记录更新”作为 eventId 语义冲突，与本轮明确批准的新幂等语义冲突；测试改为验证 trace 改变时拒绝，并保留独立的源数据变化幂等回归 |
| `npm --prefix apps/retailops run build`（WSL Node 24.22.3） | 退出 0 |
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3） | 退出 0 |
| `npm --prefix apps/retailops test`（WSL Node 24.22.3） | 退出 0；12 个测试文件、108/108 通过，其中新 SQLite adapter 文件 6 项通过 |
| `npm run docs:check`（WSL Node 24、实际 Worktree Git 环境） | 退出 0；272 份仓库 Markdown 通过 |
| `git diff --check` / `git diff --cached --check` | 均退出 0；最终暂存范围为 8 个 #26 独占文件 |
| SQLite 适配器测试证据 | 唯一 revision key、全局 eventId、冻结记录 UPDATE/DELETE 拒绝、摘要回读、追加失败事务回滚、审批/执行越权拒绝、关闭重开后 trace/state/revision 保留均通过；全部使用人工测试 schema，无正式 migration |

新增/更新文件：`src/domain/decision/draft-revision.ts`（共享 canonical digest 算法和 revision seed schema）、`src/application/ports/draft-revision-repository.ts`、`src/application/use-cases/freeze-draft-revision.ts`、新增 `src/adapters/persistence/sqlite/draft-revision-repository.ts`、更新 `test/unit/freeze-draft-revision.test.ts`、新增 `test/unit/persistence/sqlite/draft-revision-repository.test.ts`、本执行计划及本回执。migration 与 runner 保持未修改。#21 尚未合并及迁移锁尚未移交，因此 N4 正式 SQLite 持久化验收仍为 BLOCKED；不创建 #26 PR，不改变 Issue/Project 状态。
