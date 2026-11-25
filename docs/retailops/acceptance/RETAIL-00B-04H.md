# RETAIL-00B-04H 节点验收回执

**状态：REVIEW。** PR #78 Open、未合并、等待独立 Review；Issue #11 Open/REVIEW，不标 DONE。

总体计划：docs/retailops/initial-plan-v0.2/RETAILOPS-MASTER-PLAN-V0.2.md（G0 已于 2026-11-25 获批准）。场景：RETAILOPS-SCENARIO-V0.2.md。DAG：dependency-graph.json。模板：NODE-RECEIPT-TEMPLATE.md。
Issue 契约 Blob：fc7fa13d5d6cc4fe6dc9df3f66e54cc586643df2。Plan Blob：e22d1b64587118dfe1b82035a683aa4db88e63a。模板 Blob：e276079adc8678ee4366d43e90f3f765156a5bb3。
源码固定基线：e8db2b6b983e9cd2eeca79e596f81b2e5b93663a。源码函数/路径/行号及链接见调查报告。

## N0 — 环境、依赖、范围预检

- 执行角色：Multi-Agent Runtime Agent。
- Worktree/分支：/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00B-04H / docs/retail-00b-04h。
- 初始 HEAD：e8db2b6b983e9cd2eeca79e596f81b2e5b93663a，与 origin/develop/retailops 一致。
- DAG：#11 depends_on=[]；下游 RETAIL-00C 与 #18。远程 Issue 为 Open/IN_PROGRESS、无 assignee。G0 批准已归档。
- 环境：WSL2 Ubuntu 24.04.1、Node v24.22.3、npm 11.19.1、Make 4.3。初始 git status clean；MemAvailable 约 12 GiB，根盘约 944 GiB 可用。远端分支原先不存在；新分支建立 tracking 后推送 SHA 与基线相同，未强推。
- 允许修改路径：仅 docs/retailops/investigation/RETAIL-00B-04H.md 与 docs/retailops/acceptance/RETAIL-00B-04H.md；无源码、配置、依赖改动。
- 动作/结果：只读核对 Git、DAG、批准记录、计划与测试范围；固定实际基线。
- 命令/退出码：git status --short --branch / 0；git rev-parse HEAD / 0；DAG 检查 / 0；GitHub 状态查询成功。
- 证据模式：静态仓库/远程元数据。未启动真实 Runtime。

| 对齐层 | 预期语义 | 实际事实 | 判定 |
|---|---|---|---|
| 总体计划/场景 | G0 已批，按 DAG；调查不越过运行验收 | G0 批准，#11 无上游硬依赖，下游未解锁 | PASS |
| Issue/Plan | 只读调查、隔离 fixture、无业务实现 | 初始 clean，范围限定两份文档 | PASS |
| 节点标准 | 基线、授权、环境、路径固定 | HEAD、环境、Issue 状态及路径已记录 | PASS |

偏差：无。结论：PASS，进入 N1。

## N1 — 委派、lease、身份和恢复

- 动作：追踪 Goal Runtime 到 Goal Team、Scheduler claim/lease、Handoff admission/session、失败态与恢复控制；只读。
- 源码：固定 SHA 的 goal-runtime.ts:21–35、goal-team-store.ts:173–196, 279–346, 489–622、goal-team-runtime.ts:27–112、handoff-store.ts:845–912, 1563–1655、handoff-service.ts:471–546。函数名和锚点见报告。
- 实际修改：无。只读源码检查 / 0。
- 结果：Scheduler 持有 Goal occurrence 和 lease，Bot Handoff 建独立接收者 session；contract 绑定 run、grant/digest、deadline 与工具范围；恢复使用 revision-fenced 控制；failed/uncertain/cancelled 不自动完成 Goal，完成还须校验结果/证据 receipt。
- 风险：源码静态证据不等于 #18 实际运行；schema 未表达独立 reviewer 身份。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 与 R05 暂停/恢复和失败未知对账一致，不宣称零售能力已实现 | PASS |
| Issue/Plan | 已追踪委派、状态、身份与恢复 | PASS |
| 节点标准 | 状态/身份证据含固定源码引用 | PASS |

结论：PASS，进入 N2。

## N2 — 接收者工具范围与只读权限

- 动作：核对 grant schema、执行边界、输入绑定、审批作用域与 Product Approval operation。
- 源码：固定 SHA 的 handoff-store.ts:60–76, 146–226, 962–1001、goal-team-store.ts:551–566、handoff-service.ts:78–162、approval-store.ts:37–89。
- 实际修改：无。源码检查 / 0。
- 结果：工具按 grant 白名单并在执行时检查；当前枚举有 workspace read、私有 artifact 创建、文本检查和 device read。没有发现零售交易写接口；artifact 创建是写效果，不能称只读。Product Approval 只批准私有 artifact，不是零售业务风控审批。未见独立 reviewer 角色。
- 风险：本次未配置或调用真实业务工具；未来零售数据源仍需单独验收只读范围。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 调查权限硬约束，没有将 Product Approval 扩张为零售审批 | PASS |
| Issue/Plan | 完成接收者范围和只读证据核对，没有改安全策略 | PASS |
| 节点标准 | 明示读取范围和 artifact 写能力的限制 | PASS |

