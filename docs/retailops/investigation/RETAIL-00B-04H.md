# RETAIL-00B-04H Handoff 独立风控接口调查

**Issue：** [#11 RETAIL-00B-04H](https://github.com/2Zest/OpenDot-RetailOps/issues/11)
**基线：** e8db2b6b983e9cd2eeca79e596f81b2e5b93663a（origin/develop/retailops）
**分支：** docs/retail-00b-04h
**状态：** REVIEW（PR #78 Open、未合并，等待独立 Review；Issue #11 为 Open/REVIEW）。
**范围：** 只读源码调查与隔离 fixture 定向测试；未改业务源码、运行配置或依赖。总体计划 G0 已由用户批准并解除。DAG 中 #11 无上游硬依赖，下游为 RETAIL-00C 与 #18 RETAIL-00B-04V；本调查不满足下游真实运行验收门槛。

## 结论

现有源码提供后续可复用的委派骨架：Scheduler occurrence 持有 lease 与冻结 Goal 上下文，Goal Team 选择 Group 中获授权的 Bot，Handoff 为接收 Bot 建立独立 session。执行边界会复核 owner、当前成员 revision、grant、workspace、配置指纹、deadline、lease 与工具白名单。失败或结果不确定时不会依据模型陈述完成 Goal；恢复路径复用原 Handoff 和 native submission。

但当前路径没有专门的“独立风控 reviewer”身份、角色字段、评审决策或强制职责分离机制。Goal Team Bot 是获授权的执行接收者，不等同于独立风控角色。现有 Product Approval 仅用于 create_private_artifact，不能作为零售业务审批。建议后续设计区分分析者、风控审查者与执行者，并将审查决定绑定到不可变业务草案摘要、数据版本、政策/规则版本和工具范围，在业务写入前由服务端验证。此为调查建议，不是已实现能力。

**本地可行性：** 可用 Node Durable、host workspace 和显式批准的 local provider/grant 作为后续隔离候选；现有 HTTP fixture 已证明本地进程编排、授权与恢复测试路径可运行。含设备文件资源的 Goal Team 需要 cloud Durable grant，不能用它证明本地只读数据路径。此次未配置真实 provider、商超数据或写接口，也未进行 #18 独立运行验收。fixture 结果只证明 fixture 下行为，真实零售风控与 Runtime 仍未验证。

## 源码调查

所有源码引用固定在 e8db2b6b983e9cd2eeca79e596f81b2e5b93663a。

### N1：委派、lease、身份和恢复

- executeGoalRuntimeStep 检查冻结 Goal snapshot，再将带 Goal Team 的 Scheduler run 委派至 executeGoalTeamStep：[goal-runtime.ts:21–35](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-runtime.ts#L21-L35)。
- GoalTeamSchema 约束 1–2 个唯一 Bot member，绑定不可变；schema 没有 risk reviewer 字段：[goal-team-store.ts:25–40](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L25-L40)。chief 要求 Group owner、同一 owner 的 host workspace 与有效默认 profile：[goal-team-store.ts:173–196](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L173-L196)。
- admitGoalTeamStep 在事务中核验 running run 与 lease owner/token/expiry，选择仍有效授权的 Bot，冻结 Goal snapshot、grant ID/digest、deadline 和工具范围后建立单个 Handoff：[goal-team-store.ts:489–622](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L489-L622)。
- assertGoalTeamHandoff 复核精确 run/goal/session/owner、Scheduler 状态和 lease、isolated host task 与运行时记录；goalTeamSourceAllowed 失败关闭：[goal-team-store.ts:279–345](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L279-L345)。
- executeGoalTeamStep 等待时重验 claim 与 lease；failed、uncertain、cancelled 不完成 Goal；完成还要核对 artifact receipt 与 content digest：[goal-team-runtime.ts:27–112](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-runtime.ts#L27-L112)。verifiedGoalTeamResult 要求完成态结果消息匹配 handoff ID 和 digest：[goal-team-store.ts:418–446](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L418-L446)。

### N2：接收者工具范围与只读权限

- BotHandoffService 将 Handoff 作为关联/投影层，执行交由既有 Product Runtime/Pi Harness；provision 创建独立 Bot session，提示将 Group 消息视为不可信数据并仅用显式授权工具：[handoff-service.ts:64–66](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L64-L66)、[handoff-service.ts:78–162](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L78-L162)。
- assertBotHandoffAuthority 在执行边界复核 owner、目标成员及 revision、grant/profile/workspace、配置指纹/provider、digest、状态与 deadline，并拒绝不在有效能力列表中的工具：[handoff-store.ts:146–226](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L146-L226)。Goal Team 将当前授权能力冻结入 contract：[goal-team-store.ts:551–566](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L551-L566)。
- grant 枚举能力为 read_workspace_file、create_approved_artifact、inspect_text、read_device_file，最多两项：[handoff-store.ts:60–76](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L60-L76)。未发现零售交易/库存写能力；create_approved_artifact 本身是写效果，不能称为只读授权。
- assertBotHandoffSubmission 将 session input 绑定到原 request、payload、sender 与 queue 行为：[handoff-store.ts:962–988](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L962-L988)。prepareBotHandoffControl 限制 owner、expected_revision 与合法控制迁移：[handoff-store.ts:1563–1655](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L1563-L1655)。
- Product Approval 的 operation 和 SQLite constraint 均限于 create_private_artifact：[approval-store.ts:37–60](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L37-L60)、[approval-store.ts:67–89](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L67-L89)。它不足以代表价格、库存或促销决策的独立业务审批。

**接口建议（待批准设计）：** reviewer 应与分析者和执行者身份不同，限只读能力，读取固定版本草案和证据，只能提交结构化 approve/reject/request-evidence 决定。决定绑定草案 ID/digest、数据版本、规则/政策版本、reviewer ID、能力范围、有效期和 request ID。执行服务在产生效果前验证角色分离、版本未变、批准未过期且仅消费一次。现有 Handoff 可提供独立 session、权限边界和恢复机制，但缺少 reviewer 角色、零售审查合同与执行时消费门禁，不能宣称已有该接口。

### N3：本地候选

- Handoff grant 支持 Node Durable；provision 检查 runtime kind、local/cloud 状态、配置指纹和 provider 是否匹配：[handoff-service.ts:78–96](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L78-L96)。
- Goal Team 要求 host workspace；声明 device resource 要求 cloud grant 与 read_device_file：[goal-team-store.ts:198–267](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L198-L267)。后续本地候选应不含设备资源。
- 测试 helper 使用临时数据根、独立 HOME/端口、loopback fake provider 与 Node 子进程：[bot-handoff-http-fixture.ts:36–65](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/tests/helpers/bot-handoff-http-fixture.ts#L36-L65)、[bot-handoff-http-fixture.ts:115–215](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/tests/helpers/bot-handoff-http-fixture.ts#L115-L215)。这是本机隔离测试候选，不是实时模型、真实零售数据/写接口或 #18 运行验证。

## 验证结果

环境为 WSL2 Ubuntu 24.04.1、Node v24.22.3、npm 11.19.1。测试窗口前后 MemAvailable 约 12 GiB；根文件系统约从 944 GiB 降至 942 GiB 可用。

| 检查 | 命令与退出码 | 结果 |
|---|---|---|
| 安装 | npm ci / 0 | 803 packages；npm 报 48 项 audit advisory（2 low、20 moderate、23 high、3 critical），未执行 audit fix，未改 package/lock。 |
| T01/T02 定向测试 | 见下方命令 / 0 | 4 files、16 tests passed，73.35 秒。只作为隔离临时数据库/子进程/loopback fake model fixture 证据。 |
| 文档工程检查 | 上一轮已运行 / 1；本轮 NOT_RUN | 曾因 docs/retailops/RETAILOPS-ROADMAP.md:1 的失效链接失败。公共修复尚未合并，按 Review 指示暂不复跑；合并后复验。 |
| 差异检查 | git diff --check / 0 | 无源码 diff；提交前复查文档。 |

    PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm test -- --run tests/goal-team.test.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts

## 边界与后续

- 没有云部署、真实模型或商超 API/数据运行，没有业务写动作，也没有 #18 运行验收。
- #18 仍须等待 DAG 的其他硬依赖（含 00F、00B-02V）和自身隔离运行授权；本报告不解锁它。
- 上一轮 docs:check 失败按基线问题记录；公共修复未合并，本轮未复跑，合并后复验。
- npm audit 信息仅记录；不升级依赖或变更安全策略。
- 仅本报告与本 Issue 验收回执可修改；回滚为独立 revert 这两份文档。


## Node/Cloud 能力矩阵、开关与前置条件（Review 补充）

本节是固定源码 e8db2b6 的静态调查结论，不代表本轮启动了 Node 或 Cloud Handoff。实际运行开关要求值为 true；默认关闭。依据：[Node Handoff 文档](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/personal-agent/bot-handoffs.md#L3-L20)、[Cloud Handoff 文档](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/personal-agent/cloud-bot-teams.md#L240-L257)、[Runtime 选择](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L147-L215)、[Cloud flags/grant](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L47-L76)。

| 路径 | 实际开关 | Provider / Workspace / Session | Grant 与能力边界 |
|---|---|---|---|
| Node Durable Handoff | MINICLAW_BOT_GROUPS=true、MINICLAW_BOT_HANDOFFS=true、MINICLAW_DURABLE_RUNTIME=true。Durable flag 会 trim/lowercase；两个 Group flags 按精确 true 检查。 | 选择 node-durable。Enabled Provider 要有 model ID 和 API key/token；Node Durable 接受 openai-completions 或 anthropic-messages。Goal Session 要已授权 Host Workspace 与 Host 执行权；Node Handoff target 可为 owner 所有的 Host 或 Container Workspace（Host 仍需 Host 执行权）。Handoff 新建 Product/Node Durable Session 和持久 origin，不接管旧 Session。 | Owner 对 active Bot 建显式 grant：1–12 次模型尝试、1–1440 分钟、最多 2 项能力，默认空。Node 可按当前 schema 读 Workspace 或创建 private artifact；inspect_text/device read 对 Node grant 拒绝。只读验证仅授予必要读取能力，不启用 artifact 写效果。 |
| Node Goal Team | 再加 MINICLAW_PERSONAL_GOALS=true、MINICLAW_GOAL_TEAMS=true。Team admission 仍要求 Groups/Handoffs flags。 | Goal、Group 及每个 Bot 的 scoped workspace 均须属于同一 owner 的 Host Workspace；active chief/default profile；新 Goal 尚未启动。Goal coordinator Session 与所选 Bot Handoff Session 分开，coordinator 不接收 native input。 | 每个 Bot 都须有当前、未撤销、未过期的 scope grant，revision/profile/workspace 与当前目标一致。Device resource 不能走 Node read_device_file。 |
| Cloud Durable Handoff | MINICLAW_BOT_GROUPS=true、MINICLAW_BOT_HANDOFFS=true、MINICLAW_CLOUD_RUNTIME=true、MINICLAW_CLOUD_BOT_HANDOFFS=true。Cloud Handoff 默认关闭，无 Cloud 到 Node 自动 fallback。 | 还要求 owner Host Workspace/Host 执行权、精确 HTTPS gateway origin、shared secret 至少 32 字符、已授权 OpenAI Completions Provider。Product Session 与 Cloud placement/association 独立绑定；Node Gateway 仍参与授权、encrypted Provider proxy、tool effect 和结果投影。 | Cloud grant 默认空工具，支持 inspect_text；read_workspace_file 拒绝。create_approved_artifact 需另启 MINICLAW_CLOUD_APPROVALS。model budget/deadline/tool list 必须与 Cloud marker 精确相符。 |
| Cloud Goal Team / 可选能力 | Goal Team 另需 MINICLAW_PERSONAL_GOALS=true、MINICLAW_GOAL_TEAMS=true、MINICLAW_CLOUD_GOALS=true；当前 cloudGoalAvailable 还要求 create_approved_artifact capability，因此还须 MINICLAW_CLOUD_APPROVALS=true（有写效果，需单独审批）。Device read 另需 MINICLAW_CLOUD_DEVICES=true、MINICLAW_DEVICE_NODES=true。 | Goal/Group workspace 仍需 owner Host workspace。Device 必须是 owner active paired node，路径在 manifest 中，且至少一个 Bot 有 cloud read_device_file grant。 | Product Runtime 的 Cloud memory capability 自身要求 MINICLAW_CLOUD_MEMORY=true 与 MINICLAW_PERSONAL_MEMORY=true；但当前 Handoff reviewed grant enum 不含 read_personal_memory，Handoff 不继承全局 memory capability，单设这些 flags 不会给 Handoff 增权。本任务与未来 #18 均不启用 memory、artifact 或 device 能力。 |

Cloud Goal Team 的额外 artifact prerequisite 来自 [cloudGoalAvailable](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/automatic-goal.ts#L26-L53)：它检查 Cloud runtime 能力含 create_approved_artifact，因此需显式 Cloud approvals；这有写效果，Node 本地路径更适合只读验证。Cloud Runtime 仅在 CLOUD_MEMORY 与 PERSONAL_MEMORY 同时开启时构造 read_personal_memory，但 Handoff grant schema 没有该能力，且 [Cloud Handoff 文档](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/docs/personal-agent/cloud-bot-teams.md#L50-L57)说明不继承 memory；flags 本身不会让 Handoff 取得 memory。Device read 的额外开关及配对 manifest 校验见 [grantBotRuntime](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L295-L304) 和 [bindGoalTeam](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L217-L253)。

Provider/身份绑定见 [productModelConfiguration](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-model.ts#L42-L145)：Provider 必须 enabled，含明确 model ID 和 key/token；Node API 限于 OpenAI Completions 或 Anthropic Messages；Cloud 限 OpenAI Completions。配置指纹包含 provider/API/endpoint/model/workspace folder/root/profile。Host Workspace 的 owner 必须 active 且具 Host 执行权限。Bot 接收者必须是 Group 内 active、由 owner 授权到 scope workspace 的 Bot。grant 冻结 Provider ID/config fingerprint/member revision；每次 provision/执行会复核：[grantBotRuntime](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L259-L342)、[botGroupExecutionTarget](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/store.ts#L1141-L1162)、[bindBotHandoffSession](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L845-L912)。Session 为新建随机身份并带永久 origin marker，不采用历史 Session。Node runtime 在本机进程执行，不等同于本地推理：若 #18 要求本机模型，应使用获批、API-compatible 且与隔离实例连通的本机模型服务；配置在 Node 的远程 API 仍属于外部 Provider 调用，需单独授权，不能当作本机推理证据。

## #18 RETAIL-00B-04V 真实 Handoff 验证方案（本轮未执行）

#18 的 Issue/Plan 要求硬依赖 00F、00B-04H、00B-02V、专用实例与角色，不连接商超写接口。当前 PR #78 尚未合并，运行门槛未满足。本节只固定未来计划；本轮没有启动 Runtime、改 flags、创建角色或调用模型。

前置步骤：记录 develop/retailops 固定 SHA、上游验收证据、独立 HOME/DB/端口/Session 数据目录、Owner/Workspace/Provider/Grant 配置。优先评估 Node Durable 本地路径；缺少可用且获批的本地 Provider 时标 BLOCKED，不自动转 Cloud。Cloud 只有在 Gateway/部署和权限单独获批、配置检查完整时才可选。

| 场景 | 未来动作（需 #18 单独授权） | 通过预期与证据 |
|---|---|---|
| T01 正常委派 | 在隔离 Owner/Chief、目标 Bot 和安全测试 Workspace 中，以 Goal Team 的 Scheduler occurrence 经正式 Handoff 执行一项只读测试任务。 | 唯一 run/goal/handoff/session/request/input/submission/Task 关联；coordinator 无 native input，接收 Bot 使用新 Session；实际工具属于 reviewed grant；只创建一份原始 native input/submission；恢复可能在原预算内重试模型请求，不宣称 inference/billing exactly-once。完成只能由服务端 receipt/evidence 佐证。保存 IDs、grant digest、日志和工具审计。 |
| T02 角色隔离 | 记录 owner/chief coordinator 与 recipient Bot 的 profile/member/session 映射，分别确认可见与执行权限。 | Goal coordinator Session 与 Handoff Session ID 不同；coordinator 不执行、不持有 recipient native input；Group membership 不赋予执行权。只能证明现有协调者/接收者分隔。源码没有 RetailOps 独立风控 reviewer 角色，禁止创建业务风险 Agent，也不能宣称已有风控职责分离或草案摘要绑定。 |
| T03 越权拒绝 | 以 invited member/other admin 尝试 start/control/read approval；另验 revoked/expired grant、stale member revision、错误 Provider/config fingerprint、未授权工具。 | 未授权 actor 的控制/审批请求须在 admission 前拒绝，不触发 Provider 调用；模型提出未授权工具时允许已发生的推理请求，但 tool boundary 必须拒绝，且不得创建对应 Tool Task/业务效果。保存 actor、请求与响应码、state/revision、grant 摘要以及无副作用证据。现有 fixture 参考：[安全用例](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/tests/bot-handoff-security.test.ts#L15-L185)。 |
| T04 Lease 中断恢复 | 停止隔离实例自身 Node process；记录旧 lease owner/token/expiry；待 lease 超时后走正式重启/接管路径。 | 新 claim 可以有新 lease，但复用原 occurrence、goal、handoff、session、input、submission、Generation Task；无新 prompt/替代 grant/重复效果。保存前后只读 DB 快照、日志、时间线及 Provider 请求计数。 |
| T05 failed/uncertain 不完成 | 在隔离测试下触发 Provider interruption、取消或投影 receipt 故障；故障注入只用已有 test seam/fixture，不加生产开关、不触碰业务 API。 | failed/uncertain/cancelled 不得把 Goal 变 completed 或启动下一 occurrence；保留任何已提交效果的原始 receipt，不能把 uncertain 投影伪装成 Goal 完成证据；uncertain 持续待 reconciliation。保存 Handoff/Goal 状态、receipt/digest、事件与退出码。 |

#18 可复用既有回归命令（本轮未运行）：

    npm test -- --run tests/goal-team.test.ts tests/goal-team.integration.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts

该命令覆盖的是既有测试，其中多数为 fixture；即使全通过也不能替代 #18 的真实 provider/runtime 证据和 T01–T03 隔离运行回执。当前 Goal Team/Handoff 已能分开 coordinator 与 recipient execution，但没有 RetailOps risk-reviewer 角色、独立审查决策、冻结业务草案摘要/digest 与执行时消费门禁；这属于未实现的新设计，须另行授权和验收。

## 公共文档修复状态

上一轮 npm run docs:check 曾退出码 1，失败为旧路线图失效链接。主控确认公共修复 PR 尚未合并，所以本轮按要求未复跑。待公共修复合并后再运行 docs:check 并记录结果；没有将未复测写成通过。
## PR #81 合并后最终复测（2026-11-26）

- 最新 develop/retailops：f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61；本分支普通 merge commit 40910d8c2293ec609278d15e4a5d2ed827261679。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm test -- --run tests/goal-team.test.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts：退出码 0，4 files/16 tests passed。运行类型为既有隔离 fixture/测试子进程；不等于真实 Cloud/Node Handoff 或 #18 验收。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check：退出码 0，219 个仓库 Markdown 文件通过。
- git diff --check 与 PR 分支差异检查：均退出码 0；工作树干净。
- 三层复核：总体计划 PASS（仅调查/fixture范围）；Issue/Plan PASS（未扩大风控功能）；N4节点 PASS（定向测试和文档检查通过）。
- #18 未执行；未创建业务风控 Agent；真实 Provider/Cloud/Node Runtime 仍未验证。Issue #11 保持 Open/REVIEW、未认领；PR #78 保持 Open，不标 DONE、不解锁 #18。
## PR #81 合并后最终复测（2026-11-26）

- 最新 develop/retailops：f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61；本分支普通 merge commit 40910d8c2293ec609278d15e4a5d2ed827261679。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm test -- --run tests/goal-team.test.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts：退出码 0，4 files/16 tests passed。运行类型为既有隔离 fixture/测试子进程；不等于真实 Cloud/Node Handoff 或 #18 验收。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check：退出码 0，219 个仓库 Markdown 文件通过。
- git diff --check 与 PR 分支差异检查：均退出码 0；工作树干净。
- 三层复核：总体计划 PASS（仅调查/fixture范围）；Issue/Plan PASS（未扩大风控功能）；N4节点 PASS（定向测试和文档检查通过）。
- #18 未执行；未创建业务风控 Agent；真实 Provider/Cloud/Node Runtime 仍未验证。Issue #11 保持 Open/REVIEW、未认领；PR #78 保持 Open，不标 DONE、不解锁 #18。
