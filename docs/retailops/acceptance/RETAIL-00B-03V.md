# RETAIL-00B-03V N0 执行冻结回执

日期：2026-11-28
状态：N0 PASS（范围与运行资源已冻结；仅定向测试文件/fixture/回执文件可改）

## 基线与输入

- 仓库：2Zest/OpenDot-RetailOps；branch `feat/retail-00b-03v`，worktree `/home/szz_user/projects/OpenDot-RetailOps-00B-03V`。
- 基线/HEAD：`a3bfec05308f2e94e52324525de7f24156883a1a`，等于 `origin/develop/retailops`；N0 初始 `git status --short --branch` 干净。
- #10 / RETAIL-00B-03：调查合并 PR #77，merge SHA `4bda549e7bcf250fe555d9e89e49ad59d5396d71`。其报告固定于先前调查源码 SHA `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`，当前运行输入则以 HEAD `a3bfec...` 为准。
- #7 / RETAIL-00F：PR #96 merge SHA 即当前基线 `a3bfec...`。回执 N2–N6 总体 PARTIAL（全量回归有基线失败、未启真实模型）；issue 已由 PR 完成关闭。`readonly_validation` 活动工具集禁用外部 MCP。本任务不在该模式运行、不修改其门控；只验证普通 Node Durable 的既有 MCP consent/grant/approval 路径。
- 已读取根 `AGENTS.md`、GitHub Issue #17 全文及本地契约、`RETAIL-00B-03V-PLAN.md`、#10 调查报告、#7 N2–N6 与只读运行手册。源码核对：`mcp-client.ts`、`mcp-contract.ts`、Session consent store、MCP approval store、Durable bridge、Product Runtime、Coding service/路由与 #7 readonly runtime；相关既有测试包括 MCP session/approval/client/Durable/HTTP product 集成测试及 #7 readonly tests。
- 现有机制能执行最小精确授权：Session 显式 consent 绑定 server/config/catalog/工具子集，grant/live authority 按 Session 校验；每次调用创建参数摘要绑定的单次 intent，approval 精确绑定参数摘要后才由 Managed MCP Connection 发送 `tools/call`。不需要扩大权限或加新通用能力。#17 不授权真实业务 MCP/API。

## 冻结文件清单

只允许新增以下三项；不修改 runtime、permission policy、共享路由、schema、依赖或 lockfile：

1. `tests/fixtures/retail-00b-03v-mcp-server.mjs`：专用、无害 MCP stdio server，固定只读与本地无害写 schema；按真实 MCP JSON-RPC initialize/list/call 收发，日志仅写隔离临时目录的脱敏参数摘要、JSON-RPC request ID 与结果。
2. `tests/retail-00b-03v-mcp-exact-call.test.ts`：用现有真实产品 HTTP/Node Durable 测试夹具和真实 Managed MCP stdio client，验证 consent/grant/审批、精确参数、幂等、撤权和拒绝/旁路边界；模型仅为本地确定性 Provider，不是 MCP mock。
3. `docs/retailops/acceptance/RETAIL-00B-03V.md`：N0 与后续节点回执、命令退出码、MCP 收据摘要、限制及 PR 交付状态。

候选已与主控 #8/#16 N0 文件清单核对，无路径交集。

## 隔离资源与执行命令

- 环境：WSL Ubuntu 24.04；Node `v24.22.3`；npm `11.19.1`；锁定输入为 HEAD 的原 `package-lock.json`。初始 worktree 未安装 `node_modules`；将运行 `npm ci` 按锁文件恢复，不更新 manifest/lock。
- 产品宿主/模拟模型只监听专用临时端口（helper 分配 loopback `127.0.0.1` ephemeral port）；独立测试 root 保存 SQLite、HOME、MCP ledger、Session/IPC/workspace。MCP fixture 通过 stdio 由该测试进程启动，不监听网络端口。每个测试 Session/request 使用随机 ID；不读取原 Home、主 worktree 的 DB/config/session/IPC，不连接真实业务 API 或服务。
- 运行命令冻结：`npm ci --no-audit --no-fund`；`npm run build`；`npm test -- --run tests/retail-00b-03v-mcp-exact-call.test.ts`；相关回归 `npm test -- --run tests/mcp-session-consent.test.ts tests/mcp-approval.test.ts tests/mcp-managed-client.test.ts tests/durable-mcp-native.test.ts tests/mcp-product-http.test.ts`；`npm run typecheck`；`npm run docs:check`；`git diff --check`。如测试失败保留首轮结果及日志后修正和复测，不弱化断言。
- 预期只修改三项冻结文件；运行时 `MINICLAW_PI_MCP=true` 仅作用于该隔离临时产品实例，服务器只授予固定 fixture 工具；不恢复 wildcard、不设置 `readonly_validation` 的 MCP 例外，不触发真实写服务。

