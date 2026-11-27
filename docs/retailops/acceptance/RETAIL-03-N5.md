# RETAIL-03（GitHub Issue #22）N5 节点验收回执

日期：2026-11-27
状态：PASS
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
集成基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 环境与安装证据

- 正确执行环境：WSL Ubuntu，Node `v24.22.3`、npm `11.19.1`。安装前后 WSL `free -h` 显示 14 GiB available（总 15 GiB），符合既定资源门槛。
- 一次 `wsl --cd ... -- npm ci` 误使用默认 Node `v26.13.0`/npm `11.20.0`，虽退出码 0，但出现 engine mismatch 和 install-script 未获准提示；该次安装不作为验收依据。随后在 WSL 登录 Bash 明确 Node 24 环境重跑 `npm ci --prefix apps/retailops`，退出码 0，按既有锁文件安装。
- npm 11 allowScripts 策略把 better-sqlite3 安装生命周期脚本列为未审批；`npm install-scripts ls` 为只读。误以为 `npm install-scripts approve --dry-run better-sqlite3` 不会写文件后执行该命令，结果它在本 Worktree 的 `package.json` 中临时写入 `allowScripts: { "better-sqlite3@12.11.1": true }`。随即通过精确补丁移除本次新增字段；回读确认 `git diff -- apps/retailops/package.json` 为空、路径未暂存、内容与 HEAD 一致。没有执行其安装脚本；最终 package/lock 和全局配置均未改变。
- 安装后直接 Node 24 加载 `better-sqlite3@12.11.1`，创建 `:memory:` 数据库并执行 `select sqlite_version()` 成功，版本 `3.53.2`，退出码 0；完整 SQLite 测试随后亦通过。

## 实际回归

| 实际命令 | 退出码 | 结果 |
|---|---:|---|
| `npm --prefix apps/retailops run build` | 0 | TypeScript production build 通过。 |
| `npm --prefix apps/retailops run typecheck` | 0 | 测试/源码 TypeScript 检查通过。 |
| `npm --prefix apps/retailops test` | 0 | 14 个测试文件、120/120 通过；包含集成基线 109 项及本任务 11 项。 |
| `npm run docs:check`（WSL，设置独立 Worktree 的 `GIT_DIR` / `GIT_WORK_TREE`） | 0 | 281 份仓库 Markdown 文档检查通过。 |
| `git diff --check` | 0 | 工作区差异无空白错误。 |
| `git diff --cached --check` | 0 | 暂存差异无空白错误。 |
| 文件范围核对 | 0 | 11 个允许路径，未修改 package/lock、domain/index、迁移、共享入口或测试配置。 |

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| 总体计划/PRD/场景/架构 | V0 单店、单 SKU、单 Batch；SIMULATED 结果不冒充真实数据/因果 | 全部事件携带 SIMULATED provenance；仅内存纯领域计算；不读取历史销量或写入业务系统 | PASS |
| Issue #22/原 Plan/Execution Plan | seed/clock/horizon/输入显式；确定性账本、守恒、候选约束、未售/报损分离 | 输入/输出 Zod 合同与 BigInt 精确计算；价格候选绑定 Product/Batch/Policy/scenario/time；测试覆盖重复、质量、到期、库存、价格、精度和 UTC offset | PASS |
| N5 节点验收 | build/typecheck/test/docs/diff 与范围检查真实执行 | build/typecheck 0；14 文件 120/120；文档和暂存检查将在本回执终检更新 | PASS |

偏差记录：首次调用 npm ci 误用了 WSL 非登录 shell 的 Node 26；发现后改用规定 Node 24 登录环境重装并重验，未依赖错误环境结果。无源码偏差或验收标准降低。
未验证项：真实模型、MCP、Harness、业务执行和价格因果不属于本 Issue；无生产 KPI 结论。
结论：PASS，进入 N6 交付。
