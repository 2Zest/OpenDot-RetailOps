# RETAIL-00B-01-PLAN | 调查执行计划

对应 Issue：`docs/retailops/issues/RETAIL-00B-01.md`。固定源码基准 `0db0ba1bbf658d217f248bf29b5715bcbf09ccac`，集成基准 `d8f3c729a9fd8e38d34db80fac0c63098183e493`。以下行号已在固定源码基准抽查，执行者必须确认当前源码一致，不直接照抄候选调用链。

## Step 0 | Git 预检

在 WSL 执行 `git status --short`、`git branch --show-current`、`git fetch origin`、`git rev-parse origin/develop/retailops`、`git diff --stat 0db0ba1..origin/develop/retailops`。若存在未提交图标或其他改动，保留原工作树，必要时使用独立 worktree（不要强制切换、覆盖或删除）。核对远程调查分支，不存在才从最新 develop 创建并推送；若基线发生源码变更，记录差异后决定是否重新核对锚点。将 Issue/Plan 复制到指定目录。禁止在 main 上提交。

## Step 1 | 消息入口、队列与权限

已核实的源码锚点（各边仍需本地追踪）：

| 文件 | 锚点 |
|---|---|
| `web/src/stores/chat.ts` | L1876 `sendMessage`，L1928 POST `/api/messages`，L2536 `handleStreamEvent`，L4169 `handleStreamSnapshot` |
| `src/web.ts` | L319 POST `/api/messages` + authMiddleware，L1033 `enqueueMessageCheck`，L3129 `broadcastStreamEvent` |
| `src/group-queue.ts` | L227 GroupQueue，L1543 `enqueueMessageCheck`，L2602–2603 `processMessagesFn` |
| `src/index.ts` | L5710 `processGroupMessages`，L9594 `runAgent`，L21515 注册 processMessagesFn |
| `src/container-runner.ts` | L1692 `runContainerAgent`，L2326 `runHostAgent`，L2748 runner 路径，L2836 `spawn` |

追踪实际页面组件调用 store 的位置、消息 payload、HTTP 响应、ACL、DB 写入、request ID、队列决策与 Host 选择条件。分别记录首次/已有 runner 的分支，以及重复请求、排队、停止、错误处理。`rg` 搜索调用者与定义；不要把所有 `storeMessageDirect` 调用都当成同一链。确认普通对话与 Product Runtime 分流实际条件。

## Step 2 | Pi Runtime 和 Provider

| 文件 | 锚点 |
|---|---|
| `container/agent-runner/src/pi-index.ts` | L345 `runPiQueryAttempt`，L440 `main` |
| `container/agent-runner/src/runtime/pi/pi-runner.ts` | L244 `runPiQueryAttempt`，L247 createSession，L256 subscribe，L286 prompt，L303/312 abort，L320 followUp，L355 dispose |
| `container/agent-runner/src/runtime/pi/pi-runtime.ts` | L49 `createSession`，L65 Provider resolution，L118–119 SessionManager open/create，L122 customTools，L160–169 createAgentSession |
| `container/agent-runner/src/runtime/pi/pi-provider.ts` | 自定义 Provider 协议选择、注册与模型解析 |
| `container/agent-runner/src/runtime/pi/pi-session.ts` | L52 mapPiEvent，L69–86 tool execution events，L205 subscribe，L234 prompt，L254 abort |

读取锁定的 Pi Coding Agent/Pi AI 依赖实际包名、版本与实现（如已安装）。追踪 `createAgentSession`/`session.prompt` 进一步委托的位置，确定 Agent Loop 是项目实现还是依赖实现；记录模型请求、toolUse、执行、结果回填、下一轮推理、终止/错误/预算分别由谁负责。若 SDK 内部未读取到，明确边界 UNKNOWN，不能发明函数名。不得打印实际 Provider 密钥或完整环境变量。

## Step 3 | Tool Calling 接入候选

`container/agent-runner/src/runtime/pi/pi-tools.ts` L64 `adaptClaudeMcpToolsToPi`、L70 `defineTool`、L77 execute；`external-mcp.ts`、`pi-runtime.ts` customTools/selectedTools 分支及 runner 的工具构造调用者。确认内建 bash/read 等与自定义/外部 MCP 工具区别、schema 转换与校验位置、toolCallId、AbortSignal、异常回传、工具过滤/授权边界。检查 Host 执行权限相关 `src/host-execution-policy.ts` 和工作区约束。提出候选接入点对比：直接 Pi customTools、现有 MCP 适配路径；分别说明普通 Host 能否复用、Product Durable/Approval 尚需后续调查的接口差异。不选定最终权限设计，不新增工具。

## Step 4 | 事件与持久化

