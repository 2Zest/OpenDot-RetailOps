# RETAIL-00B-03：MCP 工具授权与审批源码契约调查

> 初始调查日期：2026-11-25
> Review 补充日期：2026-11-26
> 当前交付状态：REVIEW（PR #77 开放，等待独立 Review；未合并）
> 任务：Issue #10 / RETAIL-00B-03
> 固定源码基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`（`origin/develop/retailops`）
> 总体计划审批：已归档，审批记录见 `docs/retailops/acceptance/RETAILOPS-V0.2-APPROVAL.md`
> 调查模式：只读源码调查与本仓库定向 fixture/unit 测试；没有启动 MCP 服务、真实 Runtime、真实业务服务或写副作用。

## 1. 结论

基线已有两条不同的产品级 MCP 接入路径：

1. **Host / Pi Coding Agent**：Host 端 `CodingMcpService` 校验 owner、Host 执行权限和独占 lease；只有显式 Session consent 激活的 grant 才进入 catalog。Runner 把 tool call 交回 Host，Host 冻结 exact-call intent 和参数摘要，等待审批，然后由 Host dispatch。入口与适配分别见 [`CodingMcpService.authorize/consent/open/catalog/submit/status/cancel/decide`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L100-L125)、[`CodingMcpService.submit/status`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L364-L537) 与 [`loadExternalMcpTools`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/container/agent-runner/src/runtime/pi/external-mcp.ts#L34-L130)。
2. **Node Durable 原生工具路径**：`ProductRuntime` 打开已授权的 Session MCP，再把冻结的 catalog、连接和 live-grant 检查器传给 `createDurableMcpTools`。Durable 工具在 generation 前冻结授权，在执行时创建精确 intent，经同一持久化审批台账进行 dispatch；原生 replay 重新进入台账，不直接重放外部工具调用。见 [`ProductRuntime` MCP 接入](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/product-runtime.ts#L1720-L1749) 与 [`createDurableMcpTools`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-mcp-tools.ts#L60-L304)。

两条路径共享 Session consent、catalog/grant、exact-call intent、审批记录、撤销和不确定结果处理。**Product Approval 不是零售业务审批**；这里的 MCP approval 只能说明某个 owner 同意某一次具体工具调用。Product Approval 的 `operation` 在固定源码中仅有 `create_private_artifact`，有 TypeScript 类型、SQLite CHECK 和请求写入三个直接约束，不能据此批准零售操作（见 §4.4）。零售业务仍需独立的领域授权和业务审批。

## 2. 证据基线与边界

源码行号均针对固定基线 `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`。Issue 契约要求调查 consent/catalog/grant、参数绑定、exact-call、自动只读限制及取消，不写业务工具，不连接真实商超写接口；验收要求区分现有支持、新增需求、默认拒绝和独立业务审批必要性。

| 证据类型 | 本报告中的含义 | 本轮结果 |
|---|---|---|
| S：固定源码 | 固定 SHA、文件、函数及行号 | 两条接入路径、授权、状态和取消契约已静态核对 |
| T：定向测试 | 仓库既有测试及 fixture | 6 个测试文件、41 项通过；仅验证受测代码路径，不等于真实服务运行 |
| R：真实 Runtime/外部服务 | 实际连接 MCP server 或业务服务 | **未执行** |
| U：未知/未验证 | 源码或 fixture 无法证明的实际行为 | 真实服务器兼容性、部署配置、外部副作用语义、零售业务审批均未验收 |

没有读取生产凭据、连接真实 MCP server、启用 Durable Runtime 或执行 `RETAIL-00B-03V` / #17 验证。报告不把静态支持或 fixture 通过表述为运行验收通过。

## 3. 接入路径与授权矩阵

| 阶段 | Host / Pi Coding Agent | Node Durable 原生 MCP | 证据与边界 |
|---|---|---|---|
| Runtime 与 owner | `CodingMcpService.authorize` 限定 `pi-coding-agent`、非 blocked、owner 创建的 conversation group，并要求 `canExecuteOnHost`。 | `mcp-session-store.scope` 仅接受 `pi-durable` 或 `pi-coding-agent`，拒绝 blocked/cloud placement；Durable 还要求 Host workspace。 | [`coding-mcp-service.ts:100-116`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L100-L116)、[`mcp-session-store.ts:90-153`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L90-L153)。源码支持不代表本轮实际运行过这些 Runtime。 |
| Consent 候选 | `settings` 暴露服务器及工具候选；owner 显式提交 consent。 | 同一 `sessionMcpOptions` / `requestSessionMcpConsent`。 | `candidates` 只接受 profile 启用且有工具的非 SSE MCP；system MCP 受 admin 策略限制。选项不输出 env/header secret 或 command 参数。见 [`mcp-session-store.ts:155-208`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L155-L208)。 |
| Consent 绑定 | 打开/重新打开经 consent 的服务；复用 Session consent store。 | `ProductRuntime` 调用 `openSessionMcp`，将结果交给 Durable bridge。 | Consent 输入严格绑定 server/config digest、明确工具子集、TTL 和 `confirmed_startup_and_restart=true`；binding 再固定 owner/session/workspace/Dot/scope/server 来源/配置/工具/取消 generation/member/device grant。见 [`McpSessionConsentRequestSchema` 与 `requestSessionMcpConsent`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L48-L62)、[`requestSessionMcpConsent`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L221-L321)。 |
| Catalog | Host catalog 返回 live grants 对应的工具 schema 及 grant/schema/catalog digest；Runner 无法自建 grant 或直接选 server location。 | `beforeRequest` 检查 generation grants 与冻结 catalog 一致，并把 grants 写入 generation memo。 | [`CodingMcpService.catalog`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L268-L290)、[`beforeRequest`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-mcp-tools.ts#L152-L179)。 |
| Tool invocation | Runner 以工具名、grant/schema/catalog digest、tool call id 和参数向 Host `submit`，之后轮询 `status`。 | Native `execute` 先核对 generation memo 内 grant，再写持久化 `MCP_CALL_MEMO` intent。 | [`external-mcp.ts:55-80`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/container/agent-runner/src/runtime/pi/external-mcp.ts#L55-L80)、[`durable-mcp-tools.ts:181-245`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-mcp-tools.ts#L181-L245)。 |
| Approval 与 dispatch | `submit` 固定 intent 后调用 `requestMcpApproval`；`status` 仅在 state 为 approved 时启动 `executeMcpApproval`。 | 经过相同审批账本；等待 pending 决策后执行。 | [`coding-mcp-service.ts:364-468`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L364-L468)、[`coding-mcp-service.ts:483-537`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L483-L537)、[`durable-mcp-tools.ts:241-294`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/durable-mcp-tools.ts#L241-L294)。 |
| API 权限入口 | `/mcp`、`/consents`、`/approvals` 路由要求认证、Session/workspace scope，并路由至 Coding 或 Product Runtime 服务。 | 共用路由边界，业务审批仍不在此层。 | [`src/routes/agents.ts:974-1085`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/routes/agents.ts#L974-L1085)。 |

## 4. Digest、exact-call 与撤销契约

### 4.1 Catalog 和 grant 绑定

- `mcpCanonicalJson` 对 JSON 对象键排序，拒绝非 JSON、过深或超出大小限制的数据；`mcpDigest` 对规范 JSON 计算 SHA-256：[`src/mcp-contract.ts:29-61`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L29-L61)。
- `buildMcpCatalog` 检查重复工具、选中项必须在 server catalog 中、拒绝外部工具占用保留的 `mcp__miniclaw__` 名称；identity 绑定 owner、server、工具名、catalog/config/schema digest 和 location：[`src/mcp-contract.ts:111-162`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L111-L162)。
- `selectGrantedMcpTools` 仅返回 catalog 与显式 grant 的交集；未知的 `mcp__` grant 报错，内部 Miniclaw wildcard 不授予外部工具：[`src/mcp-contract.ts:183-197`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L183-L197)。
- `McpCallIntentSchema` 将 owner、Dot、workspace、Session、server、工具名、catalog/schema/config/arguments digest、location、source、grant id/revision、cancel generation、expiry 固定在严格 schema；Durable generation grant 是其严格子集：[`src/mcp-contract.ts:241-297`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L241-L297)。

### 4.2 单次调用与审批

`requestMcpApproval` 先解析严格 intent、规范化并冻结参数，核验参数 digest 与 intent 相同，再校验来源和当前权限；同一 source key 的重试必须有相同 call id 和 `parameters_digest`，调用期限不得过期或超过 24 小时。参数密文入库。见 [`requestMcpApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L346-L421)。