## N0 限制

- 真实 MCP 定义为独立 MCP stdio 子进程通过现有产品 MCP client 完成 initialize/list/call JSON-RPC。模拟模型只负责驱动请求，不替代 MCP server/client 或授权/审批实现。
- 若集成路径必须修改 readonly gate、增加/放宽权限代码才能完成调用，立即将节点记为 BLOCKED 并报告源码位置、拒绝证据与最小方案；当前静态核验未发现此需要。

## N1–N4：真实 MCP 与授权验收

状态：PASS（仅本地无害 stdio MCP、确定性模拟模型和独立 Product Runtime；不代表真实业务 MCP 或真实模型验收）。

- 现有 `ManagedMcpConnection` 启动专用子进程并通过 stdio 完成 MCP `initialize`、`tools/list`、`tools/call` JSON-RPC。fixture 只提供 `fixture_read` 和 `fixture_write`；后者的唯一副作用是向本测试临时目录写脱敏 ledger。fixture 记录工具名、JSON-RPC request ID、参数 key 列表、参数 SHA-256、执行结果与结果摘要，不存参数原文。
- HTTP 产品宿主与确定性模型分别绑定 loopback 临时端口；本次产品端口 `45911`，临时 root 名 `miniclaw-bot-handoff-fault-hhq3Q4`。临时 root 独立承载 SQLite、HOME、MCP ledger、Session、IPC 和 workspace；测试结束由 helper 删除。MCP 子进程不监听网络。未读原 Home/工作区数据库或配置，未连接真实业务 API。
- 未 consent 的 Session 中，确定性 driver 故意提交了 schema 外的 fixture 工具名；MCP 工具未出现在活动 schema，进程未启动，ledger 为空，Session 未产生工具副作用。
- consent 只选择 `fixture_write`（单工具 grant）。工具调用进入 `pending` 时 ledger 执行数为 0；拒绝后状态 `denied`、执行数仍为 0。参数摘要改成另一组值后审批 API 返回 HTTP 409，状态未获批准且执行数仍为 0。用冻结的原摘要批准后，approval 状态到 `completed`，实际 stdio `tools/call` 一次，fixture 参数摘要与 intent 的 `arguments_digest` 相同。
- 重复相同 message request ID 返回原 message ID；重复相同 consent request ID 与 approval decision request ID 也保持幂等；最终 writer 实际执行仍只有一次。不同 Session 获取该 approval 参数返回 HTTP 404、尝试决策返回 HTTP 409；把 MCP approval ID 提交到普通业务 `/approvals/:id` 入口返回 HTTP 409，均无工具执行。
- 另一个 Session 单独 consent `fixture_read`；它同样在待审批时不执行，必须逐次 approve 后才通过真实 MCP `tools/call` 完成。现有通用 MCP 路径没有 READ_AUTO 例外；工具注释为 read-only 也不跳过审批。
- 撤销 writer consent 后，未决审批的迟到批准返回 HTTP 409；再次让 driver 提交已撤权工具名时，该工具仍不在活动 schema，server 未重启，ledger 执行数没有增加。

### 脱敏执行回执

