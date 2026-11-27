# RETAIL-01P（GitHub Issue #20）执行 Plan

状态：N0 已经主控核验通过；2026-11-27 用户批准 SQLite 精确依赖版本；N1–N5 正在执行。此文档细化原始 Plan，不替代或修改其 N0–N5 语义。

## 基线、授权与上游

- 集成基线：develop/retailops 8ca176ff3f9e5990b6c2487e41be2953e682c192。
- 当前 worktree：D:/workSpace/codeAgent/OpenDot-RetailOps-01p；分支：feat/retail-01p，由上述基线创建，工作树在 N0 预检时干净。
- 授权：用户已认领 GitHub Issue #20；Issue 当前 Open / IN_PROGRESS，执行人为 2Zest。Project #2 状态回读为 In Progress。
- 上游证据：
  - RETAIL-01（GitHub Issue #19）：PR #86 已合并，merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192；合并合同版本 0.3.0，验收记录包含原领域合同测试。
  - RETAIL-00A-01（GitHub Issue #6）：PR #73 merge SHA b22ed421b22e6fa06b8fe9821e916ff48adf9524；Issue #6 已 Closed / DONE，Project #2 为 Done。
- 当前 Node 环境：WSL Ubuntu 24.04，Node v24.22.3、npm 11.19.1；CPU 20 逻辑核，可用内存约 14 GiB，/mnt/d 可用空间约 610 GB。N0 未执行数据库或高负载工作。
- 输入：领域合同 apps/retailops/src/domain/**（只读，合同版本 0.3.0）、RETAIL-01P 原始 Plan、总体架构、路径所有权规范与 Project 状态规范。

## 目标与不变量

将现有 Product、Batch、Policy、Evidence、Draft、Operation 合同存为可恢复的业务事实；提供应用层 Repository 端口和 SQLite 适配器。所有持久化写入和读取都通过 v0.3.0 领域 Schema 校验；保持数量和金额的原始精确字符串、单位、货币/尺度、合同版本、时间、证据来源引用。事务失败必须整体回滚，关闭并重开临时数据库后数据仍可读取。业务事实不存入聊天 JSONL、Agent Memory 或 Runtime Checkpoint。

领域层不得依赖 SQLite、Repository 实现、Harness、模型或宿主私有模块。不得碰 Home DB、真实用户数据或 Runtime DB。

## 文件所有权与锁

本任务在 N0 经主控核验通过的写入范围如下。未列文件视为只读；新增代码严格限于 apps/retailops/**。SQLite 依赖已由用户批准，N1–N5 可在该冻结范围内执行。

| 路径 | 权限 / 唯一 owner | 用途与限制 |
|---|---|---|
| docs/retailops/plans/RETAIL-01P-EXECUTION-PLAN.md | 新增；#20 | 本细化 Plan |
| docs/retailops/acceptance/RETAIL-01P-N0.md、docs/retailops/acceptance/RETAIL-01P-N1.md、docs/retailops/acceptance/RETAIL-01P-N2.md、docs/retailops/acceptance/RETAIL-01P-N3.md、docs/retailops/acceptance/RETAIL-01P-N4.md、docs/retailops/acceptance/RETAIL-01P-N5.md | 新增；#20 | 六个精确节点回执文件；逐节点追加事实，不覆盖历史失败 |
| apps/retailops/src/application/ports/retail-repositories.ts | 新增；#20 | Product、Batch、Policy、Evidence、Draft、Operation 最小端口；不导入 SQLite |
| apps/retailops/src/adapters/persistence/sqlite/database.ts | 新增；#20 | 打开/关闭专属 SQLite 连接、外键启用及边界 |
| apps/retailops/src/adapters/persistence/sqlite/migration-runner.ts、apps/retailops/src/adapters/persistence/sqlite/migrations/0001_initial.sql、apps/retailops/test/fixtures/persistence/sqlite/legacy-retailops-v0.sql | 新增；#20 | 迁移 runner、首个 RetailOps schema 迁移、隔离的旧版 RetailOps 测试 fixture；不接入根/Home DB |
| apps/retailops/src/adapters/persistence/sqlite/product-repository.ts、apps/retailops/src/adapters/persistence/sqlite/batch-repository.ts、apps/retailops/src/adapters/persistence/sqlite/policy-repository.ts、apps/retailops/src/adapters/persistence/sqlite/evidence-repository.ts、apps/retailops/src/adapters/persistence/sqlite/draft-repository.ts、apps/retailops/src/adapters/persistence/sqlite/operation-repository.ts | 新增；#20 | 六项既有领域合同的持久化映射；不创建重复领域模型 |
| apps/retailops/test/unit/persistence/sqlite/database.test.ts、apps/retailops/test/unit/persistence/sqlite/migration-runner.test.ts、apps/retailops/test/unit/persistence/sqlite/repositories.test.ts | 新增；#20 | SQLite 连接、迁移和事务/约束单元测试 |
| apps/retailops/test/contract/persistence/sqlite/repository-contract.test.ts | 新增；#20 | Repository 与 v0.3.0 合同往返/约束测试 |
| apps/retailops/package.json、apps/retailops/package-lock.json | 暂列为 #20 唯一候选 owner；依赖决策门禁 | 仅在主控明确批准后，允许增加独立包的 SQLite driver 和类型；未批准前只读，不安装依赖、不改锁文件 |
| apps/retailops/src/domain/**、现有 test/unit/**、test/contract/** | 只读；领域合同 owner | 只运行和引用；不改 v0.3.0 合同或弱化原测试 |
| 根 package.json / package-lock.json / tsconfig.json，根 src/**、根迁移入口、apps/cloud-agent/**、shared/**，GitHub Issue/Plan/DAG 原文 | 只读；共享 owner / 主控 | 不修改、不注册到 Home DB 或宿主 |
| 另一任务 #24 的领域算法、测试及回执文件 | 只读；#24 独占 | 与 #20 无可写路径交叉 |

### 依赖决策与批准记录

apps/retailops 是独立包并有专属 package.json/package-lock.json。SQLite 适配器需要可在本包独立运行的 driver。主控依据根锁文件核验后，用户于 2026-11-27 批准精确版本 better-sqlite3 12.11.1 与 @types/better-sqlite3 7.6.13，并授予 #20 独占修改该独立包 manifest 和 lockfile 的权限。此批准不涵盖改动根依赖。

不得更换已批准版本，不得改根依赖或复用宿主 node_modules 作为运行时依赖。必须在 WSL Node 24 中实际验证 native module 安装和加载；失败时记录原因并暂停受影响步骤，不通过全局配置或版本替换规避。

## N1–N5 具体执行与验收

| 节点 | 工作及冻结边界 | 验收标准 / 证据 |
|---|---|---|
| N1 迁移设计 | 在批准的专属包内实现版本化 migration runner、外键开启、事务和失败回滚策略。根 src/db.ts、Root schema_version 及 Home migration 链只读。不存在既有 RetailOps 数据库；“旧库升级”只能以明确标识的旧版 RetailOps schema 临时 fixture 验证，不声称兼容 Home DB。 | 空库建库、重复迁移、旧 RetailOps fixture 升级和迁移失败回滚都可重复；提供临时 DB 路径、schema version 和证据。 |
| N2 表与约束 | 按 v0.3.0 合同建立最小 Product、Batch、Policy、Evidence、Draft、Operation 持久化结构；标明主键/外键、唯一键、contract version、必要索引。具体列仅承载已批准合同字段与引用，不推导未批准业务值。 | FK 开启且违反 FK / 唯一约束写入失败；合同版本和证据关联可核验；所有对象经领域 Schema 校验。 |
| N3 事务及 Repository | 实现最小端口与 SQLite 适配器；写前、读后运行时 safeParse；精确字符串不得经 JS 浮点转换。跨表操作通过事务原子提交。 | 逐类 create/read/update 所允许字段往返一致；多步事务中途人为注入失败后全量回滚；关闭/重开后数据和引用完整。 |
| N4 定向与回归 | 使用临时目录/临时数据库运行全部持久化测试及现有领域合同测试，不读取用户数据库。保留所有既有断言。 | 覆盖空库、重复迁移、旧 RetailOps fixture、FK/唯一、非法数据、精度/来源往返、事务回滚、重开恢复、原有合同；build/typecheck/test 全部记录命令、退出码和数量。 |
| N5 交付 | 生成逐节点回执、文件范围/差异审查和 PR 说明；推送独立分支并创建目标 develop/retailops 的 PR，不合并。 | docs:check、git diff --check、文件范围检查及规定包 build/typecheck/test 的真实结果齐全；Issue/PR/Project 回读为 REVIEW；不标 DONE。 |

## 命令与发现范围

环境固定 WSL Ubuntu 24.04 / Node 24 / npm 11，使用 apps/retailops 专属 lockfile。N0 计划文档检查命令为根目录 npm run docs:check 和 git diff --check。N4 预期执行：

- 在 apps/retailops：npm ci（已批准的 package-local 精确依赖）、npm run build、npm run typecheck、npm test。
- 定向持久化：npm test -- test/unit/persistence/sqlite 和 npm test -- test/contract/persistence/sqlite（路径按实际测试文件调整并记录）。
- 测试发现配置保持既有 test/unit/**/*.test.ts、test/contract/**/*.test.ts，不改 Vitest 配置。
- N5 根目录 npm run docs:check、git diff --check，并核对仅本 Plan 允许路径有变化。

