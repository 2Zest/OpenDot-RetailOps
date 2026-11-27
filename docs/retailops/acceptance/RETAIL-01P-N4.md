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
