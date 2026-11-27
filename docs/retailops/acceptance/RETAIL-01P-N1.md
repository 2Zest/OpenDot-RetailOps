# RETAIL-01P（GitHub Issue #20）N1 节点回执：迁移与连接边界

- 节点目标：建立 RetailOps 独立 SQLite 连接、版本迁移、外键校验及可回滚初始化；dist 能加载迁移定义。
- 执行基线：develop/retailops `8ca176ff3f9e5990b6c2487e41be2953e682c192`；Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-01p`，分支 `feat/retail-01p`。本节点代码在工作树中，待提交。
- 依赖：#19 / PR #86 已以 `8ca176ff3f9e5990b6c2487e41be2953e682c192` 合并；领域合同 `0.3.0`。better-sqlite3 `12.11.1` 与 @types `7.6.13` 已由用户明确批准。
- 实际文件：`apps/retailops/package.json`、`apps/retailops/package-lock.json`、`apps/retailops/src/adapters/persistence/sqlite/database.ts`、`migration-runner.ts`、`migrations/0001_initial.ts`、`apps/retailops/test/fixtures/persistence/sqlite/legacy-retailops-v0.sql`、本回执及执行 Plan。
- 迁移资源路径决策：主控批准将最初冻结的 `migrations/0001_initial.sql` 改为 `migrations/0001_initial.ts`，由现有 `tsc` 纳入 dist，避免构建脚本变更。合成历史 RetailOps fixture 保留 SQL；不声称其为真实旧库。决策理由与唯一 owner 记录在执行 Plan。
- SQLite 迁移建立 `retailops_schema_migrations`、版本 1；启用并校验 FK，迁移单元和 ledger 写入事务化，检查 `foreign_key_check`。`openRetailOpsDatabase` 必须接收显式路径，迁移失败时关闭连接。测试只用 `:memory:` 或系统临时目录。

## 实际命令与结果

- WSL Ubuntu 24.04 / Node `v24.22.3` / npm `11.19.1`：`npm ci`（`apps/retailops`）退出码 `0`，安装 86 packages；npm 报告 3 项审计告警（2 moderate、1 high），并提示 better-sqlite3 install script 的 allowScripts 警告。未更换版本、未更改全局配置。
- `node -e` 加载 better-sqlite3 并在 `:memory:` 执行查询：退出码 `0`，实际加载版本 `12.11.1`，SQLite `3.53.2`。此前同一探针曾因命令行引号导致 Node 语法错误；修正探针后通过。
- 首次 DDL 迁移冒烟失败：SQLite 报迁移定义存在尾逗号；移除尾逗号后复测。该失败被保留，不作为通过证据。
- `npm run build`：退出码 `0`。`dist` 冒烟最初一次查询因 shell SQL 引号错误退出码 `1`；改用参数化查询后，动态导入 `dist/adapters/persistence/sqlite/migration-runner.js` 并迁移 `:memory:` 成功，退出码 `0`，输出 `{"version":1,"products":"products","foreignKeys":1}`。
- `npm test -- test/unit/persistence/sqlite test/contract/persistence/sqlite`：修复两个测试脚本自身的断言/列名错误后，退出码 `0`；4 个测试文件、15 项通过。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | RetailOps 业务事实存储与 Home/Runtime 隔离，持久化可迁移 | 独立包路径、显式 DB path、包内 schema/version ledger；未连接 Home/真实数据 | PASS |
| Issue #20 / Plan | 精确获批依赖、版本迁移、真实 Native load、dist 可访问迁移资源 | npm ci、better-sqlite3 实际加载及 dist migration 输出见上；合成旧库 fixture 明确标注 | PASS |
| N1 节点验收 | 空库/版本迁移、外键、迁移失败回滚及迁移资源构建路径可验证 | 定向测试覆盖空库与重复迁移、合成 fixture 成功升级及迁移失败回滚；build/dist 冒烟成功 | PASS |

- 历史失败与修复：DDL 尾逗号已修复；首次 native 探针的 shell 引号错误、dist 冒烟查询引号错误均已修正并复测通过，均保留在本记录。
- 未验证：还未完成最终全部包与仓库检查；N2–N5 在后续回执记录。
- 决定：N1 PASS，继续 N2。日期：2026-11-27（Asia/Shanghai）。

## 独立 Review REQUEST_CHANGES 修订记录（2026-11-27）

- 复核迁移账本与真实 schema：版本和名称必须匹配；未知/错名版本、缺失已应用版本记录、缺表/缺列、缺少或错误外键、既有 FK 数据损坏均拒绝打开。校验在迁移事务提交之前完成，已存在版本的 schema 也会复核。
- 将必要主键/唯一键纳入 schema guard：使用 `PRAGMA table_info`、`index_list`、`index_info` 比较键列及顺序；覆盖实体主键、关系顺序键、Policy `(id, revision)`、`draft_operations(operation_id)` 唯一归属约束。保持 0001 迁移版本不变。
- 新增删除 `draft_operations(operation_id)` UNIQUE 的错配测试。临时停用 guard 时该测试退出码 1（1 failed、9 skipped，缺少约束未被拒绝）；恢复 guard 后相同测试退出码 0（1 passed、9 skipped）。临时停用仅用于验证测试，未作为代码变更保留。
- 所有迁移/schema 验证仍只运行于内存测试 DB 或明确标注的合成 fixture，不连接真实数据库。
