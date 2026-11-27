# RETAIL-07（GitHub Issue #26）执行计划

**状态：** N0–N4 已执行；#21 合并后主控已于 2026-11-27 移交 migration lock，#26 独占 v3 migration/runner。N5 集成检查与 PR 提交完成后进入 REVIEW。
**最初基线：** develop/retailops `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`；迁移锁交接后的集成基线为 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`。
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
| `apps/retailops/src/adapters/persistence/sqlite/migrations/0003_draft_revisions.ts` | 已获迁移锁交接；#26 独占 | v3 migration；只创建 Draft revision/event 存储 |
| `apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts` | 已获迁移锁交接；#26 独占 | 注册 v3 并验证 v3 表、唯一键、FK、不可变触发器及账本 |
| `apps/retailops/test/unit/domain/decision/draft-revision.test.ts`、`test/unit/freeze-draft-revision.test.ts`、`test/unit/persistence/sqlite/draft-revision-repository.test.ts`、`test/contract/draft-revision-trace.test.ts` | 新增/#26 独占 | revision、冲突、持久化、trace 合同 |
| `domain/decision/draft.ts`、`domain/index.ts`、`application/ports/retail-repositories.ts`、#20 files、#21 files、配置/依赖 | 只读/共享锁 | 直接导入 leaf modules；不改公共入口 |

### 共享迁移串行协议

历史记录：#21 是 migration v2 和 runner 唯一 owner。#26 在 #21 合并前不创建迁移文件、不改 runner。主控确认 #21 实际合并、基线刷新及账本后，于 2026-11-27 正式将 SQLite migration lock 移交 #26；本任务因此独占 migration v3 和 runner 注册。其他任务仍不得修改共享 migration runner 或迁移序列。

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

## N1–N3 应用层实现补充

根据已批准的摘要合同，冻结 Revision 内容显式保存 Product/Batch 合同快照、Operation 参数快照、input snapshot、Evidence 内容摘要与 Policy 完整版本。应用服务在计算摘要前重新校验来源合同版本及跨引用：Operation draftId/Product/Batch 与 Draft/input snapshot 一致，Batch 归属所列 Product，Evidence 属于同一 input snapshot，Policy ID/revision 和其 Evidence 属于同一快照。Schema 再校验这些引用关系；违反关系或 #19 Operation 非负售价约束的快照拒绝保存。

Canonicalization v1 的对象键 comparator 按 Unicode code point 排序，数组保留合同顺序，精确金额/数量字符串不规范化。状态转换仍只调用 `canTransitionDraft`；Application command 不接受 Agent 自报风险、审批、预检或执行证据。N1–N3 的实际结果与完整检查见 `../acceptance/RETAIL-07-N1-N3.md`。SQLite revision 持久化仍暂停，未将内存替身结果表述为持久化验收。

## SQLite Adapter 准备（初始共享迁移锁边界，历史记录）

`SqliteDraftRevisionRepository` 只依赖两张由迁移提供的表，不会自行建表：`draft_revisions` 以 `(draft_id, revision)` 为主键，存储合同版本、canonicalization 版本、digest、初始状态及冻结事件 payload，并要求迁移创建拒绝 UPDATE/DELETE 的不可变触发器；`draft_revision_events` 以全局唯一 `event_id` 和递增 `sequence` 保存创建/状态事件，并以 `(draft_id, revision)` 外键关联冻结 revision。N0 已分配 `draft-revision-repository.ts` 和 `test/unit/persistence/sqlite/draft-revision-repository.test.ts` 给 #26；#26 不拥有 migration 文件或 migration-runner。

Adapter 在单一同步事务中分配下一 revision、写冻结内容和创建事件；状态事件在同一写事务读取当前事件链、核对 `fromStatus` 并运行 `canTransitionDraft(current, to, {})` 后追加。未提供可信状态证据时不能经仓储进入 APPROVED、PRECHECK、EXECUTING 等状态。重复 eventId + 同语义返回原事件，冲突拒绝。读回时重新校验 schema、规范化列和 canonical digest；内容只有 INSERT 路径，仓储不提供覆盖更新。

当时迁移锁未移交，SQLite adapter 测试仅在显式手工建立的内存 test schema 上验证，不代表正式迁移集成通过。该限制在 #21 合并、同步基线、核实 v1/v2 ledger 并由主控正式交接迁移锁后解除；当前验收依据以本文件末尾“N4/N5 迁移锁移交与正式 schema 实施记录”和 `acceptance/RETAIL-07-N4-N5.md` 为准。

## N4/N5 迁移锁移交与正式 schema 实施（2026-11-27）

- 主控核验 PR #89 已合并；锁交接基线 `develop/retailops` 为 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`。在原 Worktree / 分支 `feat/retail-07` 安全合入该基线，生成合并提交 `f27d823432e9091ee063439d66c028c50f477565`；没有 reset、强推或覆盖未提交文件。
- 打开真实 RetailOps 应用 SQLite schema 前，原 migration ledger 确认为 v1/v2；实现后 `openRetailOpsDatabase(':memory:')` 实际 ledger 为 v1/v2/v3：`1 initial-retailops-contract-storage`、`2 public-history-import-storage`、`3 draft-revision-append-only-storage`。
- N4 实现正式 `0003_draft_revisions.ts`：Draft ID + revision 复合主键；全局唯一 eventId；revision/event 外键；JSON、合同版本、canonicalization 版本、SHA-256 格式和 DRAFTED 初态约束；revision 与 event 的 UPDATE/DELETE 拒绝触发器。
- `migration-runner.ts` 注册 v3，并按已记账版本分别校验 v1/v2/v3 列、唯一键、外键完整性；v3 另外校验四个不可变触发器。无 v3 ledger 而已有任一 v3 表时拒绝；v3 migration 后验证失败会在同一事务回滚表、触发器及 ledger 记录。v1 初始化不会提前要求 v2/v3 schema。
- Repository 测试改为使用 `openRetailOpsDatabase` 创建正式应用 schema；落盘关闭并重开同样重跑正式 migration runner。验证 revision/event 不可变、全局 eventId、摘要重算、事务回滚、FK 拒绝孤立事件、状态 guard、相同事件幂等和重开历史保留。
- N4/N5 定向及全包检查结果、实际失败重试记录、修改清单和三层语义检查见 `docs/retailops/acceptance/RETAIL-07-N4-N5.md`。原 N1–N3 领域合同与 108 项既有测试/断言保留；新增迁移回归测试另行计数。未实现审批、审批状态授权、业务执行、Runtime 或下游功能。
