# RETAIL-00B-01：Agent Runtime、Agent Loop、Tool Calling、事件回流与持久化调查

> 调查日期：2026-11-25  
> 基线分支：develop/retailops  
> 基线 Commit：d8f3c729a9fd8e38d34db80fac0c63098183e493  
> 调查分支：feat/retail-00b-source-investigation  
> 任务契约：docs/retailops/issues/RETAIL-00B-01.md  
> 执行计划：docs/retailops/plans/RETAIL-00B-01-PLAN.md

## 1. 结论摘要

本次调查结论为 **CONFIRMED（调查链路已确认）**，但这不改变 RETAIL-00A 完整运行基线仍为 **PARTIAL** 的事实。

1. 当前普通 Web 对话不是 Product Durable Runtime。实际链路是：Chat Store → POST /api/messages → Web ACL/消息落库 → GroupQueue → processGroupMessages → runAgent → Host Runner/Container Runner → agent-runner → Pi Coding Agent SDK。
2. 本机管理员 Home 的普通对话实际走 **Host Runner**。真实模型为 deepseek-flash，Pi provider 标识为 miniclaw-anthropic，配置入口显示第三方 Anthropic 兼容地址 https://api.deepseek.com/anthropic。未读取或输出 Auth Token。
3. Agent Loop 由锁定版本的 Pi SDK 实现，不是 OpenDot 自行重写：@earendil-works/pi-coding-agent@0.84.2 调用其内嵌 @earendil-works/pi-agent-core@0.84.2 的 runAgentLoop()；循环负责模型调用、识别 tool call、执行工具、追加 tool result、继续模型推理和处理 follow-up。
4. OpenDot 的责任边界是：用户/工作区权限、队列和并发、Host/Container 选择、子进程生命周期、Pi 工具适配、流式事件转换、WebSocket 广播、SQLite 最终消息、Session 绑定和运行审计。
5. 真实验证完成两轮用户任务/对话（没有请求级日志可据以统计模型 API 请求次数）。第一轮产生 2 × bash + 2 × write + 3 × read，包含一次 ENOENT 工具错误；模型在收到错误后继续完成最终答复。第二轮复用同一 Session，再执行 2 × read。合计 9 次工具调用，最终均形成 sdk_final/completed 消息。
6. 页面刷新后用户输入、最终回复、测试标识和工具错误仍可加载，证明产品消息历史来自 SQLite；Pi Session JSONL 写入也已验证。会话重启恢复未验证，两种存储用途不同。
7. 当前实例没有启用 Node Durable、外部 Pi MCP/Device Nodes，也没有 Goal、Product Approval、Product MCP 或 Product Runtime 数据。因此这些能力本次为 **NOT_RUN**，不是 PASS。
8. 新建 Dot 默认使用 Container Runner；本机缺少 helsome/miniclaw-agent:latest，故 Container 路径为 **BLOCKED**。本次未擅自拉取或构建镜像。

## 2. 证据等级与边界

| 标记 | 含义 | 本报告使用方式 |
| --- | --- | --- |
| S | 基线源码证据 | 固定到 d8f3c729... 的 GitHub 链接 |
| L | 锁定依赖/本机已安装 SDK 源码 | lockfile + node_modules 只读检查 |
| T | 定向自动化测试 | 8 个测试文件、58 个测试 |
| R | 真实运行证据 | UI、进程、SQLite、Session JSONL |
| U | 未确认或未运行 | 明确说明启用条件和缺口 |

调查未修改业务源码、测试断言、依赖版本或 lockfile；未开启高级功能开关；未读取或输出 API Key。

## 3. 实际运行配置

