# RETAIL-01P（GitHub Issue #20）N0 节点回执

- 节点目标：核实依赖、基线、工作区、上游、环境、允许路径和后续节点验收范围。
- 日期：2026-11-27（Asia/Shanghai）。
- Git 基线 / 当前 HEAD：8ca176ff3f9e5990b6c2487e41be2953e682c192。
- Worktree / 分支：D:/workSpace/codeAgent/OpenDot-RetailOps-01p / feat/retail-01p。
- 上游：
  - GitHub Issue #19 / RETAIL-01：PR #86 已合并；merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192，合同 v0.3.0。
  - GitHub Issue #6 / RETAIL-00A-01：PR #73 merge SHA b22ed421b22e6fa06b8fe9821e916ff48adf9524。
- 环境：WSL Ubuntu 24.04、Node v24.22.3、npm 11.19.1、20 CPU、可用内存约 14 GiB、/mnt/d 剩余空间约 610 GB。
- 允许/互斥文件清单：见 [RETAIL-01P-EXECUTION-PLAN.md](../plans/RETAIL-01P-EXECUTION-PLAN.md)“文件所有权与锁”；数据库适配器、端口、持久化测试只归 #20。#24 算法/测试文件只读。
- 实际执行：核对集成分支实际 merge commit、Issue #19/#6 依赖验收、RetailOps app manifest/专属 lockfile/test discovery、领域 v0.3.0 合同、架构及数据库边界；未连接或创建任何数据库，未安装依赖，未写业务代码。
- 检查：npm run docs:check、git diff --check（执行结果附于本回执更新记录）。
- 未运行：应用 build/typecheck/test 和 SQLite 迁移测试；N0 没有实现变更，数据库测试留给 N1–N4。
- 未决/阻塞：SQLite driver 与类型是否批准为 apps/retailops 独立依赖；主控确认前暂停 N1。没有既存 RetailOps DB，升级只能由旧版 RetailOps schema 临时 fixture 表示。
- 实际修改文件：本细化 Plan、该 N0 回执。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 独立、可靠、可恢复的业务事实存储；不混用 Runtime/Home 状态 | N0 保持包内隔离，Home DB 和 Runtime DB 被列为只读/禁止路径 | PASS |
| Issue #20 / 原 Plan | SQLite schema、迁移、Repository 与事务；测试旧库升级、约束、回滚、重开恢复 | 文件 owner、迁移方案、合同校验、临时 fixture 测试及 N1–N5 已列明；代码未开始 | PASS |
| N0 验收标准 | 上游、基线、环境、范围、依赖提案和测试命令固定；未批准依赖前不得开始 N1 | 本回执和 Execution Plan 已记录候选版本、理由、唯一文件 owner 与暂停门槛 | PASS |

- 偏差：无实现偏差；发现当前 app 未声明 SQLite driver。
- 复测：文档检查结果将在文档写入后记录；未运行数据库/应用测试。
- 节点结论：N0 文档和预检通过，提交主控核验；N1 未开始。该 PASS 只代表 N0 记录完整，不代表 SQLite 依赖已批准；依赖未获核验前不得进入 N1 实施。


## N0 检查结果（2026-11-27）

- Node/npm：WSL Node v24.22.3、npm 11.19.1。
- 首次 docs:check：在 WSL 直接执行失败，退出码 1；根因是 Windows worktree 的 .git 指针以 D:/ 绝对路径开头，WSL 将其解析成相对路径。未修改仓库配置。
- 复跑命令：设置 GIT_DIR=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps.git/worktrees/OpenDot-RetailOps-01p、GIT_WORK_TREE=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-01p、GIT_OPTIONAL_LOCKS=0、core.autocrlf=true 后执行 npm run docs:check；退出码 0，256 份仓库 Markdown 检查通过。
- git diff --check：退出码 0，无空白错误。
- 初次失败和修正后的真实结果均保留；没有运行 build/typecheck/test，也没有数据库测试。


## 主控审查与依赖批准（2026-11-27）

- 主控实际核对了 GitHub Issue #19/#20/#24、#20/#24 分支、细化 Plan、N0 回执、Git 差异、根锁文件中的 SQLite 版本与未决参数。
- RETAIL-01P N0：有条件通过；条件已满足。明确批准仅在 apps/retailops 独立包新增 better-sqlite3 12.11.1 与 @types/better-sqlite3 7.6.13，并确认 #20 独占 apps/retailops/package.json、apps/retailops/package-lock.json 的修改权。
- 已获授权按 RETAIL-01P-EXECUTION-PLAN 推进 N1–N5，最终建立独立 PR 等待 Review；不触及根依赖、宿主或基础领域合同。
- 此批准解除本回执旧版“等待 SQLite driver 决定”的门槛。首次 N0 记录仍作为历史事实保留；当前执行状态以本段及 Issue #20 最新状态为准。
- WSL Node 24 下 native module 安装/加载、迁移资源在 dist 下可用、事务/损坏数据/精度往返均列为必须有真实证据的验收项；历史 schema 仅可用标注清楚的合成 RetailOps fixture 验证。
- 本次追加主控决定后 WSL Node v24.22.3 / npm 11.19.1 执行 npm run docs:check 退出码 0，256 份 Markdown 通过。git diff --check 首次因新增尾空行退出码 1；移除额外空行后重新检查通过，错误及修正均保留。\n- N0 三层检查结论保持 PASS；N1 已授权开始。此决定不授权 Home DB、真实用户数据、审批、Agent、业务执行、下游或任何真实副作用。
