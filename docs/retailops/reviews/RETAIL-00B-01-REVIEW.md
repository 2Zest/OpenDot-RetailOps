# RETAIL-00B-01-R1 源码调查报告审查记录

- 审查对象：PR #3，原始调查提交 `f76970e83c0c9816604587ebab4c9ddbccd874da`，合并提交 `2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea`。
- 关联任务：[Issue #2](https://github.com/2Zest/OpenDot-RetailOps/issues/2)。
- 修订分支：`docs/retail-00b-01-review-fix`，基于最新 `develop/retailops`。
- 审查结论：**待 Review**。

本记录区分 PR #3 历史证据与本轮复核结果。原任务的验收范围未修改；本轮没有修改业务源码、测试断言、依赖、lockfile、数据库结构或安全策略。

## R01：隔离只读测试范围偏差

**问题与原始范围：** PR #3 的真实 Host Runner 测试使用管理员 Home workspace `data/groups/main` 下的专用子目录 `retail-00b-01-fixture/`。Agent 实际产生两次 `write`，随后读取文件并触发一次不存在文件错误。原始工具计数为 bash 2、write 2、read 5，总计 9。该测试不能称为独立 workspace 隔离测试，也不能称为 Agent 只读测试。原报告继续保留原始调用记录并已更正表述。

**源码/证据：** 原调查报告第 5、6 节及其原始 Host Runner 运行证据；Issue #2 原始验收条件要求隔离测试 workspace、测试准备程序创建 fixture、Agent 只读、拒绝未授权写入及前后 SHA-256。

**补充验证：BLOCKED。** 只读检查确认 Docker daemon 客户端与服务端均可访问（版本 28.5.1），但 `docker image inspect helsome/miniclaw-agent:latest` 返回`No such image`。当前没有已经证明只允许 read 并拒绝 write 的独立 Host 测试 workspace。使用管理员 Home 会话或原运行数据不符合隔离约束，因此未启动 Agent、未由测试准备程序写入 fixture、未产生新的工具调用/事件或 fixture 前后 SHA-256，也未尝试写入拒绝测试。没有更改权限、功能开关或安全策略。隔离、多步读取、缺失文件错误回流、拒绝写入和事件次序本轮均未验证。

## R02：Product Approval 边界

**问题：** 原调查容易使读者误以为现有 Product Approval 可直接复用于零售业务审批。

**源码证据：** [`src/personal-agent/approval-store.ts`](https://github.com/2Zest/OpenDot-RetailOps/blob/2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea/src/personal-agent/approval-store.ts) 中 operation 类型与 `product_approvals` 表 CHECK 均限定为 `create_private_artifact`（类型约在第 42 行，CHECK 约在第 67–76 行）。

**修订与验证：** 调查报告明确该 Product Approval 不是通用零售审批。MCP exact-call approval 只能作为候选工具调用授权机制。RetailOps 仍需领域草案、数据快照、经营政策版本、业务审批和执行回执；具体复用方式由 RETAIL-00B-03 调查决定。本轮未改审批源码或数据库。

## R03：Pi 工具适配描述

**问题：** 原报告错误称 Pi custom handler 透传 update callback，并可能把原生 read/write/bash 说成全部经过 OpenDot adapter。

**源码证据：** [`pi-tools.ts`](https://github.com/2Zest/OpenDot-RetailOps/blob/2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea/container/agent-runner/src/runtime/pi/pi-tools.ts#L63-L88) 的 handler 调用为 `tool.handler(params, { signal, toolCallId })`。`pi-runtime.ts` 通过 SDK `createAgentSession()` 装配 SDK 工具和 customTools；`pi-index.ts` 对 Miniclaw 自定义 MCP 工具调用 `adaptClaudeMcpToolsToPi()`。这些是不同层次的机制。

**修订与验证：** 删除 update callback 透传说法，区分 Pi SDK 原生工具执行与 Miniclaw MCP 自定义工具适配。通过对照锁定源码确认。

## R04：调用统计口径

**问题：** “两轮模型调用”将用户任务轮次与模型 API 请求数混为一谈。

**修订与验证：** 统一称为“两轮用户任务/对话”。PR #3 历史记录的结构计数为 user 消息 2、assistant transcript 记录 11、toolResult 记录 9、工具调用 9（bash 2、write 2、read 5）。没有请求级日志，assistant 记录不得推算为模型 API 请求数。本轮未重新执行对话。

## R05：Goal 启用门槛

**问题：** API 路由存在不等于 Goal 功能已启用。

**源码证据：** [`src/routes/goals.ts`](https://github.com/2Zest/OpenDot-RetailOps/blob/2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea/src/routes/goals.ts#L70-L132) 中 availability 需认证并读取 `MINICLAW_PERSONAL_GOALS=true`，Goal 路由受相同开关及 workspace 权限等检查；后续还受 schema、运行模式、Provider 和 Cloud 条件影响。

**修订与验证：** 报告区分路由注册与实际可用，补充开关和授权/运行条件。Goal 本轮未运行，未修改功能开关。

## R06：持久化与恢复边界

**问题：** 源码存在 Session 存储/打开路径不能证明服务重启恢复已通过。

**历史实测与修订：** PR #3 已验证页面刷新后通过 SQLite 历史重新加载消息、Pi Session JSONL 写入、同一 Session 跨两轮用户任务继续使用。本轮没有停止或重启正在运行的服务。服务重启后 Pi Session 恢复和 Product Durable checkpoint 恢复均标记未验证；没有通过源码支持推断为实际恢复测试通过。

## R07：任务状态同步

**问题：** PR #3 已合并而 Issue 完成状态说明仍未填写。

**修订与验证：** 在 `docs/retailops/issues/RETAIL-00B-01.md` 保留原任务契约和原验收条件，增加 R1 完成说明并将状态记为 REVIEW。记录原始提交/合并 SHA、58 项历史定向测试、真实 Host Runner 统计、本轮 R01 BLOCKED、剩余未验证能力和修订 PR。待审查合并前不标 DONE；不提前关闭 Issue。

## R08：证据与状态分层

**问题：** 需要区分历史调查结果、本轮静态源码复核和未能安全执行的补测。

**修订与验证：** 报告明确标注 58 项定向测试和 Host Runner 运行属于 PR #3 历史证据，本轮没有重跑。R01 新补充验证为 BLOCKED。RETAIL-00A 完整基线继续保持 PARTIAL，不因普通对话/历史定向测试而改为 PASS。

## 本轮命令及结果

| 命令/检查 | 退出码 | 结果 |
|---|---:|---|
| `docker version --format 'client={{.Client.Version}} server={{.Server.Version}}'` | 0 | Client/Server 28.5.1；只读环境检查 |
| `docker image inspect helsome/miniclaw-agent:latest --format '{{.Id}}'` | 1 | 镜像不存在；作为 R01 安全隔离补测的阻塞证据 |
|`npm run docs:check` | 0 | 通过：128 个仓库 Markdown 文件一致性检查 |
| `git diff --check` | 0 | 通过：无空白错误或冲突标记 |

PR #3 的历史定向测试为 8 个测试文件、58 passed、0 failed、0 skipped、exit 0；此结果不是本轮重跑。因 R01 条件不足，本轮没有运行 Agent 补充测试，故不存在可报告的新工具调用、事件顺序或 fixture 哈希。

## 尚未验证的能力

- 独立隔离 workspace 中由准备程序建立 fixture 后的只读多步访问、缺失文件错误回流、拒绝写入及前后 SHA-256。
- 服务停止/重启后的 Pi Session 恢复。
- Product Durable checkpoint 的进程重启恢复。
- Goal、MCP、Product Approval、Container Runner 的真实运行链路。
- 任何模型 API 请求级统计（没有请求级日志证据）。

## 后续 RetailOps 扩展边界

后续领域调查应定义只读业务工具的数据范围与授权、经营政策版本、数据快照/证据链、审批语义、幂等执行和回执；不得将当前 `create_private_artifact` Product Approval 直接泛化为业务审批。候选 MCP exact-call 授权与现有运行时的适配边界应由 RETAIL-00B-03 确认。当前审查不实现上述能力、不启用高级功能，也不改变 RETAIL-00A 的 PARTIAL 结论。
