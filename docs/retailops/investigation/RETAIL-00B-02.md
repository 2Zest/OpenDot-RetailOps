# RETAIL-00B-02：Durable 源码契约调查

状态：静态预读完成；N0 环境门槛阻塞，后续节点未验收。
基线：develop/retailops `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；批准计划 `08679239c1e9959f465e74f1b191085ce86c2c4b`。
Worktree/分支：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-02` / `codex/retail-00b-02-durable-contract`。

## 结论和范围

Node Durable 是显式选择、受 `MINICLAW_DURABLE_RUNTIME` 门控的 Product Runtime 路径，不是普通 Pi Coding Agent 对话。Pi Durable Harness 持久化 conversation、submission、task/checkpoint、memo；MiniClaw 另绑定 Session/owner、request ID 与 payload digest，并在恢复任务前复核权限和产品回执。

没有启用应用 Runtime。真实模型/工具效果、主机断电语义及生产恢复均 NOT_RUN。Node 依赖未安装，所以 N1–N3 仅只读预读、未正式验收；N0 满足后须重新冻结并逐节点复核。自动测试只代表临时 SQLite 和模拟 provider/服务，不代表生产 Runtime 通过。

## N0 基线与检查证据

| 项目 | 实际证据 |
|---|---|
| HEAD | `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`，PR #72 合并后的 develop/retailops；初始 Worktree clean。 |
| Issue #9 | OPEN、READY、unassigned；[Issue #9](https://github.com/2Zest/OpenDot-RetailOps/issues/9)；正文与归档契约一致。 |
| 总体计划 | APPROVED；G0 已解除；批准提交 `08679239c1e9959f465e74f1b191085ce86c2c4b`。 |
| DAG | 无硬上游，下游 #14/#16。Plan 中 PROPOSED 是历史快照；远程 Issue READY 为当前状态。 |
| 上游证据 | 00B-01 调查锚点 `d8f3c729…`、R1 审查锚点 `2a3465b3…`。普通 Pi Coding Agent 0.84.2 与 Product Durable 分离；生产恢复未运行，隔离容器补测 BLOCKED。 |
| 环境 | WSL Ubuntu 24.04；Node v24.22.3 位于 `/home/szz_user/.nvm/versions/node/v24.22.3/bin/node`，默认非登录 shell PATH 不含此目录；该 Worktree 无 `node_modules`。`node --version && npm --version && npm run demo:durable-runtime` 退出 1（node not found，测试未启动）。主控要求等 #6 typecheck 和 #7 Docker build+smoke 错峰后再测试。 |
| 修改范围 | 仅本报告及验收回执；未改源码、断言、依赖/锁文件、运行配置、数据库、路由或安全策略。 |

输入 SHA-256：Master Plan `7b97b12141c4392a926925ae6a5673ea09d140d6b83da36e17c9db976146253e`；Scenario `e67453f89b4d0ed9867315d26748966ec8335844f9db15944ecf9ebe0648fdad`；DAG `11f25c9d22e7986bd21c137eeb1a72ba3a3d158cae0b7238ac41e0e29fdfab86`；Receipt template `04e0fe3232d895c74b47b73f81b9f7e54a93ebd4ba365b312cbe744ce46bc19f`；Issue contract `16e8deba7d15d35697b9100d214694fdea9b2f13cc6c2837b6c6936ca4172440`；Plan `2873e52b3fe2ba60613ab4c1c50823e2d869f82e6e523a8d8b0f23af0b7f1c89`；Approval receipt `24e890533bb23b0a356da5d20af965cb489f106522876031a1ccef995df4beee`。

## Durable 契约预读（待 N0 解阻后复核）

- `product-model.ts::selectNewProductRuntime()` 仅在 `MINICLAW_DURABLE_RUNTIME=true` 选择 Node Durable；明确请求 node-durable 但总开关关闭或 Host/显式容器授权不满足时失败。Cloud Durable 是另一条独立 gateway 路径；Durable 主会话另需 `MINICLAW_DURABLE_MAIN=true`。
- 根依赖锁定 `@earendil-works/pi-durable`、`pi-ai`、`chord` 为 1.3.0；普通 agent-runner 的 `pi-coding-agent` 为 0.84.2。
- `PiDurableRuntimeAdapter.open()` 校验 Node 版本、取得 DB 独占所有权、打开 Node SQLite Storage、设 mode 0600，再调用官方 `Harness.open()`。`openWhenEnabled()` 封装应用开关。activate 前校验恢复 owner，之后才 `harness.resume()`。
- Product Runtime 复用已绑定 checkpoint，核对 input/submission/answer/control receipts、有效队列 payload、owner 和配置身份后才 activate。checkpoint/root 缺失、foreign task/conversation、回执不匹配、授权或冻结配置变化均失败关闭/阻塞。
- conversation 读写和模型请求前会再次校验 ACL/授权及冻结配置身份。每 Session 独立 Harness/SQLite 文件；本地 OS ownership 锁不是跨主机 leader election。
- checkpoint 对象包括 Harness submission/task state/checkpoint/memo/conversation document。产品输入先绑定 request ID 与 payload digest 再 admission；原生 request ID 去重本身不比较 payload。相同 ID+payload 可重用 submission；不同 payload、无可信 digest 或回执缺失时拒绝。
- 输入去重不提供外部效果 exactly-once。副作用可能已发生而下一 checkpoint 未提交；须用业务幂等键/持久回执对账，否则进入 uncertain 并禁止盲目重试。
- SQLite WAL synchronous=NORMAL 对已提交数据的进程崩溃语义不等于主机/断电最新事务保证；绕过 guarded adapter 不受 MiniClaw ownership lock 约束。
- `createProductModels()` 用冻结 provider/model/profile/workspace 指纹，身份变化时阻止恢复；Pi Durable Harness 通过 Pi AI Models registry 发模型请求。普通对话历史证据不能等同 Product Durable。

