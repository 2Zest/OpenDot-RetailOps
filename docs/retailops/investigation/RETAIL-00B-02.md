# RETAIL-00B-02：Durable 源码契约调查

历史初始状态：N0 环境门槛阻塞（已在执行窗口补充中解除）。当前状态：调查及隔离 fixture 验收 PASS；真实 Runtime/模型/生产恢复/#16 NOT_RUN；docs:check 待公共文档 PR 合并后复验。
基线：develop/retailops `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；批准计划 `08679239c1e9959f465e74f1b191085ce86c2c4b`。
Worktree/分支：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-02` / `codex/retail-00b-02-durable-contract`。

## 结论和范围

Node Durable 是显式选择、受 `MINICLAW_DURABLE_RUNTIME` 门控的 Product Runtime 路径，不是普通 Pi Coding Agent 对话。Pi Durable Harness 持久化 conversation、submission、task/checkpoint、memo；MiniClaw 另绑定 Session/owner、request ID 与 payload digest，并在恢复任务前复核权限和产品回执。

【历史快照：执行窗口开放前】没有启用应用 Runtime。真实模型/工具效果、主机断电语义及生产恢复均 NOT_RUN。Node 依赖未安装，因此当时 N1–N3 仅只读预读、未正式验收；N0 满足后须重新冻结并逐节点复核。自动测试只代表临时 SQLite 和模拟 provider/服务，不代表生产 Runtime 通过。 【当前状态（引用下方“执行窗口更新”）：N0–N4 静态调查/隔离 fixture 范围 PASS；docs:check 等待 PR #81 合并后复验；真实 Runtime、模型、外部效果和 #16 未运行。

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

## Review 修订补充及完整源码链

本节补足调用链、职责、状态映射、DeepSeek 矩阵与 #16 方案；上文 N0 首次失败及解除、N4 原始测试记录均保留。路径和行号固定于 SHA e8db2b6b983e9cd2eeca79e596f81b2e5b93663a。

