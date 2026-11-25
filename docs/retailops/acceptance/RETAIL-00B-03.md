# RETAIL-00B-03 节点验收回执

Issue / Plan 版本 / 节点 ID：Issue #10 `RETAIL-00B-03`；`docs/retailops/initial-plan-v0.2/plans/RETAIL-00B-03-PLAN.md`（blob `531875ccac94aadab417774fb29936ed51152ec3`）；N0–N5
总体计划 / Scenario / DAG / Issue / Receipt / Approval 版本：总体计划 blob `f4baf060fc335a2844b8bf783c2f044cb3b89170`；Scenario blob `88ec6f760ad92fbd071dc1cea86685bf9dc15b79`；DAG blob `b998e8a186a8ae0e6c28468a76377ee3cb66daa2`；Issue 契约 blob `a14fcc8cfa62ac72590924bba119503421ad49a8`；模板 blob `e276079adc8678ee436d43e90f3f765156a5bb3`；审批记录 blob `7b841510a3db670a6396d1c731a863c37d1345a2`。
固定源码基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`
Review 补充日期 / 当前状态：2026-11-26 / REVIEW（PR #77 开放；Issue #10 Open / REVIEW）
实际 Git HEAD / worktree / 执行角色：`docs/retail-00b-03`；`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-03`；MCP Security Agent。最终文档提交 SHA：以本回执版本所在分支的 `git rev-parse HEAD` 为准；主控创建 PR 后以 PR HEAD 为准。
依赖 Issue 状态、合并 SHA、证据：无新增硬上游；总体计划 APPROVED 已归档，审批记录如上。#10 直接下游尚未解锁，未执行。
允许修改路径与实际 diff：仅 `docs/retailops/investigation/RETAIL-00B-03.md`、`docs/retailops/acceptance/RETAIL-00B-03.md`；只新增调查报告和回执，无业务源码、测试、配置、路由、数据库或安全策略 diff。
数据来源 / 运行模式：固定基线源码静态调查；定向 unit/fixture 测试。未连接真实 MCP 服务，未启用 Product/Durable Runtime，未执行真实外部或零售业务副作用。

## N0：环境、依赖、源码基线与任务范围预检

**预期输出/标准：** 确认授权与审批、固定输入版本、当前集成基线、依赖与环境、可修改路径及计划测试。

**实际执行动作与证据：** 阅读 Master Plan、Scenario、DAG、Issue #10 完整契约、对应 Plan、回执模板、已归档总体计划审批、00B-01 调查与 R1 Review；确认总体计划为 APPROVED、#10 无硬上游、当前输入基线 `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`。确认工作分支 `docs/retail-00b-03` 在初始 HEAD 上创建，远程原分支不存在后以普通 `git push --set-upstream` 建立并核对远端 HEAD；未分配 GitHub assignee。测试时 Node `v24.22.3`、npm `11.19.1`；高负载测试启动前 WSL MemAvailable 约 13.6 GiB（高于 4 GiB）。预检输入见本回执头部固定 blob ids。

允许修改路径固定为：

- `docs/retailops/investigation/RETAIL-00B-03.md`
- `docs/retailops/acceptance/RETAIL-00B-03.md`

定向测试命令在 N4 固定。N0 不更改计划目标、依赖或验收标准。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 已批准后调查 MCP 授权边界，不实施业务功能。 | APPROVED 记录已归档；本轮仅做源码调查与 fixture 测试。 | PASS |
| Issue / Plan | 无新增硬上游；冻结输入和文档文件范围。 | Plan 和 DAG 核对一致；两份文档是唯一写入路径。 | PASS |
| 节点验收 | 基线、权限、资源、分支、测试范围可复核。 | 固定 HEAD、独立分支及远端 tracking 已核对；Node/内存和计划测试范围已记录。 | PASS |

实际命令/退出码：`git rev-parse HEAD` → `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；分支/远端检查及文档读取 → 退出 0。无 N0 源码改动。
未验证项：真实 MCP server 可用性与真实运行兼容性（本任务明确不执行）。
决定：N0 PASS，进入 N1。

## N1：追踪 Host 与 Durable 两套工具路径