结论：PASS，进入 N3。

## N3 — 本地候选

- 动作：只读核对 runtime 选择和 fixture 隔离机制；未启动 fixture 外服务。
- 源码：固定 SHA 的 handoff-service.ts:78–96、goal-team-store.ts:198–267、tests/helpers/bot-handoff-http-fixture.ts:36–65, 115–215。
- 实际修改：无。源码检查 / 0。
- 结果：候选为不含 device resource 的 Node Durable host workspace 与明确授权 local provider；现有 fixture 有 temp root、独立 HOME/端口/DB、loopback fake provider 和子进程。没有配置真实 provider 或执行真实本地 RetailOps Handoff。
- 未验证：真实本地 provider 配置、业务副作用、#18 环境。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 未启用业务工具或外部数据 | PASS |
| Issue/Plan | 给出本地可行性候选，不部署云 | PASS |
| 节点标准 | fixture 方案可复核，真实实例明确 NOT_RUN | PASS |

结论：PASS，进入 N4。

## N4 — 定向测试与回归

- 资源：主控在 #10 测试结束后授予唯一高负载窗口。测试前 MemAvailable 约 12 GiB、根盘约 944 GiB；测试后约 12 GiB、942 GiB。
- 安装：npm ci，退出码 0；803 packages。npm 报 48 项 audit advisory（2 low、20 moderate、23 high、3 critical），未执行 audit fix，未改 package/lock。
- T01/T02 命令：

      PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm test -- --run tests/goal-team.test.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts

- 结果：退出码 0，4 files、16 tests passed，73.35 秒。覆盖 Goal Team、owner/member、撤销 grant、lease/control、失败与 SIGKILL 恢复。均为临时 DB/子进程/loopback fake model fixture；不是实时模型、生产环境、零售写接口或 #18 验收。
- 回归：上一轮 npm run docs:check 退出码 1，基线 docs/retailops/RETAILOPS-ROADMAP.md:1 引用了缺失的 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。公共修复尚未合并，本轮按要求未复跑；待合并后复验，未混入本 Issue 修复。
- 差异：测试期间无 tracked 源码/配置/lockfile 改动。最终 git diff --check 退出码 0。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 明确区分 fixture 和真实运行，不声称业务风控通过 | PASS |
| Issue/Plan | T01/T02 通过，docs:check 基线失败分类记录 | PASS |
| 节点标准 | 退出码、用例数、耗时、资源与限制有证据 | PASS |

偏差：公共 docs:check 断链为已知基线问题，本任务不修复。结论：PASS（基线失败已分类），进入 N5。

## N5 — 交付与 Review

- 实际修改：仅 investigation/RETAIL-00B-04H.md 与 acceptance/RETAIL-00B-04H.md。
- 交付：报告记录固定 SHA、路径/函数/行号、接口/角色边界、本地候选、fixture 测试、未验证事项与回滚方案。Issue 状态不改、不认领、不关闭、不标 DONE、不解锁 #18。
- 本次回执更新仅补充 PR 状态；git diff --check 退出码 0。
- PR #78：https://github.com/2Zest/OpenDot-RetailOps/pull/78，关联 #11，base develop/retailops。PR 当前 Open、未合并，等待独立 Review；Issue 不标 DONE。
- 回滚：独立 revert 文档提交。审核者/时间：执行 Agent 自检，2026-11-25。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 文档调查交付，未合并/未实现业务能力 | PASS |
| Issue/Plan | Handoff 接口和本地可行性说明已交付，无范围漂移 | PASS |
| 节点标准 | PR #78 已建立并保持 Open，尚未合并；等待独立 Review，不标 DONE | PASS（交接）|

## 最终结论

- N0–N5 在调查/文档范围内 PASS；N5 表示交付及 PR 建立完成，不表示已 Review 或合并。
- 源码调查完成；隔离 fixture 定向测试 16/16 通过。
- 真实 RetailOps Runtime、真实模型/数据/副作用、#18 Handoff：NOT_RUN。
- npm run docs:check：已知基线失败，未修。
- Issue #11 保持 Open/REVIEW；未认领、未关闭、未 DONE；下游未解锁。


## Review 补充 — Node/Cloud 能力与 #18 验证方案（未执行）

**状态：REVIEW。** PR #78 Open、未合并、等待独立 Review；Issue #11 Open/REVIEW，不标 DONE、不解锁 #18。

### 能力与开关矩阵