`decideMcpApproval` 只能接受 approve/deny，检查参数摘要和 request id 幂等绑定；approve 前再次核验 source 与当前授权。执行时 `executeMcpApproval` 仅接受 approved，dispatch 前检查 Runtime/control/authority 并以 compare-and-set 将状态改为 dispatching；结果加密并存摘要。dispatch 后出错转 uncertain，保留可能收到的回执，不自动重复调用。见 [`decideMcpApproval` / `recoverMcpDispatches`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L424-L541)、[`executeMcpApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L668-L801)。数据库状态转换限制为 `pending → approved|denied|cancelled`、`approved → dispatching|denied|cancelled`、`dispatching → completed|uncertain`；intent 和已收结果均不可被更新覆盖：[`createMcpApprovalSchema`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L40-L113)。

### 4.3 Consent 撤销、取消与恢复

- `revokeSessionMcpConsent` 先按 grant 取消相关 call，再把 starting/active consent 改为 revoked；能力收缩也按 user/system 与 server scope 清理。见 [`mcp-session-store.ts:323-377`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L323-L377)。
- `validate` 每次复核 consent 存在且 starting/active、未过期、功能已启用、scope/config/member/device grant 和 cancel generation 均未变化。见 [`mcp-session-store.ts:379-425`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L379-L425)。
- Coding Session 重开时旧 active consent 若没有本次新 consent 会变 uncertain；starting 但未获新 consent 也变 uncertain。device restart 要求新 consent；连接后再次授权、校验 catalog，失败将 consent 标为 uncertain。只有 active/live consent 产生 grants，`recheckGrant` 要求 grant digest 与仍有效的 grant 精确相等。见 [`openSessionMcp`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L429-L625)。
- 会话或任务取消会递增 cancel generation；pending/approved 调用取消，dispatching 调用转为 uncertain。撤销 grant 采用相同边界。见 [`cancelMcpApprovals` / task / grant](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L543-L626)。
- Coding lease 接管会 retire 旧调用：未 dispatch 的取消，已 dispatch 的 uncertain。Runner 遇到取消、超时或 turn 改变会 best-effort 调 Host cancel，但不能撤销已发生的外部效果：[`coding-mcp-service.ts:201-266`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/coding-mcp-service.ts#L201-L266)、[`external-mcp.ts:97-130`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/container/agent-runner/src/runtime/pi/external-mcp.ts#L97-L130)。


### 4.4 Product Approval 的操作类型限制

在固定源码 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`：

- `src/personal-agent/approval-store.ts` 的 `ProductApproval` 类型将 `operation` 固定为字面值 `create_private_artifact`（第 37–60 行，字段在第 42 行）。
- `createApprovalSchema` 建立 `product_approvals` 表时写入 SQL 约束 `CHECK(operation='create_private_artifact')`，并用 immutable trigger 固定 intent（第 67–89 行，尤其第 69–88 行）。
- `requestArtifactApproval` 生成参数 digest 时写入 `operation: 'create_private_artifact'`，并在 INSERT 中同样硬编码该 operation（第 194–233、257–286 行，关键常量在第 225、259–260 行）。

直接源码：[ProductApproval 类型和 createApprovalSchema](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L37-L89)、[`requestArtifactApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L194-L286)。因此现有 Product Approval 只能审批私有产物创建这一操作类型，不能靠人工点击将其改造成 `submit_decision_draft`、调价、补货提交或其他零售业务审批。
## 5. READ_AUTO / APPROVAL_REQUIRED / BLOCKED 候选矩阵

| 候选 | 基线支持/建议 | 限定或拒绝条件 | 证据 |
|---|---|---|---|
| **READ_AUTO** | 现有自动读仅是 Computer 专用例外：`list_windows`、`observe_window`、`read_page`；仅 server id 以 `opendot_computer_` 开头且未设置 `OPENDOT_COMPUTER_REQUIRE_READ_APPROVAL=true` 时自动批准。 | 不能泛化到所有名字像 read/get/list 的 MCP 工具；工具名和 server 前缀本身不是语义证明。零售业务是否可自动读，需按数据分类、来源许可、字段最小化和可审计证据另行定义；目前**没有通用 MCP READ_AUTO**。 | [`computer-approval-policy.ts:6-18,76-93`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/computer-approval-policy.ts#L6-L18)、[`computer-approval-flow.ts:19-55`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/computer-approval-flow.ts#L19-L55)。 |
| **APPROVAL_REQUIRED** | 默认用于普通 MCP exact-call；需要有效 Session consent/grant，且每个工具名、参数摘要、来源和过期时间被固定。人批准的对象是这一条确切 intent。Computer 的 mutate 工具只有此前建立且仍有效的匹配 allowance 时才可能跳过逐次人工点击。 | 未识别工具类别、写/变更/提交业务操作、权限或数据访问扩大，建议一律逐次审批；Computer allowance 不是零售业务授权。业务草案/经营策略批准仍须有独立业务审批。 | [`requestMcpApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L346-L421)、[`settleComputerCallApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/computer-approval-flow.ts#L23-L55)。 |
| **BLOCKED** | 缺 consent/grant、scope 或 config/catalog/schema/arguments digest 不匹配、grant 失效或过期、owner/runtime/device/member/cancel generation 不匹配、未列入 catalog、保留 namespace 冲突、未批准的 cloud/非 Host Durable 位置、被撤销、超时或状态 uncertain 时拒绝或停止。 | dispatch 已开始但完成回执无法确认时，只能呈现 uncertain/需人工核实；不得盲目重试，因为远端副作用可能已发生。未授权外部服务不得尝试连接。 | [`scope/validate/openSessionMcp`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-session-store.ts#L90-L153)、[`catalog/grant checks`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L111-L197)、[`executeMcpApproval`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L668-L801)。 |


## 6. RetailOps 候选工具接入矩阵

候选名称来自固定版本场景文档 `RETAILOPS-SCENARIO-V0.2.md` 第 64 行；总体计划说明零售工具接入还受 00B-03V、领域数据/仿真与算法等 DAG 门槛约束。以固定源码 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a` 对 `src/`、`container/` 和 `tests/` 做精确名称搜索，八个名字均未发现工具注册或实现；匹配仅出现在场景候选列表。现有 generic MCP plumbing 不等于 RetailOps 工具已存在、已授权或可调用。

| 候选工具 | 用途 | 副作用 / 数据影响 | 授权分类（候选） | 现有支持 | 新需求与进入实现前验证条件 |
|---|---|---|---|---|---|
| `query_sales` | 查询门店/SKU/时间窗销售历史 | 只读；会暴露经营数据，无业务状态写入 | `READ_AUTO` 候选；须先有显式、范围受限的只读 Grant | 当前无该工具注册/实现；只有通用 MCP/catalog 能力 | 校验门店与 SKU scope、日期上限、金额/件数单位与归一化、数据来源/快照/时效及脱敏；用合成样本和获批数据覆盖越权、空数据与过期数据。 |
| `query_inventory_lots` | 查询批次、库存量、有效期及可售状态 | 只读；读取高时效运营数据，无库存写入 | `READ_AUTO` 候选；须显式 Grant，并受食品安全/质量硬规则约束 | 当前无该工具注册/实现 | 校验门店、SKU、批次和单位边界；保证库存/有效期快照一致及新鲜；质量/过期不可售标记不能被模型或审批覆盖；测试 stale snapshot、批次不存在和越权。 |
| `query_stockout_history` | 查询历史缺货区间和观测记录 | 只读；可能揭示销售缺失或运营异常，无写入 | `READ_AUTO` 候选；显式 Grant 与最小字段范围 | 当前无该工具注册/实现 | 固定缺货定义、时区、观测粒度和来源；区别销售为零与缺货导致的删失；测试缺失历史、时间边界和不可推断真实需求的提示。 |
| `query_retail_policy` | 查询有效经营/调价/质量政策 | 只读；政策读取，无写入 | `READ_AUTO` 候选；只读 Grant 仅可读取明确版本 | 当前无该工具注册/实现 | 只返回已批准且在有效期内的版本、来源和适用范围；策略缺失/过期/冲突默认拒绝推荐；验证版本变更使既有草案失效。 |
| `forecast_demand` | 按授权销售/缺货样本生成需求预测 | 计算输出；不修改业务数据，但结果可能影响经营决策 | `READ_AUTO` 候选，仅对固定数据快照与已登记算法开放；预测作为建议，不是执行授权 | 当前无该工具注册/实现；计划中的需求恢复/预测能力另有依赖 | 遵循时间顺序切分、禁止未来信息泄漏；固定算法/参数/数据快照；报告 MAE/WAPE、误差区间和覆盖限制；覆盖样本不足、需求删失和仿真/真实来源隔离。 |
| `compare_markdown_options` | 比较临期折扣方案、收入/损耗情景 | 确定性测算；不写价格或库存 | `READ_AUTO` 候选仅限纯计算接口；任何价格写入另属 BLOCKED/独立批准路径 | 当前无该工具注册/实现；总体计划将测算与写执行分开 | 固定批次、库存/成本、剩余窗口、政策版本和需求假设；输出区间、公式及单位；测试过期商品拒绝、库存变化和政策版本变更；不得把仿真假设表述为因果结论。 |
| `calculate_replenishment` | 计算建议补货量和约束 | 纯计算候选；不得创建采购单或改变库存 | `READ_AUTO` 候选仅限已登记的只读计算；采购/补货执行必须单独审批 | 当前无该工具注册/实现；V1 算法任务 RETAIL-13A 尚有硬依赖 | 等待 13A 前置算法/领域契约满足；验证交期、最小订货量、包装单位、库存共享/预占、上限和幂等计算；确认输入版本过期时拒绝旧结果；禁止隐式供应商提交。 |
| `submit_decision_draft` | 将已审查建议保存为可追溯业务草案 | 有持久化写入，但不应产生真实调价/采购副作用 | `APPROVAL_REQUIRED`；须有业务角色授权和独立草案审批。未实现/未注册时为 `BLOCKED` | 当前无 RetailOps 草案工具；Product Approval 只支持 `create_private_artifact`，不能代用 | 依赖领域草案状态/证据契约（RETAIL-07）；绑定草案、参数 digest、数据快照、政策版本、权限身份和幂等键；审批拒绝/重复、过期输入、撤销及执行结果不确定均需测试；此操作本身不授权后续业务执行。 |

以上是方案级分类，不代表当前可执行状态。`READ_AUTO` 是新 RetailOps 只读策略候选；**不扩展、不复用现有 Computer 自动审批例外**。现存自动读仅限 `opendot_computer_` 与指定只读 Computer 工具/配置门槛（见 §5）；RetailOps 工具只有在实际注册、显式最小 Grant、领域权限和数据来源策略确定后，才可能评审是否按新策略免逐次点击。场景和总体计划列出的八项名称不是工具注册，也不是当前准入名单。

**默认拒绝与审批不可绕过：** 未登记/未知工具默认 `BLOCKED`。人工批准只能作用于已经进入 catalog、拥有有效 Session consent/Grant、通过来源与 scope 校验、参数和 digest 完全绑定、且安全策略允许的那一次调用。审批不能补造工具注册、授予缺失的 Grant、改变 server/catalog/schema 或绕过 owner/runtime、过期、取消 generation、数据范围及安全策略。`buildMcpCatalog` 要求所选工具存在且拒绝保留命名空间；`selectGrantedMcpTools` 仅取 catalog 与显式 Grant 的交集，未知 `mcp__` Grant 抛错（固定 SHA 下 [`buildMcpCatalog`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L111-L162)、[`selectGrantedMcpTools`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/mcp-contract.ts#L183-L197)）。`requestMcpApproval`、`decideMcpApproval`、`executeMcpApproval` 又在建请求、批准和 dispatch 前后复核来源与权限（[`mcp-approval-store.ts`](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L346-L496)、[dispatch checks](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/mcp-approval-store.ts#L668-L801)）。

DAG 门槛参考：总体计划把 `RETAIL-04` 只读工具接入置于 `00B-03V`、数据/仿真及算法验收之后（`RETAILOPS-MASTER-PLAN-V0.2.md:57-60`）；`calculate_replenishment` 对应 V1 任务 13A（同文件第 69 行）；业务草案状态由 RETAIL-07 承担（第 60 行）。本矩阵不解锁这些任务或 #17。
## 7. 零售业务审批候选设计（仅建议，不是实现）

MCP startup consent 只授权某 Session 连接指定 server 的工具子集；exact-call approval 只批准一条冻结的技术调用。两者都不能证明零售操作符合经营政策，也不能替代独立业务审批。

建议后续业务接口在执行前另行冻结并审批：业务主体/门店与操作者、业务对象和影响范围、数据快照及来源、经营政策版本、拟执行变更、幂等键、审批人/角色、审批时间、撤销/到期状态。审批必须绑定不可变的规范化业务草案及 digest；执行返回可核对回执。任何草案、快照、政策、目标对象或参数变化均应使既有批准失效并要求重新审批。未获批准、策略不适用、证据缺失、调用 digest 不一致或结果不确定时默认拒绝/暂停。具体领域角色、双人审批阈值、回滚能力和审计保留期属于待业务决策项，本调查不替用户定案。

这项建议用于支撑后续设计决策，不表示其依赖已满足，也不解锁 #17 或任何其他下游任务。

## 8. 定向测试、回归与结果

测试使用 Node `v24.22.3`、npm `11.19.1`，基于独立 worktree 原锁文件安装依赖。

| 项目 | 实际命令/结果 | 退出码 | 证据边界 |
|---|---|---:|---|
| 锁定依赖安装 | `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm ci`；803 packages added；未修改 package/lock 文件。npm 提示 48 vulnerabilities（2 low、20 moderate、23 high、3 critical）；没有执行 audit fix 或脚本审批。 | 0 | 仅环境准备。 |
| T01/T02 定向测试 | `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin ./node_modules/.bin/vitest run tests/mcp-contract.test.ts tests/mcp-approval.test.ts tests/mcp-session-consent.test.ts tests/mcp-approval-process-recovery.test.ts tests/durable-mcp-native.test.ts tests/coding-mcp-lease.test.ts`；6 files、41 tests passed。 | 0 | Catalog/digest、consent、审批、撤销、恢复与 lease 的既有 unit/fixture；不是 MCP server、Durable Runtime 或真实业务操作。stderr 曾出现 `serveStatic: root path './web/dist' is not found`，测试仍全部通过。 |
| 文档基线检查 | `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check`；报告既有失效链接：`docs/retailops/RETAILOPS-ROADMAP.md:1` 引用缺失的 `planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`。 | 1 | 属于已知公共基线失败；本任务未修改路线图或总体计划。 |
| 白空格检查 | `git diff --check` | Review 补充后退出码 0。 | 仅检查本 PR 文档 diff。 |

历史执行窗口记录（当时 PR #81 尚未合并）：docs:check 退出 1，因 ROADMAP 失效链接；现由 PR #81 修复。该次失败输出保留，最新复测见文末。

### 定向测试文件

- `tests/mcp-contract.test.ts`：canonical digest、catalog、重复/非法 grant/schema。
- `tests/mcp-approval.test.ts`：审批参数摘要、拒绝/到期/撤销/取消、dispatch 前并发和授权复核。
- `tests/mcp-session-consent.test.ts`：Consent scope、取消 generation、重启中断转 uncertain、撤销隔离。
- `tests/mcp-approval-process-recovery.test.ts`：dispatch 前后崩溃 fixture；不自动重放已 dispatch 的副作用。
- `tests/durable-mcp-native.test.ts`：隔离 Durable 原生工具 fixture 的批准/拒绝/撤销/无 grant/parent stop。
- `tests/coding-mcp-lease.test.ts`：Coding lease fixture。

## 9. 未知项、风险与下游边界

- 真实 MCP server 的协议兼容、网络断连、凭据轮换、工具声明与真实副作用未知；本轮未连接服务。
- 真实 Durable Runtime 运行、持久化 checkpoint 重启、Host lease 竞争和真实恢复未验证。
- 业务级 READ_AUTO 规则、零售经营草案/政策审批模型、审批角色与结果不确定后的人工对账流程尚待业务定义。
- `npm run docs:check` 存在公共基线失效链接，本任务没有修正；应另建授权范围内的独立文档修复任务。
- 本轮 Review 补充只改调查报告、节点回执和 PR 说明；没有源代码、测试、依赖、数据库、路由、配置或安全策略改动。
- 当前整体状态为 **REVIEW**：PR #77 保持 open，Issue #10 保持 Open / REVIEW，等待独立 Review；未合并不标 DONE。#17 与其他下游任务未解锁。
## PR #81 合并后复验（2026-11-26）

- 最新基线 develop/retailops：f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61；分支普通 merge commit 4d52493a8ba81aefd9d2f49725d6d808252d8fd6。
- 按 N4 原计划重新执行：PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin ./node_modules/.bin/vitest run tests/mcp-contract.test.ts tests/mcp-approval.test.ts tests/mcp-session-consent.test.ts tests/mcp-approval-process-recovery.test.ts tests/durable-mcp-native.test.ts tests/coding-mcp-lease.test.ts；退出码 0，6 files/41 tests passed。测试是既有 unit/fixture；stderr 中 web/dist 静态目录缺失提示没有导致用例失败，不代表真实 MCP 或 Runtime 验收。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check：退出码 0，219 个仓库 Markdown 文件通过。
- git diff --check 与分支差异检查均退出码 0；工作树干净。
- 三层复核：总体计划 PASS（调查/fixture边界未扩大）；Issue/Plan PASS（T01/T02契约未变）；N4节点 PASS（定向fixture与公共文档检查通过）。
- 当前状态：PR #77 Open/Review、Issue #10 Open/REVIEW、未认领；未执行 #17，不标 DONE、不解锁下游。
