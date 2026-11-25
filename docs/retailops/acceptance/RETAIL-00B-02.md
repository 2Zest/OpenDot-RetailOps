# RETAIL-00B-02 节点验收回执

- Issue：[ #9 RETAIL-00B-02 | Durable 源码契约调查 ](https://github.com/2Zest/OpenDot-RetailOps/issues/9)
- Plan：`initial-plan-v0.2/plans/RETAIL-00B-02-PLAN.md`
- 批准计划提交：`08679239c1e9959f465e74f1b191085ce86c2c4b`
- 基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`
- Worktree/分支：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-02` / `codex/retail-00b-02-durable-contract`
- Runtime Agent；变更仅调查报告与回执，无源码、配置、依赖、锁文件或断言变更。

【历史快照：执行窗口开放前】本回执下文的 N0 BLOCKED、N1–N3 未验收、N4–N5 未开始及默认 PATH 缺 Node，均记录当时状态，不代表当前状态。当前状态见后续执行窗口更新和 Review 修订补充：N0–N4 调查/隔离 fixture 范围 PASS；docs:check 待 PR #81 合并后复验；真实 Runtime/模型/恢复/#16 NOT_RUN。

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


## Review 修订补充与当前节点状态

源码基线 e8db2b6b983e9cd2eeca79e596f81b2e5b93663a，报告中的行号固定于此。完整调用链：agents.ts:661-748 → db.ts:13032-13058 → product-model.ts:42-113,147-216 → web.ts:319-416 → product-runtime.ts:2122-2204 → durable-runtime.ts:254-275 → SDK Conversation.submit；恢复前检查/activate 在 product-runtime.ts:1668-1715,1855-1965 和 durable-runtime.ts:180-239。

OpenDot 管产品 Session/owner/ACL/provider fingerprint/request digest/产品 receipts 与恢复校验；pi-durable 管 Conversation/Submission/Task/checkpoint/memo；pi-ai 管 provider API。Conversation 映射 product_session_runtimes.conversation_id；Submission 映射 product_session_inputs 的 request_id/payload digest/submission_id/产品状态；Task 由真实 checkpoint reader 绑定 native task ID/answer entry，不复制 Task state；checkpoint 保存在 SDK storage；memo 只在 SDK 活跃 Task 存在。外部 effect 可能先于 checkpoint/receipt，缺业务幂等键需 uncertain 对账，不宣称 exactly-once。

DeepSeek 静态矩阵只证明 anthropic-messages 与 openai-completions 两种 API adapter 可配置；endpoint、auth、tools、streaming、usage、model alias 需要 #16 实际验证。#16 候选方案已列隔离 checkout/data/port/provider、启动命令、正常/重复及冲突/中断恢复/取消/授权失败用例和预期。源码未提供安全 checkpoint pause 命令；无法确认安全边界要 BLOCKED。详见调查报告固定 SHA 引用。

保留原执行记录：N0 首次默认 PATH 缺 Node BLOCKED，错峰后 Node 24.22.3/npm 11.19.1、12 GiB 内存、945 GiB 可用磁盘、npm ci exit 0 后解除。定向 npm run demo:durable-runtime exit 0（5 files/26 tests）只属 isolated fixture/temp SQLite/faux provider/模拟效果/SIGKILL 子进程；非真实模型或 #16。npm run docs:check exit 1，基线 RETAILOPS-ROADMAP.md:1 旧链接，公共修复尚未合并。本轮不执行 Durable suite/docs check；公共 PR #81 合并后重跑 npm run demo:durable-runtime、npm run docs:check、git diff --check。状态首尾一致：静态调查/隔离 fixture PASS；docs:check 待复验；真实 Runtime/DeepSeek/外部效果/#16 NOT_RUN；不关 Issue、不标 DONE、不解锁下游。