| 项目 | Node Durable | Cloud Durable |
|---|---|---|
| Handoff flags | MINICLAW_BOT_GROUPS=true、MINICLAW_BOT_HANDOFFS=true、MINICLAW_DURABLE_RUNTIME=true | MINICLAW_BOT_GROUPS=true、MINICLAW_BOT_HANDOFFS=true、MINICLAW_CLOUD_RUNTIME=true、MINICLAW_CLOUD_BOT_HANDOFFS=true；默认 off，无自动 Node fallback |
| Goal Team flags | 再加 MINICLAW_PERSONAL_GOALS=true、MINICLAW_GOAL_TEAMS=true | 再加 MINICLAW_PERSONAL_GOALS=true、MINICLAW_GOAL_TEAMS=true、MINICLAW_CLOUD_GOALS=true、MINICLAW_CLOUD_APPROVALS=true（Cloud Goal admission 检查 artifact capability） |
| Provider | Enabled Provider、model ID、API key/token；OpenAI Completions 或 Anthropic Messages | HTTPS gateway origin 精确匹配、shared secret 至少 32 字符、enabled OpenAI Completions Provider |
| Workspace / Session | active owner；Node Handoff scope 可用 owner Host 或 Container Workspace（Host 需 Host 执行权）；Goal Team 的 Goal/Group 与 Bot scope 都要求 owner Host Workspace；每个 Handoff 新建独立 Product/Node Durable Session 与 origin | active owner Host Workspace/Host 执行权；独立 Product Session/Cloud placement；Node Gateway 仍参与授权、provider proxy 和结果投影 |
| Grant / tools | Owner reviewed、revision scoped、1–12 attempts、1–1440 分钟、最多 2 能力；Node 不支持 inspect_text/device read | Owner reviewed、默认空；支持 inspect_text，不支持 read_workspace_file；artifact 需 MINICLAW_CLOUD_APPROVALS=true |
| 可选能力 | 最小授权只读工具，不启用 private artifact 写效果 | Product Runtime memory flags 不会自动赋予 Handoff memory（Handoff grant 不含 read_personal_memory）；device 需 MINICLAW_CLOUD_DEVICES + MINICLAW_DEVICE_NODES、paired device 和 manifest path。本次不启用 |

源码证据固定于 e8db2b6：product-model.ts:42–215、automatic-goal.ts:26–110、handoff-store.ts:47–76/259–342/845–912、handoff-service.ts:78–110、goal-team-store.ts:198–267；详细链接见调查报告。Enabled Provider 配置和指纹、Host owner 权限、Bot scope/revision、grant digest、deadline 与工具调用限制均已写入报告。Node Durable 的本机执行不等于本机推理：若 #18 要求本机模型，应选择获批、API-compatible 且隔离实例可访问的本机 Provider；配置在 Node 的远程 API 仍是外部调用，须另行授权。

### #18 RETAIL-00B-04V 未来真实验证（NOT_RUN）

#18 需等待 00F、00B-04H、00B-02V 依赖证据；当前 #78 未合并，不启动。未来专用实例使用固定集成 SHA、temp HOME/DB/端口/Workspace、active Owner、显式最小 Grant。优先 Node Durable；无可用且批准的本地 Provider 时 BLOCKED，不自动改 Cloud。本轮没有创建角色、改 flags、调用 Provider 或运行 #18。

| 用例 | 预期 |
|---|---|
| T01 正常委派 | 唯一 Goal/run/Handoff/new Session/request/input/submission/Task/digest；coordinator 无 native input；recipient 只执行 reviewed grant 内的只读工具；同一 request 不产生第二份 native input/submission，模型重试仍受原预算限制（不宣称 exactly-once inference/billing）；结果需服务端 receipt/evidence。 |
| T02 角色隔离 | coordinator 与 recipient session 不同，Owner control 与 Bot execution authority 分开。只能核验现有协调者/执行者隔离；没有 RetailOps 独立 reviewer 和草案摘要绑定，禁止新建风险 Agent或声称已实现。 |
| T03 越权拒绝 | member/other admin、revoked/expired grant、stale revision、错误 runtime/provider fingerprint、越权工具均拒绝；actor admission/control 被拒时不触发 Provider；若模型已请求未授权工具，该推理调用可能已发生，但工具边界应拒绝且无对应 Tool Task/效果。 |
| T04 Lease 恢复 | 停止隔离 Node 进程、等待 lease 到期后接管；lease 可以更换，但原 occurrence/Handoff/session/input/submission/Generation Task/digest 保持，不能重复 prompt/效果。 |
| T05 失败/uncertain | 隔离 Provider interruption/cancel/receipt fault 后，failed/uncertain/cancelled 不完成 Goal、不产生 Goal completed 证据、不推进下一 occurrence；保留已提交效果的原 receipt，uncertain 不作 Goal 完成依据并保持待 reconciliation。 |

既有测试参考：Goal Team 唯一委派且 coordinator 无 input（goal-team.test.ts:252–280）；stale lease fence（313–357）；越权和 grant 缺失（359–385）；恢复复用 ID（bot-handoff-recovery.test.ts:21–118）；uncertain 不重生成（260–302）。参考命令（本轮未运行，fixture 不能替代真实运行）：

    npm test -- --run tests/goal-team.test.ts tests/goal-team.integration.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts

### 公共 docs 检查

上一轮 docs:check 退出码 1，旧路线图断链。公共修复 PR 未合并，本轮按要求未复跑；修复合并后再复验。当前只运行 git diff --check。