| 项目            | 记录                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writer 授权范围 | Session `c5f8f300-c46d-4ef7-9c5a-9b6db34d6b2f`；server `retail_00b_03v_fixture`；consent/grant `8fc7a59b-bc82-4691-b507-2aac4619c615`；唯一工具 `fixture_write`                                                                                                                                                                                                                             |
| 被拒绝调用      | approval `19fc8e19-4566-4986-a0c9-b39aa65b01b3`；decision request `cc43f7fc-6bb3-427d-92c3-050766d302eb`；状态 `denied`；MCP 执行 0 次                                                                                                                                                                                                                                                      |
| 获批写调用      | approval `9ea066cb-5897-455c-a730-9bc4ec91bb59`；decision request `60ad3874-7cee-4548-ba3b-2097061ed778`；JSON-RPC request ID `4`；参数 SHA-256 `4fbe1f8c9afc04f4c1180576ecb7889a6309c0b26c1220a4b083858a69ea80e0`；结果 SHA-256 `c580cc5f347f3db0bf2241f7da69aa51012ab8f4597bd3eec2ef2dd3ed100532`；状态 `completed`                                                                       |
| 重复写请求      | message request ID `f5b0f9e1-affa-4d6c-9071-90053a06a541` 再提交后返回相同 message ID；ledger writer 执行数仍为 1                                                                                                                                                                                                                                                                           |
| Read 路径       | Session `b224b7e2-f952-4fe9-8b28-b8a1ae5d8deb`；consent/grant `fa7020d5-30ba-4b84-9a52-89d7fd3fa26f`；唯一工具 `fixture_read`；approval request `717f9a69-92b8-4737-b51c-134ca1738898`；JSON-RPC request ID `4`；参数摘要 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`；结果摘要 `5267f1e4b6671aa1788410527001eabccc5adec33e846bc60178826d77fd3259`；状态 `completed` |
| 撤权后探测      | approval `ca2be67d-80c3-4939-aa52-ea1c81ca66bc` 的迟到审批 request `810c6f5b-caaa-4073-8fc5-03f071ae4588` 被拒；后续消息 request `0f81b515-2e14-4399-b57b-d5729191198b` 无工具 schema、无新 server、执行数增量 0                                                                                                                                                                            |

上表不含 fixture 参数原文。JSON-RPC request ID 在每个独立 MCP server 进程内递增，因此 writer/read 都出现 ID `4`；调用分别由不同 Session、consent 和 grant 绑定。

## N5：命令与真实退出码

| 命令                                                                                                                                                                              | 结果                                                                                                                                                          | 退出码 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: |
| `npm ci --no-audit --no-fund`                                                                                                                                                     | 按现有锁文件安装 803 包；npm 提示 12 个包的 install scripts 未获 allowScripts 配置，未批准或运行所有脚本；better-sqlite3 实际可加载，后续 build/test 均可执行 |      0 |
| `npm run build`                                                                                                                                                                   | TypeScript build 通过；为隔离产品 HTTP fixture 生成本地 `dist/`                                                                                               |      0 |
| `npm test -- --run tests/retail-00b-03v-mcp-exact-call.test.ts`（最终版）                                                                                                         | 1 文件、1 项真实 MCP 集成测试通过                                                                                                                             |      0 |
| `npm test -- --run tests/mcp-session-consent.test.ts tests/mcp-approval.test.ts tests/mcp-managed-client.test.ts tests/durable-mcp-native.test.ts tests/mcp-product-http.test.ts` | 5 文件、50 项通过                                                                                                                                             |      0 |
| `npm run typecheck`                                                                                                                                                               | 根与 personal-agent TypeScript 检查通过                                                                                                                       |      0 |
| `npm run docs:check`                                                                                                                                                              | 292 份 Markdown 通过                                                                                                                                          |      0 |
| `git diff --check`                                                                                                                                                                | 通过                                                                                                                                                          |      0 |
| `npx prettier --check tests/fixtures/retail-00b-03v-mcp-server.mjs tests/retail-00b-03v-mcp-exact-call.test.ts docs/retailops/acceptance/RETAIL-00B-03V.md`                       | 三个冻结文件格式通过                                                                                                                                          |      0 |

### 首轮失败与修正记录

1. 新集成测试首轮退出码 1：断言 MCP tool result 必须包含 fixture 仅写入 ledger 的 `result_digest`；实际 result 按设计返回参数摘要而非 ledger 元数据。将断言调整为检查工具返回的 `arguments_digest`，同时在脱敏执行回执中记录独立 `result_digest`；最终版本通过。
2. 加入普通业务 `/approvals/:id` 旁路探测后首轮退出码 1：测试期望 404，实际路由将该类型不匹配统一映射为 HTTP 409。确认响应是拒绝且 ledger 仍无新增调用后，将断言修正为 409；最终版本通过。

未弱化 consent、摘要、状态或 ledger 断言；没有运行完整全仓测试。既有 #7 回执中的真实模型未运行/全量基线失败信息仍适用，不由本任务重验。

## N6：Review 交付

- 仅新增 N0 receipt、专用 MCP stdio fixture 与定向集成测试；没有 runtime、readonly gate、通用安全策略、依赖、lockfile、SQLite schema 或路由改动。
- 当前分支 `feat/retail-00b-03v`；PR 将独立提交到 `develop/retailops` 并保持未合并。创建 PR 后将把链接、HEAD、Issue/Project Review 状态回读补入本节。