## 模型兼容与测试证据

仓库预设 `npm run demo:durable-runtime` 汇总 runtime、input ledger、process recovery、ownership、durable model smoke 测试。测试使用临时 SQLite、faux provider、模拟 effect service；SIGKILL suite 启动测试子进程，但仍不证明真实模型/生产工具效果。`npm run test:durable-zen-real-model` 需安全注入授权凭据和 HTTPS 代理，本任务不运行。

| 路径 | 条件/状态 |
|---|---|
| 普通 Pi | 默认 pi-coding-agent 0.84.2，与 Durable 分离。 |
| Node Product Durable | 总开关 + Host 或显式容器授权 + 冻结模型配置；本次未启用。 |
| Durable 主会话 | 总开关 + `MINICLAW_DURABLE_MAIN=true`；未启用。 |
| Cloud Durable | 独立 Cloud 开关/gateway/auth；未部署。 |
| 定向测试 | isolated fixture/test；待 N0 通过后执行。 |
| 真实模型/效果 | NOT_RUN；不属本调查。 |

待主控开放窗口，仅安装锁定依赖，再运行 `npm run demo:durable-runtime`、`npm run docs:check`、`git diff --check` 并记实际退出码；先确认 lockfile 不变且测试只用临时数据。真实模型 smoke、服务启动、Product Runtime 实例、#16 真实验证均禁止。外部写效果须另获授权后用业务回执/幂等键验证 uncertain 对账；Harness 测试不证明 exactly-once。不得据此解除 #16 或解锁下游。

## 三层语义检查（当前）

| 节点/层 | 判定 | 依据 |
|---|---|---|
| N0 总体计划 | PASS（预读） | G0 已批准；仍是 Runtime 契约调查，没有新增业务能力。 |
| N0 Issue/Plan | PASS（预读） | Issue READY、无硬上游，交付源码调查与恢复方案。 |
| N0 节点标准 | BLOCKED | 无锁定依赖，测试环境未就绪；主控要求等错峰窗口。 |
| N1–N3 | 未验收 | N0 未通过，仅作低负载只读预读；解除后重新冻结并逐节点复核。 |
| N4–N5 | 未开始 | 严格等待前置节点通过。 |


## 执行窗口补充（N0 重验及 N1–N4，2026-11-25）

主控开放窗口后，先确认 WSL available memory 12 GiB（门槛 4 GiB）、根文件系统可用 945 GiB。将 Node v24.22.3 的安装目录显式加入此命令环境，仅在本 Worktree 执行 npm ci：803 packages installed，退出码 0；package.json 与 package-lock.json 均未改。N0 环境阻塞解除，随后重验下列节点。

| 节点 | 实际命令/动作 | 结果与三层检查 |
|---|---|---|
| N0 | git status/rev-parse、Issue fetch、输入 SHA-256；node/npm 版本、npm ci | PASS：HEAD e8db2b6b983e9cd2eeca79e596f81b2e5b93663a；Issue OPEN/READY/unassigned，G0 APPROVED、DAG 无上游；Node v24.22.3/npm 11.19.1 及锁定依赖就绪，包锁无差异。总体计划 PASS；Issue/Plan PASS；节点标准 PASS。 |
| N1 | 静态核对 product model selector、feature gates、Adapter.open/openWhenEnabled/activate 与 Product Runtime recovery | PASS：固定在同一 HEAD；总体计划 PASS、Issue/Plan PASS、节点固定 SHA/调用链标准 PASS。只读，没有启动产品 Runtime。 |
| N2 | 静态核对 checkpoint、input digest ledger、recovery receipts、ownership 与 uncertain 处理 | PASS（源码契约）：总体计划 PASS、Issue/Plan PASS、节点状态映射 PASS。仅静态结论，不声称运行恢复。 |
| N3 | 静态核对 pi-durable/pi-ai/chord 1.3.0、agent runner pi-coding-agent 0.84.2、model fingerprint 与定向测试入口 | PASS（候选验证方案）：总体计划/Issue/Plan/节点标准均 PASS；真实模型仍 NOT_RUN。 |
| N4 | npm run demo:durable-runtime；npm run docs:check；git diff --check | 定向 suite PASS：5 files、26 tests passed、exit 0，均为隔离临时 SQLite/faux provider/模拟 effects（含 SIGKILL 测试进程）。docs:check exit 1，唯一失败是未改动历史文件 RETAILOPS-ROADMAP.md 第 1 行引用缺失 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md；git show HEAD 确认该引用已存在于基线。按范围不改该历史文件。补录后对已暂存本任务文档运行 git diff --cached --check。总体计划 PASS、Issue/Plan PASS、节点标准 PASS（测试通过；独立基线文档错误如实记录）。 |

依赖安装时 npm audit 报现有 48 项 advisory（2 low、20 moderate、23 high、3 critical）；未运行 audit fix，也未改依赖。没有启用应用 Durable 配置、启动正式服务、调用真实模型、执行真实外部效果或进入 #16。

当前判定：N0–N4 PASS；N5 为独立文档 PR 准备与审查，不合并。真实 Runtime/真实模型/外部效果仍 NOT_RUN，不能据此将 Issue DONE 或解锁下游。
