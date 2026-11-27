# RETAIL-01P（GitHub Issue #20）N3 节点回执：Repository 与事务

- 节点目标：实现应用层 Repository ports 与 SQLite adapters，所有写入先经 v0.3.0 schema 校验并事务化，读取校验 payload、规范化列和有序关系。
- 基线/Worktree/分支：`8ca176ff3f9e5990b6c2487e41be2953e682c192` / `D:/workSpace/codeAgent/OpenDot-RetailOps-01p` / `feat/retail-01p`。
- 实际文件：`apps/retailops/src/application/ports/retail-repositories.ts`；`apps/retailops/src/adapters/persistence/sqlite/{database,evidence,product,policy,batch,draft,operation}-repository.ts`；测试 `apps/retailops/test/unit/persistence/sqlite/repositories.test.ts`、`apps/retailops/test/contract/persistence/sqlite/repository-contract.test.ts`。
- 写入边界：`safeParse` 后开始事务写入主记录与关系引用；任一失败整体回滚。读取时 JSON parse + schema safeParse，再逐项比对规范化列和 position 排序的关系表，损坏/漂移返回 `CorruptPersistedEntityError`。金额、数量、时间与来源保留合同字符串，不做 JS 浮点换算。
- 测试：定向命令 `npm test -- test/unit/persistence/sqlite test/contract/persistence/sqlite` 退出码 `0`，4 files / 15 tests passed。覆盖六实体 v0.3.0 往返、文件 DB 关闭/重开、invalid input、FK 失败、主键唯一性、跨 Evidence/Product Repository 人为抛错后全表回滚、规范化列/JSON/关系引用损坏拒读。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 业务事实可靠且可恢复，Runtime memory 不作为账本 | 仅 SQLite Repository 和业务表；不接 Harness、Home DB 或 checkpoint | PASS |
| Issue #20 / Plan | 端口/适配器分层、合同运行时校验、跨 Repository 原子性 | Domain 只读；application ports 不依赖 SQLite；写读均校验 | PASS |
| N3 节点验收 | 精度、来源、引用、回滚与损坏拒读有回归测试 | 六实体合同测试精确往返；跨库表回滚及 corruption tests 通过 | PASS |

- 失败/修订：首轮定向测试曾因测试对 SQLite 错误文案断言过严（期望 `SQLITE_CONSTRAINT_PRIMARYKEY`，实际为 `UNIQUE constraint failed: products.id`）失败；收窄到实际唯一约束语义后复测通过。新增合同测试首轮误用不存在的 `available_to_sell` 规范化列，改用实际 `quality_status` 列后复测通过。失败未隐藏。
- 未验证：完整包/文档/范围检查记录在 N4/N5。
- 决定：N3 PASS，继续 N4。日期：2026-11-27（Asia/Shanghai）。
