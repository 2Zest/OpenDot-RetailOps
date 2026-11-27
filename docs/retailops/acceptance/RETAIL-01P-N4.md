# RETAIL-01P（GitHub Issue #20）N4 节点回执：定向与回归

- 节点目标：在 WSL Node 24 下验证迁移、Repository、原有领域合同及完整 RetailOps 包。
- 基线/Worktree/分支：`8ca176ff3f9e5990b6c2487e41be2953e682c192` / `D:/workSpace/codeAgent/OpenDot-RetailOps-01p` / `feat/retail-01p`。
- 环境：WSL Ubuntu 24.04，Node `v24.22.3`、npm `11.19.1`；`npm ci` 退出码 `0`；原生 `better-sqlite3@12.11.1` 加载成功，SQLite `3.53.2`。
- 定向测试：`npm test -- test/unit/persistence/sqlite test/contract/persistence/sqlite` 退出码 `0`；4 文件、15 项通过。
- 完整包检查（均在 `apps/retailops`，WSL Node 24）：`npm run build` 退出码 `0`；`npm run typecheck` 退出码 `0`；`npm test` 退出码 `0`，7 files / 41 tests passed。保留原有领域测试（26 项）且未删改其断言；新增 15 项 SQLite 测试。
- npm 报告 3 项依赖审计告警（2 moderate、1 high）和 native install-script allowScripts 提示；本次未调整版本或全局配置。运行时加载验证成功。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 本节点只验证持久化能力，不实施真实业务副作用 | 全部测试使用内存或临时 SQLite；无审批、Agent、MCP、API、Home DB 操作 | PASS |
| Issue #20 / Plan | migration、六实体合同、原有合同测试均通过 | 定向 15 项及全量 41 项通过；native 和 build 输出真实记录 | PASS |
| N4 节点验收 | build/typecheck/test 全部成功，测试覆盖回滚、恢复、精度、损坏数据 | build 0、typecheck 0、test 0；7 files / 41 tests | PASS |

- 历史失败：修正后的定向首次跑曾因测试断言/列名错误退出码 `1`，本次复测 `0`；具体修订见 N3，不覆盖失败证据。
- 未验证：外部独立 Review 与合并尚未发生；不属于本节点通过条件。
- 决定：N4 PASS，继续 N5 交付。日期：2026-11-27（Asia/Shanghai）。

## 独立 Review REQUEST_CHANGES 复验记录（2026-11-27）

- 红测证据：临时移除唯一键 schema guard 后，缺少 draft_operations(operation_id) UNIQUE 的错配测试退出码 1（1 failed / 9 skipped，迁移器未抛预期错误）；恢复 guard 后相同测试退出码 0（1 passed / 9 skipped）。本轮早期仓库回归另曾 2 文件 / 21 tests、8 failed / 13 passed；失败暴露的缺陷已修复，未覆盖历史记录。
- 定向最终回归：npm test -- test/unit/persistence/sqlite/repositories.test.ts test/unit/persistence/sqlite/migration-runner.test.ts 退出码 0，2 files / 24 tests passed。
- npm run build：首跑退出码 1，显示 synthetic 迁移关系计数 reduce 类型及 Operation 关系保护器的 TS 未收窄错误；使用 reduce<number> 和显式返回拒绝分支后复跑退出码 0。
- npm run typecheck：首跑退出码 1，暴露 conditional rest tuple 签名令正常 void callback 在测试 TS 编译中失败；改为条件化同步 callback 返回类型后复跑退出码 0，同时 @ts-expect-error 编译测试仍验证异步 callback 不可调用。
- npm test：退出码 0，7 files / 55 tests passed。原 41 项测试/断言均保留，本轮新增 14 项。
- build 后 dist 冒烟：npm run build 后从 dist/adapters/persistence/sqlite/database.js 打开 :memory: DB 并查 migration ledger，输出 {"version":1,"name":"initial-retailops-contract-storage"}，退出码 0。首轮临时 smoke 因探针写错迁移名称而退出码 1；更正为实际定义名后通过，临时脚本已删除。
- npm audit --json：结果包含 1 high、2 moderate、0 critical：

| 包及依赖路径 | 范围 | Advisory 与影响条件 | 基线/处置 |
|---|---|---|---|
| zod@4.4.3 → node_modules/zod（直接） | production | GHSA-mrhx-c7xc-m3w5，受影响 <4.6.6（advisory 修复版本 4.6.6）；某些超大数组校验可耗尽内存。专属包无 HTTP/API 入口，但外部不可信输入是否可达未经运行验证。 | origin/develop/retailops 已有同版本 manifest/lock，属基线；未升级或运行 npm audit fix。 |
| vitest@4.1.8 → node_modules/vitest（直接） | development | GHSA-82fw-gwwq-j7x9，受影响 >=2.1.0 <4.1.11（Vitest 修复版本 4.1.11）；mocker redirect 未认证 WebSocket 可导致任意文件读取。需相关开发服务网络可达；当前包脚本执行本地 vitest run，服务暴露条件未验证。 | 已存在于基线；未升级或运行 npm audit fix。 |
| @vitest/mocker@4.1.8 → vitest → node_modules/@vitest/mocker（间接） | development | GHSA-82fw-gwwq-j7x9 同上（修复版本 4.1.11）；GHSA-qxg6-89mg-rqv8，受影响 >=2.1.0-beta.7 <4.1.12（修复版本 4.1.12），未认证手工 mock 注册 WebSocket 路径可触发代码注入；网络可达性未验证。 | 已存在于基线；未升级或运行 npm audit fix。 |

- 依赖基线对比：origin/develop/retailops 的 RetailOps manifest 与 lock 已含 Zod 4.4.3、Vitest 4.1.8、@vitest/mocker 4.1.8；本轮新增 SQLite 版本 12.11.1 未出现在 audit findings。无需本任务擅自升级依赖。
