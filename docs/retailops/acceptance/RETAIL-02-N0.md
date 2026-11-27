# RETAIL-02（Issue #21）N0 节点回执

- 目标：冻结基线、依赖、来源证据、文件 owner、依赖版本和测试命令；本轮止于主控核验，不执行 N1。
- 基线：develop/retailops `f3d1a7fc847f75cd0b4064aead0404ab4e23d67b`；Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-02`；分支 `feat/retail-02`；起始工作区干净。
- 依赖实证：#20 CLOSED/DONE，PR #87 merge `048f3a7ef64a54986bfda1e839396b961969e46d`；#13 CLOSED/DONE，PR #79 merge `6a2ddc363f82ae9f9e66e296d2644efafb48565e`。
- 来源冻结：FreshRetailNet revision `c374e85975c82816c495acfa904cc55ab14a47d3`；74 SKU、共同 97 天、train/eval LFS 与分页哈希见执行计划。整文件未下载，N0 未新抓数据；调查缓存不等于当前本地数据。
- 环境：WSL Ubuntu，Node v24.22.3/npm 11.19.1，gh 用户 2Zest。复用包 v0.1.0/合同 0.3.0、Zod 4.4.3、better-sqlite3 12.11.1、types 7.6.13；SQLite migration ledger v1；Vitest discovery unit+contract。未安装依赖/运行测试。
- 文件范围：精确路径和所有者见 `docs/retailops/plans/RETAIL-02-EXECUTION-PLAN.md`。本轮仅新增该 Plan 和 N0 回执；未修改源码、迁移、配置、依赖、基础合同或共享接口。
- 起始 Project 核验：#21 不在 Project #2；#22 为 Ready 且未认领。N0 文档推送后，按用户授权将 #21 加入 Project 并同步 In Progress。

| 对齐层 | 核对结果 | 判定 |
|---|---|---|
| 总体计划/PRD | 保留公开数据来源和归一化单位边界 | PASS |
| Issue/Plan | #20/#13 已实际合并；只做导入和查询 | PASS |
| N0 标准 | 基线、目录、owner、版本、命令、共享迁移锁均记录 | PASS |

- 实际动作：只读核验 Issue、Project、原 Plan、数据调查、#20 包和 SQLite 源码、WSL 环境；新增 N0 文档。
- 修改：`docs/retailops/plans/RETAIL-02-EXECUTION-PLAN.md`、`docs/retailops/acceptance/RETAIL-02-N0.md`。
- 测试：N0 无源码测试；build/typecheck/test 为 NOT_RUN，不作为 PASS。
- 未验证：固定 revision 数据在当前网络能否重取、数据库导入/回读是否逐行吻合；N1 尚未开始。
- 结论：N0 文档化 PASS；等待主控核验，禁止进入 N1。


## N0 文档检查（2026-11-27）
- 在本 Worktree 的 WSL Node v24.22.3 环境执行 `git -c core.autocrlf=true diff --check`：退出码 0。
- 执行 `npm run docs:check`：退出码 0，271 份仓库 Markdown 通过。
- `npm --prefix apps/retailops run build/typecheck/test`：N0 不执行，均为 NOT_RUN；本轮未改业务源码。