从 `pi-session.ts` mapPiEvent → `pi-runner.ts` toStreamEvent/emitRuntimeEvent → `container-runner.ts` 输出处理 → 后端消息落库与 `src/web.ts` broadcastStreamEvent → 前端 chat store，逐边核实 stdout/IPC/WebSocket 协议、run/session/message/tool ID 映射、顺序/终止事件。区分 `src/db.ts` 中实际表与 Pi SessionManager 文件，检查历史重载、刷新重连、取消和重复事件去重依据。若同一路径存在不同模式，不拼接成虚构的统一链。可阅读 `src/host-ipc-output-router.ts` 作为 IPC 路由线索，但仅在证明与实测链路关联时纳入主图。

## Step 5 | 安全实测与回归

在隔离测试 workspace 中准备两份仅含随机非敏感 marker 的小文件（记录 fixture 创建/清理动作，Agent 只读）。保留原 Home 会话与配置，不创建未知外部工具，不提交本地数据。

| 场景 | 观察 | 判定 |
|---|---|---|
| 普通模型回复 | 实际 runtime、非零 usage、最终事件 | 真实模型回复，不靠模型自述 |
| 只读工具 | 真实工具名、call/result ID、fixture marker | 从工具结果获取 marker |
| 多步 | 两份 fixture 需要顺序读取 | 工具调用和结果顺序与最终回复可关联；如模型并行执行则按实际记录，不伪造顺序 |
| 缺失文件 | 安全不存在路径 | 工具失败/错误可见，无伪造成功 |
| 刷新/返回 | 消息与事件历史 | 比较刷新前后，区分 UI 状态与持久化 |
| 权限/取消/重复 | 既有测试或受支持安全入口 | 记录实际拒绝、停止或去重；不安全或不支持则 NOT_RUN |

先使用已有运行服务，避免不必要重建/重启；若需服务重启，取得用户确认并确保没有其他任务。只记录脱敏事件计数、必要的测试标识与相对时间，禁止输出凭据、原始私人消息、全量环境变量。必要时可复用上一轮脱敏证据，但标明历史证据、不是本次执行。

已确认存在的候选回归（先阅读测试内容，再选择相关用例）：`tests/pi-provider-protocol.test.ts`、`tests/agent-turn-message-stream.test.ts`、`tests/routes-messages-acl.test.ts`、`tests/session-provider-binding.test.ts`、`tests/group-queue-host-session-concurrency.test.ts`、`tests/host-ipc-output-router.test.ts`、`tests/ipc-send-dedup.test.ts`、`tests/session-history.test.ts`。建议按相关小组执行 `npm test -- --run <已确认测试文件>`，保留命令/退出码/计数及失败摘要；不要重复跑全量作为唯一目标，也不修测试。检查实际 npm script 支持参数传递。

## Step 6 | 调查报告格式

输出 `docs/retailops/investigation/RETAIL-00B-01.md`：

1. 调查环境、源码 SHA、依赖版本、范围与证据等级（S 静态源码 / R 真实运行 / T 自动化 / U 未确认）。
2. 两张 Mermaid 时序图：首次普通 Host 请求与已有 runner 请求（若后一条不确定则标候选）；工具执行循环与事件回流可分图。
3. 调用边矩阵：调用方（路径/行号）→ 被调方（路径/行号或 SDK 版本/文件）→ 触发条件 → 数据/标识 → 证据 → 错误分支。附 `https://github.com/2Zest/OpenDot-RetailOps/blob/<实际固定SHA>/<path>#L<start>-L<end>` 链接。
4. 数据与生命周期表：会话、消息、runner、tool、事件、存储、权限与取消；列实际 schema/字段，禁止凭空设计原项目表。
5. 运行/测试证据矩阵：命令、结果、模式、证据位置、失败/未测原因。区分历史记录、当前真实模型、fixture 和自动化。
6. RetailOps 候选扩展点评估：复用能力、需要扩展的能力、权限/审计/状态风险、必须在 00B-02/03 决定的问题；不把普通 bash 或 Workspace Memory 当成 Product MCP/Approval。
7. 学习导读：建议源码阅读次序与 6 个面试自测问题（Agent Loop、工具 schema、Host 与 Container、流式事件、会话恢复、权限）；用实际源码解释，不新增虚构能力。
8. 调查结论及待验证项；00A 仍 PARTIAL，独立列出本轮是否满足调查验收。

## Step 7 | Git 与交付

运行 `npm run docs:check`、`git diff --check`、检查 staged 文件清单。只提交 Issue、Plan、调查报告及必要脱敏文档。若未授权/无法推送，报告阻塞。创建 PR 到 develop/retailops，正文列本轮范围、证据、未确认事项、测试结果，不自动合并。回传 PR URL、实际 SHA、文件清单、测试结果与建议审查顺序。