**预期输出/标准：** 分别列出 Host 与 Durable 入口、调用路径及权限边界。

**实际执行动作与证据：** 以固定 SHA 查看 `git show e8db2b6:<path>` 并记录源码函数和行号。Host 路径从 `CodingMcpService.authorize/consent/open/catalog/submit/status/cancel/decide` 出发，Runner 的 `loadExternalMcpTools` 只通过 Host catalog/submit/status/cancel；路由由 `src/routes/agents.ts` 中 MCP scope 路由。Durable 路径从 `ProductRuntime` 的 `openSessionMcp` 到 `createDurableMcpTools`，使用 generation memo 内 grant 和同一持久化 approval store。完整矩阵和源码链接见 [`RETAIL-00B-03.md`](../investigation/RETAIL-00B-03.md) §3。

关键证据：

- `src/personal-agent/coding-mcp-service.ts`：`CodingMcpService.authorize` 100–116；`consent` 153–183；`open/catalog` 201–290；`submit` 364–468；`status/cancel/decide` 483–579。
- `src/routes/agents.ts`：`mcpScope` 与 GET/POST/DELETE MCP routes 974–1085。
- `container/agent-runner/src/runtime/pi/external-mcp.ts`：`loadExternalMcpTools` 34–130。
- `src/personal-agent/product-runtime.ts`：Durable MCP 接入 1723–1749。
- `src/personal-agent/durable-mcp-tools.ts`：`createDurableMcpTools`、`beforeRequest`、原生 `execute` 及 grant 选择 60–304。

实际命令/结果：固定基线 `git show` / `git grep` 静态核对，退出 0；未启动 Runtime 或服务。无文件改动。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 适配层不得越过独立授权和业务边界。 | 两路径均由 Host consent/grant 和具体调用审批控制；报告区分技术审批和零售业务审批。 | PASS |
| Issue / Plan | 分列 Host 与 Durable 路径及入口。 | 报告列出入口、调用链和分支权限，提供固定 SHA/路径/函数/行号。 | PASS |
| 节点验收 | 两套路径有源码证据，不以静态调查冒充运行结果。 | 源码链路已定位；真实 Runtime 标为未运行。 | PASS |

未验证项：真实 MCP server、Pi Runtime 和 Durable Runtime 端到端行为。
决定：N1 PASS，进入 N2。

## N2：核对 digest、撤销、dispatch/uncertain 与 cancel generation

**预期输出/标准：** 给出状态与摘要绑定证据，说明恢复和取消行为。

**实际执行动作与证据：** 静态核对 canonical JSON/SHA-256、catalog/schema/config digest、严格 `McpCallIntentSchema`、consent binding、exact arguments digest、approval state transitions、撤销与恢复逻辑。状态说明和图景见调查报告 §4。

关键源码位置：`src/mcp-contract.ts` 中 `mcpCanonicalJson/mcpDigest` 29–61、`buildMcpCatalog` 111–162、`selectGrantedMcpTools` 183–197、`McpCallIntentSchema` 241–297；`src/personal-agent/mcp-session-store.ts` 中 consent 创建 221–321、revoke/cleanup 323–377、`validate` 379–425、`openSessionMcp` 429–625；`src/personal-agent/mcp-approval-store.ts` 中 `requestMcpApproval` 346–421、`decideMcpApproval/recoverMcpDispatches` 424–541、取消函数 543–666、`executeMcpApproval` 668–801。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 授权缩减有效；结果不确定不得被伪装成成功。 | Consent/权限变化会取消未 dispatch 调用；dispatching 可能有远端效果，变为 uncertain 且无自动重试。 | PASS |
| Issue / Plan | 核对 digest、撤销、dispatch/uncertain 和取消 generation。 | Digest 覆盖配置、catalog、schema、工具参数与来源；grant/consent live recheck、state trigger、恢复逻辑均已定位。 | PASS |
| 节点验收 | 形成可审查状态机制，不扩大到实现。 | 报告载明精确函数、路径、行号与不确定状态处理；只读源码。 | PASS |

