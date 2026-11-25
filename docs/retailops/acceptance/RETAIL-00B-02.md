# RETAIL-00B-02 节点验收回执

- Issue：[ #9 RETAIL-00B-02 | Durable 源码契约调查 ](https://github.com/2Zest/OpenDot-RetailOps/issues/9)
- Plan：`initial-plan-v0.2/plans/RETAIL-00B-02-PLAN.md`
- 批准计划提交：`08679239c1e9959f465e74f1b191085ce86c2c4b`
- 基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`
- Worktree/分支：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-02` / `codex/retail-00b-02-durable-contract`
- Runtime Agent；变更仅调查报告与回执，无源码、配置、依赖、锁文件或断言变更。

## N0：环境、基线、范围
- 动作：核对 Git 状态/HEAD、Issue 正文、DAG、Plan、审批、00B-01 调查/R1 review、Node/依赖可用性。
- 证据：HEAD e8db2b6…；初始 Worktree clean；Issue OPEN/READY/unassigned；无硬上游、下游 #14/#16；G0 APPROVED。Node 24.22.3 存在但默认 PATH 不含，Worktree 无 node_modules。
- 命令：git status/rev-parse、Issue fetch、静态读取和 sha256sum 均退出 0；`node --version && npm --version && npm run demo:durable-runtime` 退出 1（node not found，测试未启动）。
- 三层判定：总体计划 PASS（范围符合）；Issue/Plan PASS；节点标准 BLOCKED（环境缺锁定依赖）。
- 决定：N0 BLOCKED，停止 N1 及后续正式节点。

## N1–N3 只读预读（未验收）
只读查看 runtime selector/feature gate、adapter open/activate/recovery、input digest ledger、model selection、锁文件及现有测试入口。细节在 `investigation/RETAIL-00B-02.md`。由于 N0 未通过，这些不是正式节点交付；解除后必须逐节点复核并做三层检查。候选 `npm run demo:durable-runtime` 使用临时 DB/faux provider/模拟 effects；未启用应用 Runtime、未启动服务、未执行 #16。

## N4–N5
- N4 未开始。主控要求等待 #6 typecheck、#7 Docker build+smoke 错峰结束后，再安装锁定依赖、跑定向测试。
- N5 未开始；前序节点通过后再开独立 PR。
- 未验证：定向测试、真实模型、真实工具副作用、生产恢复、主机/断电故障。
- 阻塞：Worktree 无 Node dependencies，默认 PATH 无 Node，阻塞执行测试；不影响其它任务。
- 后续建议：开放窗口后，仅在此 Worktree 把 `/home/szz_user/.nvm/versions/node/v24.22.3/bin` 加入 PATH 并运行 npm ci，确认 lockfile 不变，再跑定向 suite 和 docs check。
- 结论：N0 BLOCKED；不进入 #16，不关闭 Issue、不标 DONE、不解锁下游。


## 执行窗口更新（2026-11-25）

主控开放窗口后，复核 WSL available memory 12 GiB、disk free 945 GiB；Node v24.22.3/npm 11.19.1 显式加入 PATH，在本 Worktree 执行 npm ci 退出 0（803 packages），package.json/lock 未变。此前 N0 环境阻塞解除，N1–N3 依固定 HEAD 正式复核，节点三层均 PASS（详见调查报告）。

N4：
- npm run demo:durable-runtime：exit 0；5 test files、26 tests passed。证据级别为 isolated fixture/test：temporary SQLite、faux provider、模拟 effects；其中 SIGKILL 是测试子进程恢复，不是真实模型或生产 Runtime 通过。
- npm run docs:check：exit 1。唯一报告为未改动历史文件 RETAILOPS-ROADMAP.md 第 1 行的过期链接 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。git show HEAD 确认缺失链接已存在于基线；超出本 Issue 调查范围，未改路线图。
- git diff --check：待提交文档暂存后复验。
- npm ci 期间 npm audit 报 48 项 advisories（2 low/20 moderate/23 high/3 critical）；未执行自动修复、未改依赖。

三层语义：总体计划、Issue/Plan 与节点范围一致；定向测试证明本地隔离测试行为，不能证明真实运行。N0–N4 当前 PASS；N5 准备独立开放 PR。真实 Runtime、模型、业务副作用、主机断电恢复及 #16 均未运行；不标 DONE、不解锁下游。