| 项目 | 实际值 | 证据 |
| --- | --- | --- |
| Workspace | web:main / main / admin Home | R：SQLite registered_groups |
| 执行模式 | host | R：SQLite；Host runner 进程 |
| Agent Profile | 30a17c02-9d78-4ead-899d-58873e667948 | R：SQLite sessions |
| Provider 配置名 | deepseek（系统默认、第三方） | R：设置页 |
| Pi provider | miniclaw-anthropic | R：Session JSONL model_change |
| 模型 ID | deepseek-flash | R：设置页 + Session JSONL |
| API 兼容入口 | https://api.deepseek.com/anthropic | R：设置页 |
| Session ID | 01a2119f-2dd9-7ed6-a513-dc518e6ed130 | R：SQLite + JSONL |
| Runner PID | 75923（验证时） | R：WSL ps |
| Durable flag | 未设置 MINICLAW_DURABLE_RUNTIME | R：服务进程环境定向检查 |
| Device/Pi MCP | 未设置相关环境变量，且无 device-nodes.json | R + S |

Provider 凭据独立保存；本次仅核对 UI 的非敏感元数据和运行时 provider/model 标识。

## 4. 普通对话端到端链路

~~~mermaid
sequenceDiagram
    participant U as Web 用户
    participant C as Chat Store
    participant W as Web API
    participant D as SQLite
    participant Q as GroupQueue
    participant I as processGroupMessages
    participant R as runAgent
    participant H as Host Runner
    participant P as pi-index / Pi SDK
    participant M as Model Provider

    U->>C: sendMessage()
    C->>W: POST /api/messages
    W->>W: auth + workspace ACL + Host 权限
    W->>D: 持久化用户消息
    W-->>C: receipt
    W->>Q: sendMessage 或 enqueueMessageCheck
    Q->>I: processMessagesFn(groupJid)
    I->>D: 读取 pending messages / session
    I->>R: runAgent(input)
    R->>R: 再次检查 Host owner 权限
    R->>H: runHostAgent()
    H->>P: spawn node pi-index.js + stdin JSON
    P->>M: Pi Agent Loop 模型请求
    M-->>P: text / tool call
    P-->>H: framed stream event
    H-->>I: parsed AgentOutput
    I-->>W: broadcastStreamEvent
    W-->>C: WebSocket stream_event
    I->>D: sdk_final + session binding
    W-->>C: WebSocket new_message
~~~

### 4.1 前端提交与回流

