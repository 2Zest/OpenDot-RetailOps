# RETAIL-07（GitHub Issue #26）执行计划

**状态：** N0 主控核验通过；已批准 N1–N3 领域/Application/port/单元测试。SQLite adapter/migration 暂停，待 #21 合并并由主控移交锁。
**基线：** develop/retailops `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`
**原 Plan：** `docs/retailops/initial-plan-v0.2/plans/RETAIL-07-PLAN.md`（只读）
**上游：** #20 RETAIL-01P，PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d`。

## 目标与合同

实现独立于聊天会话的 Draft revision、canonical digest、输入/Evidence/Policy revision 绑定和可查询 trace ID。复用 #19 合并合同 v0.3.0、`draftStatusSchema`/`canTransitionDraft`、#20 的 SqliteDraftRepository、Evidence/Policy Repository、事务边界。基础 Draft/Operation 等合同只读。任何 Agent 自报字段都不能构成批准或硬规则证据。

不实现独立风控 Agent、店长审批、实际调价执行、Agent Runtime、Durable 或 MCP。

## 环境与依赖

Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-07`、分支 `feat/retail-07`，基线 HEAD 如上，起始干净。WSL Ubuntu、Node v24.22.3/npm 11.19.1，gh 用户 2Zest。复用 @opendot/retailops v0.1.0/合同 0.3.0、Zod 4.4.3、better-sqlite3 12.11.1、types 7.6.13；不新增依赖、不改包配置。

## 文件所有权

未列路径只读。

| 路径 | 操作/owner | 边界 |
|---|---|---|
| `docs/retailops/plans/RETAIL-07-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-07-N0.md`、后续 `acceptance/RETAIL-07.md` | #26 独占 | 本任务计划和回执 |
| `apps/retailops/src/domain/decision/draft-revision.ts` | 新增/#26 | 不可变 revision 值合同；不改 draft.ts |
| `apps/retailops/src/application/ports/draft-revision-repository.ts` | 新增/#26 | 独立端口；不改共享 retail-repositories.ts |
| `apps/retailops/src/application/use-cases/freeze-draft-revision.ts` | 新增/#26 | 摘要、版本、guard 协调 |
| `apps/retailops/src/adapters/persistence/sqlite/draft-revision-repository.ts` | 新增/#26 | 复用 #20 helpers/事务，不覆盖旧 Repository |
| `apps/retailops/src/adapters/persistence/sqlite/migrations/0003_draft_revisions.ts` | 当前禁止；#21 合并、更新基线及主控转交锁后才可选用下一空版本 | 共享 migration 序列锁 |
| `apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts` | 当前只读；须待 #21 集成后由主控串行授权 #26 | 禁止并行注册 |
| `apps/retailops/test/unit/domain/decision/draft-revision.test.ts`、`test/unit/freeze-draft-revision.test.ts`、`test/unit/persistence/sqlite/draft-revision-repository.test.ts`、`test/contract/draft-revision-trace.test.ts` | 新增/#26 独占 | revision、冲突、持久化、trace 合同 |
| `domain/decision/draft.ts`、`domain/index.ts`、`application/ports/retail-repositories.ts`、#20 files、#21 files、配置/依赖 | 只读/共享锁 | 直接导入 leaf modules；不改公共入口 |

### 共享迁移串行协议

#21 是 migration v2 和 runner 唯一 owner。#26 不创建迁移文件或改 runner；先以独立文件准备，经主控核验后，必须等 #21 合并并刷新 base，主控再根据真实 ledger 分配下一版本。如果无需表结构，本任务不添加迁移。不得竞争版本或引入第二注册机制。

## Revision / digest 候选合同（待 N1 实现）

保存 Draft identity/revision、经 v0.3.0 schema 校验的冻结语义内容、input snapshot、Evidence IDs/content digest、Policy ID+revision，以及 Retail Task、Agent Run、Tool Call 关联。候选 canonical digest 由语义内容、输入快照、Evidence 和 Policy revision 形成；生命周期状态、trace event ID 不进入摘要，避免状态推进/新 trace 改变业务内容摘要。该边界是技术候选，等待主控核验；N0 不改变领域合同、不冻结未批准业务参数。

## N1–N5 节点及检查

| 节点 | 实施与验收 |
|---|---|
| N0 | 依赖、合同、源码、路径、测试发现及迁移锁已检查；等待主控 |
| N1 | 同语义输入摘要稳定；实质修改产生新 revision；历史冻结内容保留 |
| N2 | 所有状态转换复用 canTransitionDraft；非法状态拒绝，冲突证据不通过 |
| N3 | task/run/tool/evidence 可追溯；trace 元数据不授予业务权限 |
| N4 | 负向合同、历史版本、事务回滚与全包回归通过 |
| N5 | 范围审计、独立 PR 到 develop/retailops、Issue/Project 回读 REVIEW |

Vitest 已配置 Node 环境并发现 `test/unit/**/*.test.ts`、`test/contract/**/*.test.ts`。命令：`npm --prefix apps/retailops run build`、`npm --prefix apps/retailops run typecheck`、`npm --prefix apps/retailops test`、`npm run docs:check`、`git diff --check`。N0 不运行源码测试。

## 三层语义检查与安全边界

- 总体计划/Architecture：草案独立于聊天；Trace 可复核；审批与 Runtime 门槛有效。
- Issue/Plan：稳定摘要、不可变版本、状态 guard 和关联 ID；不做审批/执行。
- 节点：内容变化、证据冲突、非法转换、回滚均须有真实测试证据。
- #7 保持 BLOCKED；不运行模型、Harness、MCP 或真实副作用；不启动 #27 或其他下游。


## 主控批准与部分放行（2026-11-27）

主控通过 N0，并批准在不改基础领域合同的前提下开始 N1–N3：领域合同、受信任 Application Service、Repository port 与单元测试。此前“候选合同待核验”段落仅作 N0 提案历史；本节为当前已批准语义：

- 服务计算 SHA-256，canonicalization 版本 `retail-draft-canonical-json-v1`；对象键按 Unicode 码点升序，数组按现有合同顺序保留，不排序或隐式去重。
- 摘要覆盖业务内容/候选操作参数、完整 input snapshot、Evidence 合同内容摘要、Policy ID/revision。精确数量与金额字符串原样参与，不转浮点、不改变 scale。
- 生命周期状态、trace event ID、task/run/tool 关联和非业务时间元数据不参与摘要。忽略 Agent 自报 digest、批准状态、硬规则通过证据；新业务内容产生新 revision，旧版本保留且不继承批准。
- 状态转换使用现有 `canTransitionDraft`；相同 event ID+语义请求幂等，复用 event ID 但内容不同则拒绝。未经可信应用来源确认的批准/硬规则证据拒绝。
- 本次部分放行不包含 SQLite adapter、migration 或 `migration-runner.ts`。上述路径继续锁定，等 #21 合并、刷新 develop 并由主控移交迁移锁后再做。
- 内存 Repository 替身只用于应用逻辑测试，不作为 SQLite 持久化通过证据。Issue #7 仍 BLOCKED；不运行模型、Harness、MCP 或真实业务副作用。