1. Session 创建：POST /api/groups/:jid/sessions 检查 group 权限，经 sessionCreation/runtime selector 后调用 createAgent。[agents.ts:661-748](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L661-L748)，选择器 [688-715](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L688-L715)。
2. 产品 DB：createAgent 事务写 agents 并调用 registerProductRuntime。[db.ts:13032-13058](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/db.ts#L13032-L13058)。
3. Runtime 选择：MINICLAW_DURABLE_RUNTIME=true 及授权 Host/容器条件允许 Node Product Durable；model config 校验 workspace owner、Host grant、enabled provider、API 类型、base URL、model、key/token、fingerprint。[product-model.ts:42-113](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L42-L113)、[147-216](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L147-L216)。
4. 消息提交：POST /api/messages 校验 body，要求 Durable requestId、拒绝 reset/附件并调用 ProductRuntimeService.submit。[schemas.ts:241-261](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/schemas.ts#L241-L261)、[web.ts:319-416](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/web.ts#L319-L416)。Service 授权、admit 产品 input 并保存 canonical payload digest：[product-runtime.ts:2122-2204](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L2122-L2204)、[store.ts:516-571](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L516-L571)。
5. Adapter 生命周期：owner 延迟 open；每个 Session 独立 durable-sessions/<sessionId>.sqlite。Adapter.open 获得 DB ownership、Node SQLite storage、文件 mode 0600 和 Harness.open。核验 Conversation root、input receipts、原生 submissions、Task/answer/control/queue 后才 activate/harness.resume。[runtime.ts:1668-1715,1855-1965](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L1668-L1715)、[adapter.ts:180-239](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L180-L239)。
6. SDK 调用：submitExisting → adapter.submitInput；验证 active、Conversation ACL、request/payload binding 后调用 Conversation.submit 并记录 native submission ID。[runtime.ts:2246-2335](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L2246-L2335)、[adapter.ts:254-275](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L254-L275)。
7. 完成和恢复：monitor 投影答案；recover/reconcile 核对 SDK submissions 与产品 receipts，再恢复 admitted/submitted 原 request，缺绑定/状态矛盾会 block。[runtime.ts:2333-2398,2601-2645](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L2601-L2645)、[adapter.ts:299-330](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L299-L330)。

## OpenDot / Pi Durable 职责及状态映射

OpenDot 负责 Session/owner/workspace/Host 授权、provider/model fingerprint、requestId+payload digest、产品消息投影及 recovery receipts、权限和外部效果边界。pi-durable 负责 Harness/Conversation/Submission/Task/checkpoint/memo 调度持久化；pi-ai 负责 provider/model API adapter。产品业务事实、授权和 agent status 不等同 SDK 内部状态。

lockfile 固定 pi-durable/pi-ai/chord 1.3.0；普通 pi-coding-agent 0.84.2。已安装 pi-durable 声明：Conversation.submit 在 node_modules/@earendil-works/pi-durable/dist/harness/types.d.ts:588-600；Submission.status/abort 在 44-49；TaskState 在 dist/types.d.ts:443-518；Submission queued/placed/done/unanswered 在 328-389。Task pending/running/waiting 有 checkpoint；completing/terminal 只保存 outcome；memo 仅在仍可运行 Task 保存。

| SDK 对象 | 产品 DB 映射 | 限制 |
|---|---|---|
| Conversation | product_session_runtimes.conversation_id；同表绑定 owner/workspace/runtime/provider/fingerprint。[store.ts:108-118](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L108-L118) | 每个 Session 绑定产品 root。 |
| Submission | product_session_inputs 保存 request_id、payload/digest、native submission_id 和 admitted/submitted/completed/failed。[153-157](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L153-L157)、[703-759](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L703-L759) | 同 request ID + 不同 digest 冲突；产品状态不是 SDK status 副本。 |
| Task | product_input_task_sources 在实际 checkpoint reader 得到 native task ID/answer 后绑定 input、answer、payload/result digest/trace。[172-180](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L172-L180)、[1304-1345](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime-store.ts#L1304-L1345) | 不复制 Task state/checkpoint；不可从 agent status 推断。 |
| Checkpoint / Memo | SDK storage 保存 Conversation/Submission/Task/checkpoint/entry；OpenDot 保留 IDs/digest/完成 receipts。memo 只属于 SDK 活跃 Task。 | memo 无产品 DB 业务映射，不是零售业务事实。 |

checkpoint 粒度为已提交 Task checkpoint 和 Conversation/Submission 持久记录，不是逐指令快照；精确事务时序待 #16。外部效果可能先发生而本地新 checkpoint/receipt 尚未提交，恢复重放会重复模型计费或工具副作用。无业务幂等键和持久外部回执必须标 uncertain、对账，不能盲重试。WAL synchronous=NORMAL/fixture SIGKILL 不能证明掉电/磁盘故障语义。真实 checkpoint migration、provider 中断行为及副作用幂等未验证。

## DeepSeek 兼容矩阵及静态不可证项

| 配置 | 静态源码能证明 | 静态不能证明 |
|---|---|---|
| anthropic-messages | 默认 API；读取 anthropicBaseUrl（默认 Anthropic URL）、anthropicModel、API key/token，调用 anthropicMessagesApi。[product-model.ts:77-111](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L77-L111)、[275-309](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L275-L309) | DeepSeek URL/auth/model/tools/streaming/errors/usage；写入 https://api.deepseek.com/anthropic 不是实测证明。 |
| openai-completions | 源码接受并调用 openAICompletionsApi：[81-83](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L81-L83)、[276-292](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L276-L292) | DeepSeek 方言、tools/streaming/usage/model alias 实际兼容。 |
| 历史普通 Pi/OAuth | 00B-01 记录过普通 Agent DeepSeek deepseek-flash；当前需要 API key/token，OAuth bridge 未接通。 | 普通 Pi 不是 Product Durable 证据；不记录或推断 secret/token 有效。 |

## #16 候选真实恢复验证方案（未执行）

前置：上游 #7/#00F/#9 证据固定；专用 Host workspace、账户、checkout、数据库、端口、provider secret；不得接真实商超写接口；真实模型/中断窗口另行授权。config.ts:22-33 的 DATA_DIR 按 process.cwd() 推导，独立 checkout 隔离 data/db；WEB_PORT 见 [config.ts:57-58](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/config.ts#L57-L58)。候选命令：专用目录确认 git status 干净、npm ci、锁文件/资源核验、端口空闲检查；用 secret manager 注入只读模型；只在专用目录启动 WEB_PORT=43127 MINICLAW_DURABLE_RUNTIME=true npm run dev（端口为示例，执行前检查；dev 为 tsx src/index.ts）。创建 runtime=node-durable Session 后，以认证隔离 UI/API 向 POST /api/messages 提交 {chatJid,agentId,requestId,content}。认证/CSRF 细节由 #16 执行者复核，禁止把凭据放 shell history。本轮未执行。

| 场景 | 操作和预期 | 停止条件 |
|---|---|---|
| 正常 | 纯文本只读问题、无写工具；记录 runtime_kind、session/conversation/request/submission/task IDs、产品和 SDK 终态、answer/task-source digest、trace。 | 数据目录不隔离、无稳定 receipt、出现未授权工具效果。 |
| 重复 | 同 requestId+payload 重放复用原 input/submission/answer；同 ID 改 payload 应 409，不得出现第二次 submission/model call。 | 出现新提交/模型调用就停止。 |
| 中断恢复 | 只读长任务，确认已提交可观测 checkpoint；获批后只停止专用进程，保留同 DB，重启后用原 request ID reconcile。预期同 conversation/submission/task/digest、checkpoint 合法推进、一份 answer；provider 可重试/重复计费，非 exactly-once。 | 源码没有公开安全 checkpoint pause 命令；无法确认无 effect 在途则 BLOCKED，不猜测性 kill。 |
| 取消 | 专用 owner 调 POST /api/groups/:jid/sessions/:id/abort；control queue 另以 requestId 测。预期 SDK/产品 receipt 一致，无伪造 answer/新模型调用/外部写。[agents.ts:916-959](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L916-L959)、[runtime.ts:3141-3157](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L3141-L3157) | Goal-managed Session 遵守 pause/cancel fence；身份不明则停止。 |
| 授权失败 | 非 owner 尝试访问；隔离实例撤销 Host grant 或更改 model fingerprint 后恢复。应拒绝/blocked、检查前不 resume、无新输入/提交/模型调用/效果，checkpoint 不变。[runtime.ts:789-818](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L789-L818)、[adapter.ts:225-232](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-runtime.ts#L225-L232) | 不改 Home 权限制造负例。 |

安全 checkpoint 的具体运维暂停触发点在静态源码中不可证。不能确认安全点和无外部 effect 在途时，#16 必须 BLOCKED。

## 当前状态勘误、节点三层检查、复验

开头旧句“N0 阻塞/后续未验收”是执行窗口前历史快照，现标为历史；执行窗口补充记录已解除。当前：N0–N4 在静态调查/隔离测试范围 PASS，N5 为开放 PR Review；真实 Runtime/模型/副作用/#16 NOT_RUN。N0 首次 PATH 失败及解除保留。N1 三层 PASS（固定 SHA 调用链）；N2 三层 PASS（职责、映射、恢复边界静态证据）；N3 三层 PASS（调查交付、实测 NOT_RUN）；N4 fixture 5 files/26 tests exit 0，全是 isolated fixture/temp SQLite/faux provider/mock effects/SIGKILL 子进程；docs:check exit 1，基线旧链接待公共修复合并后复验，不能表述为通过。PR #81 合并后复验：npm run demo:durable-runtime、npm run docs:check、git diff --check。依赖 audit 48 advisories 维持原记录，无 audit fix。

**最终状态：N0–N4 调查/隔离 fixture PASS；docs:check 待公共 PR 合并后复验；真实 Node Durable/DeepSeek/效果/生产恢复/#16 NOT_RUN。Issue 不关闭、不标 DONE、不解锁下游。**