- ChatView 订阅 stream_event、new_message 和 stream_snapshot：[ChatView.tsx](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/web/src/components/chat/ChatView.tsx#L593-L631)。
- sendMessage() 创建 requestId，向 /api/messages 提交并合并 optimistic message：[chat.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/web/src/stores/chat.ts#L1876-L1965)。
- handleStreamEvent() 对 run 进行 fencing，并批量合并 delta：[chat.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/web/src/stores/chat.ts#L2536-L2979)。
- 断线恢复通过 stream_snapshot 恢复尚未结束的流：[chat.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/web/src/stores/chat.ts#L4169-L4217)。

### 4.2 HTTP、ACL、落库与排队

- /api/messages 先鉴权、解析 schema、检查 group access；Host workspace 还要求 Host execution permission：[web.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/web.ts#L319-L563)。
- 普通消息进入 handleWebUserMessage()，用户消息先落库并广播，再尝试投递给活跃 runner；冷启动时调用 enqueueMessageCheck()：[web.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/web.ts#L679-L1034)。
- GroupQueue 保证同一 group 不重复启动 runner，并在容量允许时调用 processMessagesFn(groupJid)：[group-queue.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/group-queue.ts#L1543-L1601)、[group-queue.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/group-queue.ts#L2526-L2743)。
- processGroupMessages() 读取 pending messages、组装 prompt、取得 Session，并调用 runAgent()：[index.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/index.ts#L5710-L7242)。

### 4.3 Host 与 Container 分流

- runAgent() 根据 executionMode 分流；Host 路径在 spawn 前重新读取 owner 并调用 canExecuteOnHost()：[index.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/index.ts#L9594-L9860)。
- Host 权限只允许有效管理员：[host-execution-policy.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/host-execution-policy.ts#L1-L31)。
- runHostAgent() 对 workspace/custom CWD 做 realpath 与 allowlist 检查，准备受控环境，启动 pi-index.js：[container-runner.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/container-runner.ts#L2326-L3013)。
- stdout 使用 marker framing 后交给 streaming parser：[agent-output-parser.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/agent-output-parser.ts#L1-L177)。

实际进程证据：

~~~text
75923  47244  Wed Nov 25 16:42:20 2026
/home/szz_user/.nvm/versions/node/v24.22.3/bin/node
/home/szz_user/projects/OpenDot-RetailOps/container/agent-runner/dist/pi-index.js
~~~

因此本次普通对话已确认经过 **Host Runner**，不是 Container Runner，也不是 Product Durable Runtime。

## 5. Pi SDK、Agent Loop 与工具调用

### 5.1 锁定版本

| 包 | 实际锁定版本 | 用途 |
| --- | --- | --- |
| @earendil-works/pi-coding-agent | 0.84.2 | 普通 Host/Container agent session |
| @earendil-works/pi-ai（runner） | 0.84.2 | 普通 runner 模型协议 |
| @earendil-works/pi-agent-core（nested） | 0.84.2 | 实际 Agent Loop |
| @earendil-works/pi-durable（root） | 1.3.0 | Product Durable Runtime |
| @earendil-works/pi-mcp（root） | 1.3.0 | Product MCP |

锁定证据：[container/agent-runner/package-lock.json](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/package-lock.json#L1-L20)、[package-lock.json](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/package-lock.json#L1-L20)。

根项目同时锁定 Pi 1.3.0 系列给 Product/Durable 使用，不能据此推断普通聊天也运行在 Pi Durable 1.3.0；普通 runner 的直接依赖和真实 JSONL 均指向 Coding Agent 0.84.2 链路。

### 5.2 OpenDot 适配层

- pi-index.ts 将内置 Miniclaw MCP 工具和外部 MCP 工具适配为 Pi custom tools，并把工具名加入 allowlist：[pi-index.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/pi-index.ts#L330-L367)。
- PiRuntime 解析 provider、加载/创建 JSONL Session、按 allowlist 选择工具，并调用 createAgentSession()：[pi-runtime.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/runtime/pi/pi-runtime.ts#L49-L174)。
- PiRunner 订阅 session event、发起 prompt()，在监督循环中处理 IPC follow-up/interrupt：[pi-runner.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/runtime/pi/pi-runner.ts#L244-L365)。
- PiSession 把 SDK 的 text/thinking/tool execution/agent end 事件转换成 OpenDot runtime event：[pi-session.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/runtime/pi/pi-session.ts#L52-L134)。
- pi-tools.ts 为自定义 MCP 工具适配 schema 并在执行前校验参数；handler 接收 signal 与 toolCallId，不接收 update callback：[pi-tools.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/runtime/pi/pi-tools.ts#L12-L88)。

### 5.3 实际 Agent Loop 所在

本机锁定包的只读源码确认：

1. pi-coding-agent/dist/core/agent-session.js 的 prompt() 完成鉴权/模型校验和 prompt 展开；
2. pi-agent-core/dist/agent.js 调用 runAgentLoop()；
3. pi-agent-core/dist/agent-loop.js 的内层循环调用模型，识别 tool call，串行或并行执行，将 toolResult 追加回上下文，然后继续模型调用；
4. 工具异常会被转换成 tool result，而不是直接丢失 Agent 上下文；
5. 外层循环处理 follow-up。

这些 SDK 文件来自 lockfile 对应的本机 node_modules，不属于仓库提交内容，因此不伪造 GitHub 源码链接；可复核路径为：

~~~text
container/agent-runner/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js
container/agent-runner/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/agent.js
container/agent-runner/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js
~~~

边界结论：**Pi SDK 拥有 Agent Loop；OpenDot 拥有产品级运行编排与适配。**

### 5.4 工具调用与错误回流

~~~mermaid
sequenceDiagram
    participant S as Pi AgentSession
    participant L as Pi Agent Loop
    participant M as 模型
    participant A as OpenDot Tool Adapter
    participant T as bash/write/read/MCP
    participant E as OpenDot Event Adapter
    participant W as Web UI

    S->>L: prompt()
    L->>M: context + tool schemas
    M-->>L: assistant(toolCall)
    L-->>E: tool_execution_start
    L->>A: execute(toolCallId,args,signal,onUpdate)
    A->>A: prepareArguments()
    A->>T: execute
    alt 成功
        T-->>A: content/details
    else 工具错误
        T-->>A: throw/error
        A-->>L: error toolResult
    end
    L-->>E: tool_execution_end
    L->>L: append toolResult to context
    L->>M: continue next model step
    M-->>L: final assistant text
    E-->>W: stream_event + new_message
~~~

外部 MCP 不是 runner 可任意连接的 MCP server。只有 Host 返回显式 session consent 后，runner 才得到 catalog；每次调用提交给 Host，等待 exact-call approval 和执行结果：[external-mcp.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/container/agent-runner/src/runtime/pi/external-mcp.ts#L34-L133)。

## 6. 事件回流与持久化

| 数据 | 载体 | 生命周期 | 用途 |
| --- | --- | --- | --- |
| 流式 UI 状态 | 后端内存 snapshot + WebSocket | 当前 run；终止后清理 | text/thinking/tool 增量与断线续显 |
| 产品消息历史 | SQLite messages | 跨刷新/重启 | 用户消息、最终回复、turn/session/finalization 元数据 |
| Pi Session 上下文 | JSONL transcript | 跨轮次/runner 恢复 | user/assistant/toolResult、模型与工具上下文 |
| Session 绑定 | SQLite sessions | 跨轮次 | group/agent → Pi session/provider/profile |

- 服务端对 stream event 做 run fencing 和访问范围广播：[web.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/web.ts#L3129-L3193)。
- 最终消息通过 sendMessageWithOutcome() 落库并广播 new_message：[index.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/index.ts#L9904-L9973)。
- messages 表保存 turn/session/sdk UUID/source/finalization/delivery 元数据：[db.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/db.ts#L589-L615)。
- canonical final 通过 storeMessageDirect() 写入：[db.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/db.ts#L2769-L2824)。
- group/session/provider/profile 绑定读写：[db.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/db.ts#L7919-L8069)。
- 刷新页面时重新请求消息历史：[chat.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/web/src/stores/chat.ts#L1720-L1802)、[groups.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/routes/groups.ts#L2360-L2481)。

SQLite 中两轮最终回复均为：

~~~text
session_id = 01a2119f-2dd9-7ed6-a513-dc518e6ed130
source_kind = sdk_final
finalization_reason = completed
~~~

Session JSONL 路径：

~~~text
data/sessions/main/.claude/sessions/
2026-11-25T07-32-54-361Z_01a2119f-2dd9-7ed6-a513-dc518e6ed130.jsonl
~~~

本次验证时间窗口的结构化统计：

~~~text
22 lines
roles: user=2, assistant=11, toolResult=9
tools: bash=2, write=2, read=5
first=2026-11-25T08:42:22.417Z
last =2026-11-25T08:43:06.925Z
~~~

页面刷新后仍能检索到原用户请求、两个随机标识和 missing.txt 的真实错误；刷新后同一 Session 又成功执行第二轮只读工具调用。

## 7. Goal、MCP、审批与 Durable Runtime

| 能力 | 入口 | 关键启用条件 | 当前实际状态 |
| --- | --- | --- | --- |
| 普通 Goal API | /api/goals、Tasks/Goals UI | 认证、MINICLAW_PERSONAL_GOALS=true、workspace 授权及 schema/runtime/provider 条件 | API 路由存在；本次未启用/未实测，personal_goals=0 |
| Node Durable | 请求 node-durable | MINICLAW_DURABLE_RUNTIME=true；授权 Host workspace；兼容 provider | flag 未设置，NOT_RUN |
| Cloud Durable | 请求 cloudflare-durable | Cloud admission、HTTPS gateway、shared secret、OpenAI Completions 模型等 | 未配置，NOT_RUN |
| Pi external MCP | MCP catalog/call | piMcpEnabled()；Device Nodes 或 MINICLAW_PI_MCP=true；session consent；每次调用 approval | 默认 false，NOT_RUN |
| Product Approval | Durable artifact/tool flow | pi-durable runtime 未 blocked；owner 决策 | product_approvals=0 |
| Product MCP | Durable/Coding MCP flow | runtime binding、grant、consent、catalog、exact-call approval | 相关表均为 0 |

运行时选择逻辑：[product-model.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/personal-agent/product-model.ts#L147-L215)。

Node Durable Main 入口：[durable-main.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/personal-agent/durable-main.ts#L1-L79)。

Goal API 和自动 provision：[goals.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/routes/goals.ts#L150-L215)。

Pi MCP 默认开关及 fail closed：[device-node-settings.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/personal-agent/device-node-settings.ts#L6-L34)。

Product Approval 仅接受 operation=create_private_artifact 且处于有效 pi-durable runtime：[approval-store.ts](https://github.com/2Zest/OpenDot-RetailOps/blob/d8f3c729a9fd8e38d34db80fac0c63098183e493/src/personal-agent/approval-store.ts#L117-L221)。

本机数据库计数：

~~~text
personal_goals=0
product_session_runtimes=0
product_approvals=0
product_mcp_calls=0
product_mcp_session_consents=0
product_mcp_decisions=0
~~~

因此普通对话成功不能证明 Goal、MCP、审批或 Durable Runtime 已通过。

## 8. 真实运行验证

### 8.1 隔离范围

- 执行 workspace：data/groups/main
- 专用目录：retail-00b-01-fixture/
- 只新增两个 20-byte fixture；未修改源码、配置、数据库 schema 或 lockfile。
- 测试标识：RETAIL00B01-A-7F3C9D、RETAIL00B01-B-2A6E41
- 不存在文件：retail-00b-01-fixture/missing.txt

### 8.2 结果矩阵

| 验证项 | 结果 | 证据 |
| --- | --- | --- |
| 真实模型普通回复 | PASS | Session JSONL model change + sdk_final/completed |
| 实际执行模式 | PASS（Host） | SQLite execution_mode=host + pi-index.js PID |
| Provider / 模型 | PASS | miniclaw-anthropic / deepseek-flash |
| 多步工具调用 | PASS | 9 个 toolCall/toolResult |
| 隔离 fixture 写入/回读 | PASS | write=2，内容精确回读 |
| 工具错误回流 | PASS | missing.txt → ENOENT，模型继续完成 |
| 同 Session 后续调用 | PASS | 两轮共用同一 Session ID |
| 页面刷新消息持久化 | PASS | 刷新后测试标识与错误仍存在 |
| Container Runner | BLOCKED | 缺少 helsome/miniclaw-agent:latest |
| 外部 MCP / 审批 | NOT_RUN | 功能未启用、相关表为 0 |
| Goal / Durable / 重启恢复 | NOT_RUN | Durable flag 未设置、runtime/goal 表为 0 |
| cancel/retry | NOT_RUN | 不擅自制造长任务或扩大副作用 |

错误原样证据：

~~~text
ENOENT: no such file or directory, access
'/home/szz_user/projects/OpenDot-RetailOps/data/groups/main/retail-00b-01-fixture/missing.txt'
~~~

## 9. 定向测试

~~~bash
npm test -- --run   tests/pi-provider-protocol.test.ts   tests/agent-turn-message-stream.test.ts   tests/routes-messages-acl.test.ts   tests/session-provider-binding.test.ts   tests/group-queue-host-session-concurrency.test.ts   tests/host-ipc-output-router.test.ts   tests/ipc-send-dedup.test.ts   tests/session-history.test.ts
~~~

结果：

~~~text
exit code: 0
test files: 8 passed
tests: 58 passed, 0 failed, 0 skipped
duration: 24.68s
warning: web/dist not found during one route test；断言仍通过
~~~

本次没有重跑或掩盖 RETAIL-00A 已记录的完整测试失败。

## 10. 可扩展点与禁止误用

| 候选扩展点 | 合理用途 | 不应做的事 |
| --- | --- | --- |
| Agent Profile 四段 Prompt | 注入 RetailOps 角色、约束、工具说明 | 把业务事实硬编码进通用 runtime |
| customTools / pi-tools adapter | 接入零售查询、草案生成工具 | 绕过参数校验、AbortSignal 或审计 |
| External MCP consent/catalog | 接入需要授权的外部系统 | runner 直接持有长期凭据或自行发 grant |
| GroupQueue / task scheduler | 复用并发、排队、重试、fencing | 在业务层再造第二套并发控制 |
| StreamEvent / message metadata | 展示零售步骤、证据和状态 | 只依赖内存流作为最终事实 |
| Product Durable + Approval | 长任务、显式批准、可恢复执行 | 将普通聊天成功等同 Durable 已通过 |
| SQLite + JSONL | 分别保存产品历史和模型上下文 | 合并成无边界的单一日志 |

RetailOps 后续实现应优先使用“领域工具 + Prompt/Profile + 既有审批/持久化契约”，避免修改 Pi Agent Loop 或通用 Host/Container Runtime。

## 11. 未确认事项

1. Container image 未安装，未验证 Container Runner 与 Host Runner 的行为一致性。
2. 未启用 Node Durable，未验证 checkpoint、进程重启恢复、suspend/resume。
3. 未配置 Cloud Durable，未验证 Cloud authority、device evidence 或 cloud handoff。
4. 未启用 Device Nodes/Pi MCP，未验证 session consent、exact-call approval、timeout/cancel。
5. 未创建 Goal，未验证 Goal budget、状态机、完成证据和人工确认。
6. 未执行取消/重试/并发压力场景；定向测试通过不等于运行级压力证明。
7. Pi Session JSONL 写入与同一 Session 跨轮次调用已验证；本次未停止整个服务，因此重启后 SDK Session 恢复未验证。Product Durable checkpoint 恢复亦未验证。

## 12. 关键源码阅读顺序

1. web/src/stores/chat.ts：用户请求、流式状态和消息重载。
2. src/web.ts：/api/messages、ACL、普通/Durable 分流和消息入队。
3. src/group-queue.ts：group 串行化、容量、冷启动和 follow-up。
4. src/index.ts::processGroupMessages()：pending message 到 prompt/run 的主编排。
5. src/index.ts::runAgent()：Host/Container 分流、权限复检和 Session 更新。
6. src/container-runner.ts::runHostAgent()：路径隔离、环境、spawn 和 framing。
7. container/agent-runner/src/pi-index.ts：provider、内置工具和 external MCP 组装。
8. pi-runtime.ts、pi-runner.ts、pi-session.ts、pi-tools.ts：Pi 适配边界。
9. 锁定 SDK 的 agent-session.js、agent.js、agent-loop.js：真正 Agent Loop。
10. broadcastStreamEvent()、src/db.ts、routes/groups.ts：事件回流与持久化。
11. product-model.ts、product-runtime.ts、approval-store.ts、mcp-session-store.ts：最后看 Product Durable、MCP 和审批。

## 13. 源码面试问题

1. 为什么用户消息要先落 SQLite 再启动 runner？先 spawn 后落库会出现哪些恢复与幂等问题？
2. runAgent() 为什么在 Host spawn 前再次检查 owner 权限？仅在 HTTP 层检查为什么不够？
3. Pi Agent Loop 与 OpenDot runtime adapter 的边界是什么？工具异常如何重新进入模型上下文？
4. stream_snapshot、SQLite messages 和 Pi JSONL Session 分别解决什么问题？为什么不能只留一个？
5. 普通 pi-coding-agent 与 Product pi-durable 如何分流？哪些 flag、workspace 和 provider 条件决定 runtime？
6. External MCP 为什么要同时具备 session consent、catalog digest、grant、exact-call approval 和 cancel generation？

## 14. 最终判定

- **调查目标：CONFIRMED**
- **Host 普通对话/Tool Calling/错误回流/刷新持久化：PASS**
- **Container Runner：BLOCKED**
- **Goal/MCP/Approval/Durable Runtime：NOT_RUN**
- **RETAIL-00A 完整运行基线：仍为 PARTIAL**

本报告只确认已有通用 Agent 能力及其边界，不声称任何 RetailOps 业务能力已经实现。

## 15. RETAIL-00B-01-R1 审查勘误与补充

以下修订是本节的权威结论；它们明确纠正前文中不准确或易被误读的说法。

### R01：原始运行测试范围

原始测试发生在管理员 Home workspace `data/groups/main` 的专用子目录 `retail-00b-01-fixture/`。Agent 在任务中执行了两次 `write`，随后执行读取，并触发缺失文件错误。该事实保留在上文统计中。这只能称为“Home 下的专用目录测试”，不能称为“独立 workspace 隔离测试”或“Agent 只读测试”。

本轮补充测试为 BLOCKED：当前没有可证明只允许 `read`、并拒绝 `write` 的独立 Host 测试 workspace；Container Runner 镜像缺失。复用 Home 会话会违反原 Issue 的隔离约束。故本轮没有创建 fixture，没有发起工具调用/事件，没有取得 fixture 前后 SHA-256，也没有开展拒绝写入测试。没有更改权限策略或开关。准备程序创建 fixture 与 Agent 只读限制均未验证。

### R02：Product Approval 边界

`src/personal-agent/approval-store.ts` 将 operation 类型和数据库 CHECK 均限制为唯一值 `create_private_artifact`（源码链接见第 7 节）。Product Approval 不是可直接复用的通用零售审批。MCP exact-call approval 仅是候选工具调用授权机制。RetailOps 仍需定义领域草案、数据快照、经营政策版本、业务审批与执行回执；具体复用边界由 RETAIL-00B-03 调查确定。本次不改审批源码或数据库。

### R03：工具适配边界

`pi-tools.ts` 的自定义 handler 接收 `(params, { signal, toolCallId })`；没有 update callback 参数或透传。Pi SDK 原生 `read/write/bash` 由 `createAgentSession()` 按 SDK 工具列表管理。`adaptClaudeMcpToolsToPi()` 只适配传入的 Miniclaw 自定义 MCP 工具，不负责全部内置 Pi 工具。具体源码见第 5.2 节链接。

### R04：调用数量口径

“两轮模型调用”统一解释为“两轮用户任务/对话”。本次可证据化的结构统计是：user 消息 2、assistant transcript 记录 11、toolResult 记录 9、工具调用 9（bash 2、write 2、read 5）。assistant 记录不等同模型 API 请求；本次没有请求级日志，故不报告模型 API 请求总数。

### R05：Goal 启用门槛

`GET /api/goals/availability` 需要认证并读取 `MINICLAW_PERSONAL_GOALS=true`；其余 Goal 路由由相同 flag 守门。路由被注册不代表功能已启用。通过开关后还需符合 workspace 授权、schema、运行模式/Provider 和 Cloud 条件。当前运行证据显示 Goal 表为 0；Goal 未实测。源码证据见 [goals.ts availability](https://github.com/2Zest/OpenDot-RetailOps/blob/2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea/src/routes/goals.ts#L70-L95) 与 [workspace gate](https://github.com/2Zest/OpenDot-RetailOps/blob/2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea/src/routes/goals.ts#L91-L132)。

### R06：恢复验证边界

- 页面刷新后通过服务端历史接口重新加载 SQLite 消息：已验证。
- Pi Session JSONL 文件写入：已验证。
- 同一个 Session ID 跨两轮用户任务继续调用：已验证。
- 停止服务并重启后 Pi Session 恢复：未验证。
- Product Durable checkpoint 恢复：未验证。

源码存在恢复/打开 Session 的路径不能替代实际重启恢复测试。本轮没有停止或重启当前服务，因此没有中断其他任务。

### R07：Issue 状态同步

原任务契约曾保留 READY。原始 PR #3 已合并，当前修订期间将 Issue 状态同步为 REVIEW；契约中的原验收条件不变，未通过改写条件消除 R01 偏差。

### R08：证据时间与状态分层

原始 58 项定向测试、Home 运行、SQLite/JSONL 统计是 PR #3 的历史证据，不是本次重跑。本轮只对文档进行了源码对照修订及安全范围判断；新增加的 R01 独立只读验证为 BLOCKED。原始报告与 RETAIL-00A 的完整基线状态均不因本轮修订而变为 PASS。审查结论为“待 Review”。