实际命令/结果：固定 SHA `git show` / 静态核对，退出 0。无文件改动。
未验证项：对真实外部副作用的原子性、补偿或人工对账流程。
决定：N2 PASS，进入 N3。

## N3：READ_AUTO / APPROVAL_REQUIRED / BLOCKED 候选

**预期输出/标准：** 划分自动读、逐次审批和拒绝条件，不扩大既有 Computer 例外。

**实际执行动作与证据：** 对照 `computer-approval-policy.ts` 的 `READ_ONLY_COMPUTER_TOOLS` / `shouldAutoApproveComputerCall`，`computer-approval-flow.ts` 的 `settleComputerCallApproval`，以及 MCP consent/call approval 检查；新增场景列出的 8 个 RetailOps 候选工具矩阵，并以 `git grep` 在固定源码的 `src/`、`container/`、`tests/` 搜索名称，未找到工具注册/实现，名称仅见场景候选表。报告 §5 解释现有 Computer 专用 READ_AUTO，§6 列候选工具，§7 单列业务审批建议，§4.4 新增 Product Approval 操作类型约束源码依据。

关键源码位置（均以固定 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a` 为准）：`src/personal-agent/computer-approval-policy.ts` 6–18、44–50、76–93；`src/personal-agent/computer-approval-flow.ts` 19–55；`src/personal-agent/mcp-approval-store.ts` 346–421、424–496、668–801；`src/mcp-contract.ts` 111–197；`src/personal-agent/approval-store.ts` 的 `ProductApproval.operation` literal 42、`createApprovalSchema` SQLite CHECK 69–88、`requestArtifactApproval` fixed operation/digest/insert 194–286。RetailOps 候选名单的业务来源为 `docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md:64`。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | RetailOps 权限最小化，领域审批独立于底层 tool call。 | 调查明确业务草案与经营策略需另行批准；Product Approval 源码只允许 `create_private_artifact`，未将它泛化为业务批准。 | PASS |
| Issue / Plan | 形成候选分类且不扩展 Computer 自动读。 | 现存 READ_AUTO 仍限于指定 Computer server/工具及开关；RetailOps 8 项均仅为方案候选且在当前源码未注册/实现，未知项默认 BLOCKED；批准不能补造注册/Grant或绕过安全策略。 | PASS |
| 节点验收 | 未知与写操作默认审批或阻断。 | 新增矩阵逐项列出工具用途、副作用、授权候选、当前支持、缺失需求与验证条件；未扩展 Computer 自动审批例外；未知/未登记工具默认 BLOCKED，人工批准不能绕过注册、Grant、scope 或安全策略。 | PASS |

实际命令/结果：固定 SHA `git show` 与精确工具名 `git grep` 静态核对；源码读取命令退出 0，工具名在 `src/`、`container/`、`tests/` 无实现匹配，仅在场景候选表匹配。无业务源码改动；调查报告和本回执记录本节点结果。
未验证项：零售数据分级、角色策略和双人审批阈值，需要业务定义。
决定：N3 PASS，进入 N4。

## N4：定向测试与文档回归

**预期输出/标准：** 执行 Issue T01/T02 定向测试及文档/工程检查，保留命令、结果和失败归类。

**实际执行动作与证据：** 高负载窗口开始前 WSL MemAvailable 约 13.6 GiB。使用 Node `v24.22.3`、npm `11.19.1`。

1. `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm ci` → 退出 0，803 packages added；lockfile 未改。npm 报告 48 vulnerabilities（2 low、20 moderate、23 high、3 critical）；未执行 audit fix 或脚本审批。
2. `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin ./node_modules/.bin/vitest run tests/mcp-contract.test.ts tests/mcp-approval.test.ts tests/mcp-session-consent.test.ts tests/mcp-approval-process-recovery.test.ts tests/durable-mcp-native.test.ts tests/coding-mcp-lease.test.ts` → 退出 0，6 files / 41 tests passed。`mcp-approval.test.ts` 有 `serveStatic: root path './web/dist' is not found` stderr，但测试均通过。测试使用 unit/fixture，不连接服务，不运行 #17。
3. `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check` → 退出 1，报告既有基线链接：`docs/retailops/RETAILOPS-ROADMAP.md:1` 引用缺失路径 `planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`。本任务不修复该公共文档问题。
4. `git diff --check` → 退出 0，文档 diff 无空白错误。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 只读调查边界内使用 fixture，不能声称真实 MCP 运行。 | 未连接外部服务；定向测试 41 项通过，并在报告标为 fixture/unit。 | PASS |
| Issue / Plan | 完成 T01/T02；基线检查失败需分类并如实披露。 | T01/T02 相关 6 文件全通过；docs:check 的已知缺失链接被记录，没有更改断言或扩大修复。 | PASS |
| 节点验收 | 记录完整命令、退出码、失败和运行边界。 | 安装/测试/docs:check 命令及退出码已记录；docs:check 失败不被记为通过。 | PASS |

测试证据详见调查报告 §8。Review 补充仅改文档，未重跑定向测试；公共修复尚未合并，因此不重跑 docs:check（上次 exit 1，仍未通过）。未运行全量测试或类型检查，也未执行真实运行。
决定：N4 PASS（保留 docs:check 基线失败记录），进入 N5。

## N5：交付与 Review

**预期输出/标准：** 调查报告、逐节点回执、语义一致性、测试结果、文件范围、未验证项齐全；独立 PR 关联 Issue #10，目标 `develop/retailops`。PR 未合并时不得 DONE。

**实际交付：**

- [`docs/retailops/investigation/RETAIL-00B-03.md`](../investigation/RETAIL-00B-03.md)：Host/Durable 工具路径、授权模型、digest/revoke/dispatch/uncertain、现有授权分类及八项 RetailOps 候选工具矩阵、Product Approval 操作类型直接源码依据、业务审批建议、测试与未知项。
- `docs/retailops/acceptance/RETAIL-00B-03.md`：N0–N5 节点回执。
- 实际修改路径仅两份上述文档；无源代码/测试/配置变更。
- 回滚方式：独立 revert 文档提交，不涉及运行数据或数据库。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 调查输出支持后续任务，不代表功能实施或解锁。 | 文档标明运行证据边界和 #17 未执行/未解锁。 | PASS |
| Issue / Plan | 两项文档交付物完整，独立 PR 指向 develop/retailops 并关联 #10。 | PR #77 [RETAIL-00B-03：MCP 工具授权与审批源码调查](https://github.com/2Zest/OpenDot-RetailOps/pull/77) 已创建；目标 `develop/retailops`，关联 Issue #10，状态 OPEN、未合并。核验时 PR review 列表为空；等待独立 Review。Issue #10 为 Open / REVIEW。 | PASS |
| 节点验收 | diff 范围、质量检查和实际 HEAD 可复核；PR 保持开放未合并。 | PR #77 已核验 OPEN、closed_at 为空、未合并；本轮补充推送后将核验最终 HEAD 与远端同步。`git diff --check` 退出码 0。 | PASS |

实际 PR：[PR #77](https://github.com/2Zest/OpenDot-RetailOps/pull/77)，标题与正文中文，目标 `develop/retailops`，关联 Issue #10。PR 当前 OPEN、未合并；核验时 review submissions 与 inline review threads 均为空，独立 Review 和合并仍待办。PR 正文同步更新为 REVIEW，并说明新矩阵/源码边界、docs:check 基线未通过且本轮未重跑。不得关闭 Issue 或标 DONE。
尚未验证项：独立 Review、PR 合并与任何真实 Runtime；均不属于本轮已完成工作。
当前决定：N5 三层检查均 PASS；PR 已创建并保持开放。等待独立 Review 与人工合并；未 Review/未合并不代表 Issue 完成，Issue #10 继续保持 Open / REVIEW。

## 最终范围与状态

- 源码固定基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`。
- 任务工作树不包含业务代码实现、真实 MCP 调用、N2/N3 Runtime 执行或 #17 验证。
- `docs:check` 退出码 1 的公共旧链接问题未修复。
- 当前统一状态为 REVIEW；PR #77 保持 OPEN、未合并，独立 Review 待办。Issue #10 保持 Open / REVIEW；不自动认领、不关闭、不标 DONE。
- 下游任务未解锁。