## 未决参数与暂停条件

- SQLite driver 及类型依赖版本已批准（12.11.1 / 7.6.13）；仍须验证本机 Node 24 的真实安装和加载，不得更换版本或全局配置。
- 实际字段/索引需由 v0.3.0 合同决定；不扩充领域业务字段，不发明真实数据。
- “旧数据库”只以可追溯的历史 RetailOps schema fixture 表示；若验收实际要求升级 Home DB，则超出安全边界，应暂停并提变更请求。
- 若独立包中无法无损表示现有合同精度、时间、证据/版本，停止并提交具体兼容方案；不得降级 schema 或浮点化。
- 不实现审批服务、业务执行、算法、Agent、MCP、API、UI、完整业务幂等执行引擎；不启动 #35。

## N0 三层语义对齐

- PRD / 总体计划：持久化是可信业务事实存储；Runtime checkpoint、Memory、Home DB 不替代业务账本。
- Issue #20 / 原 RETAIL-01P-PLAN：严格限数据库表、迁移、事务、Repository 与 N0–N5；本 Plan 细化源码路径和真实升级测试边界。
- N0 节点标准：基线、上游、环境、文件 owner、依赖门槛、测试命令和未决项已列出；N0 主控核验和依赖批准记录见独立 N0 回执；N1–N5 已获授权执行。
