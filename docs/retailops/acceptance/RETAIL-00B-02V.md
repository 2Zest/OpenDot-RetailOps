# RETAIL-00B-02V 节点验收回执（N0）

**当前判定：N0 PASS（范围与输入冻结）；N1 BLOCKED；N2–N4 NOT RUN。**
本回执只记录已核对事实。没有启动产品 Runtime、真实模型、MCP、Docker 容器或外部效果；不改写 GitHub Issue / Project 状态。

## N0：基线、依赖、环境与范围

- Issue / Plan：#16 RETAIL-00B-02V，Plan 版本 initial-plan-v0.2；用户已授权认领，Issue 当前 IN_PROGRESS。
- 总体计划：RETAILOPS-MASTER-PLAN-V0.2.md v0.2，APPROVED。
- 基线/分支/worktree：a3bfec05308f2e94e52324525de7f24156883a1a；feat/retail-00b-02v；/home/szz_user/projects/OpenDot-RetailOps-00B-02V。该 SHA 与 origin/develop/retailops 一致；初始工作区干净。
- 硬依赖：GitHub #7 当前 DONE/Closed，PR #96 merge SHA a3bfec05308f2e94e52324525de7f24156883a1a；#9 当前 DONE/Closed，PR #74 merge SHA 0ce19d390a99aa3e14307b84094aba4aeeb74a59。两者 merge commit 均为本基线祖先。#7 最终验收明确把真实模型分配给 #8、Durable checkpoint/恢复分配给 #16；合成 Provider 不能冒充 #16 实跑。
- 范围协调：#8 的一次性 Relay 由 #8 唯一负责；#16 不改 Relay、网络权限、共享源码、Runtime、锁文件或测试断言。唯一候选提交路径是 docs/retailops/acceptance/RETAIL-00B-02V.md，与 #8/#17 候选代码路径无重叠。
- WSL 环境：Node v24.22.3、npm 11.19.1；available memory 约 13 GiB；worktree 文件系统可用约 937 GiB。候选端口 43127 检查为空闲。worktree 下 data/ 与 node_modules/ 均不存在。
- 密钥与模型出口：没有经安全注入提供给此实例的可用模型凭据/配置。只检查了环境变量是否存在，没有读取或输出其值；没有访问原 Home、既有应用数据库或密钥文件。对话文本中出现的凭据样式内容未使用、未复制、未写日志。等待轮换后的密钥通过安全 UI 注入且 #8 Relay 可用；在此之前不发起模型请求、不尝试可能计费的直连 Provider。
- 隔离边界：src/config.ts 将 DATA_DIR 固定到 process.cwd()/data；Durable 文件目标为 data/db/durable-sessions/<sessionId>.sqlite，Session/IPC 也须位于本 worktree 自己的 data/。若后续解锁，HOME、XDG、Claude 配置和 npm cache/config 均指向 /tmp/retail-00b-02v-*；Host 只绑定 loopback。没有接触或停止现有 Docker 容器。

### 冻结输入版本与 SHA-256

| 输入 | SHA-256 |
|---|---|
| 基线 | a3bfec05308f2e94e52324525de7f24156883a1a |
| #16 执行 Plan | 62bf1a3fe3d3c398537b0200fb70bb4fb78df98cde55b92be075c3b760a6d1c6 |
| #16 契约 | fa8a49396f16116d5c533befb2bc5f12e9baf1db5f596c5a282f1faec39ca82b |
| 总体计划 | 7b97b12141c4392a926925ae6a5673ea09d140d6b83da36e17c9db976146253e |
| dependency-graph.json | 11f25c9d22e7986bd21c137eeb1a72ba3a3d158cae0b7238ac41e0e29fdfab86 |
| #9 Durable 调查 | bc920f6ab7959cb57b17f5539c78a9161944dd8e5ba3f3e492783627f80c38b2 |
| #7 隔离验收 | d81d4e5eb4c60acb0ebf747cd3089da18dee9872ff8ab6ba4ca44659049f0dd0 |
| #7 只读运行手册 | 3922561a7753dc6e1067b6ed6faffc2c2d5442f11de9a46f1af1026ad67e401e |
| 节点回执模板 | 04e0fe3232d895c74b47b73f81b9f7e54a93ebd4ba365b312cbe744ce46bc19f |

## Node Durable 原生路径核验（静态，非运行证据）

1. 产品 Session 由 src/routes/agents.ts 选择 Runtime。src/personal-agent/product-model.ts 的 selectNewProductRuntime() 仅在 MINICLAW_DURABLE_RUNTIME=true 且 workspace、授权、模型配置满足条件时选择 pi-durable。
2. 产品模型从应用加密 Provider 配置读取 API key/token。当前隔离实例没有 provider 配置；无安全密钥注入，不能创建真实模型配置。#7 合成 Anthropic SSE 只验证 #7 的容器工具边界，不是 #16 真实模型。
3. src/personal-agent/product-runtime.ts 为每个 Session 选 data/db/durable-sessions/<sessionId>.sqlite；PiDurableRuntimeAdapter.open() 调用 openNodeSqliteStorage() 和 Harness.open()，数据库权限为 0600，并创建本地 SQLite 所有权协调文件。恢复前会核验 owner、Conversation 和产品 receipts，再 activate 并调用 Harness.resume()。
4. src/personal-agent/durable-runtime.ts 提供原生 Conversation submission 与 inspection 路径。预期关联为产品 request ID → 原生 Submission ID → 原生 Task ID / answer entry；本轮没有生成任何真实 ID。
5. Pi Durable SQLite Storage 才保存原生 Conversation、Submission、Task/checkpoint/memo。应用侧 product_session_inputs 和 product_input_task_sources 仅保存幂等回执/绑定投影，不能视为 Runtime checkpoint；本轮未读取或创建业务表。
6. package-lock.json 固定 @earendil-works/pi-durable、pi-ai、chord 均为 1.3.0。由于 node_modules 尚未安装，本轮没有读取 SDK 包内 SQLite DDL，也没有声称物理 schema 已实测。

### 候选运行命令与资源（尚未执行）

仅当轮换密钥已由安全 UI 注入、#8 Relay 实际可用且主控确认后，才考虑从本 worktree 运行：HOME=/tmp/retail-00b-02v-home XDG_CONFIG_HOME=/tmp/retail-00b-02v-xdg CLAUDE_CONFIG_DIR=/tmp/retail-00b-02v-claude MINICLAW_DURABLE_RUNTIME=true MINICLAW_WEB_BIND_LOOPBACK=true WEB_PORT=43127 npm run dev。之后只用此实例自己的账户、Host grant、Provider 配置、Session、SQLite 和 IPC；启动前重新核验端口、路径及 tool/MCP grants。
执行候选为真实 Node Durable Session、多步只读模型输入及稳定 request ID；只有确认原生 checkpoint 已提交、无 effect 在途后，才停止此实例 PID 并通过同一 DB/Conversation/Run ID 走原生恢复。候选 API 场景来自 #9 调查，执行前须按当前路由再核验。没有把普通 Session 历史重载当恢复。

## 节点三层语义判定

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| PRD / 总体计划 | Durable 恢复仍是独立门槛；未开发业务、未扩权限 | PASS |
| Issue / Plan | 必须真实模型 run、checkpoint、进程中断/原生恢复，并覆盖幂等、取消/失败/uncertain | BLOCKED：缺经安全注入的凭据与可用 #8 Relay |
| N0 节点标准 | 基线、上游、输入 hash、候选文件/命令、隔离资源已固定 | PASS |

- N1：BLOCKED。没有提供给此实例的轮换密钥/模型配置，且受控 Relay 尚待 #8 可用；未启动服务或调用模型。
- N2：NOT RUN。没有创建真实 Product Durable Session/Run；无 conversation、request、submission、task ID。
- N3：NOT RUN。没有运行至安全 checkpoint、中断进程或恢复；无恢复通过证据。
- N4：NOT RUN。重复/冲突请求、幂等、副作用、取消/失败/uncertain 均无实测数据。
- N5：N0 回执提交后只运行锁定依赖 fixture 回归与文档检查；fixture 不解除真实运行阻塞。
- 未访问原 Home、未读写/输出密钥、未直连 Provider、未触发计费请求；未改源码、断言、依赖、锁文件或安全策略；未访问/修改 Docker 容器。
- 解阻条件：#8 Relay 可用；轮换后的真实模型密钥经安全 UI 注入专用配置；主控确认隔离 runtime 与 checkpoint 中断安全点后重新冻结 N1。此前保持 BLOCKED，不解锁下游。

## 后续回归命令

N0 提交后，仅在 /tmp/retail-00b-02v-* HOME/config/cache 下使用锁文件、忽略 lifecycle scripts 安装依赖，并跑原 fixture suite 和文档检查。fixture 仅属隔离测试，不算真实 Node Durable 通过。

    npm ci --ignore-scripts --no-audit --no-fund
    npm run demo:durable-runtime
    npm run docs:check
    git diff --check

真实 Durable 服务、真实模型、实际 Run/checkpoint/recovery 在本回执创建时均未运行。
## N0 后补充：锁定 SDK 源码与 fixture 回归

以下证据在 N0 回执先提交后取得；不改变节点判定和已冻结的产品运行边界。

### 安装与回归结果

- 首次 npm ci 环境检查命令 exit 1：user/global 配置都指向 /dev/null，npm 在配置解析阶段因 double-loading config 停止，尚未安装包。随后改为独立的 /tmp 配置文件路径重试。
- 安装命令：在本 worktree 运行 npm ci --ignore-scripts --no-audit --no-fund；HOME、npm user/global config、cache 均指向 /tmp/retail-00b-02v-*。退出码 0，803 packages / 19s；lifecycle scripts 被明确忽略，没有运行依赖安装脚本。
- npm 提示旧版或弃用包：rimraf@2.6.3、prebuild-install@7.1.3、inflight@1.0.6、glob@7.2.3、node-domexception@1.0.0、boolean@3.2.0、@opentelemetry/sdk-trace-base@2.5.1；另有 npm 新版本提示。未运行 audit/fund；没有升级包。
- git diff --exit-code -- package.json package-lock.json：退出码 0，锁文件和 package.json 未变化。
- 在同一隔离 HOME/config/cache 下运行 npm run demo:durable-runtime：退出码 0，5 个测试文件、26 项通过。
- 文件结果：pi-durable-runtime 9、pi-durable-input-ledger 4、pi-durable-process-recovery 5、pi-durable-ownership 6、durable-model-smoke 2，全部通过。
- 故障测试使用隔离子进程和模拟服务回执，覆盖 before-effect、after-effect、after-checkpoint、模拟 provider 请求恢复与 request receipt；ownership 测试包括同数据库单实例获得 Harness、SIGKILL 后本地 SQLite owner 释放。durable-model-smoke.test.ts 明确使用 fauxProvider。它们确实通过原生 Pi Durable Harness / SQLite adapter，不是普通 Pi Session，但都属临时 SQLite、fixture provider、模拟 effects 和测试子进程；不是 Product Runtime/API/真实模型，不证明本 Issue 的真实 Run、checkpoint、中断/恢复或收费/副作用语义。

### 锁定 Pi Durable 1.3.0 的源码结构核验

安装后只读检查 node_modules 中由 package-lock 固定的 @earendil-works/pi-durable 1.3.0 文件；未创建本任务 Product Runtime 数据库。SQLite migration v1 定义 durable_schema、durable_metadata、record_ids、conversations、entries、tasks、submissions、documents、document_revisions 与关联索引；durable_metadata 持有 next_id / next_seq，record_ids 记录 conversation / entry / task / submission / document 类型，payload record 用 JSON 校验。

SubmissionId 与 TaskId 是 SDK 的数值型品牌 ID。Submission 记录含 conversationId、可选 requestId 和 queued / placed / done / unanswered 状态；SQLite 索引 requestId 的查找范围是 Conversation。SDK admitSubmission 对已见 requestId 返回同 type 的既有 submission ID，不比较 payload；MiniClaw 产品层的 requestId + payload digest ledger 才负责拦截同 ID 不同内容，不能把 SDK 去重称 exactly-once。

Task record 的 pending / running / waiting 状态保存完整 checkpoint；completing / terminal 状态保存 outcome，不再保存 checkpoint。Task 记录另有 kind/version/input、abortRequested、background 和活跃期 memos。Document revisions 以 base/delta 保存。Harness.open 调用 openTasks，将遗留 running Tasks 协调回 pending；在 MiniClaw 路径中还需先过 owner/receipt 校验，再由 adapter.activate 调 harness.resume。Node SQLite adapter 使用 WAL、synchronous=NORMAL、默认 1000 页 WAL autocheckpoint。以上是锁定 SDK 源码静态核验，不代表本任务实际 SQLite 文件或崩溃恢复实测。

### 当前状态仍然阻塞

npm fixture suite 退出码 0 只证明锁定 SDK adapter 的模拟路径正常。因无安全注入后的真实模型凭据，且 #8 Relay 尚未实际可用，本任务没有启动产品服务或模型，仍没有真实 Product Durable Run ID、Task checkpoint、状态轨迹、工具 receipt、幂等/取消/失败/uncertain 结果。N1 BLOCKED；N2–N4 NOT RUN；不能将 fixture 结果记作真实恢复 PASS。

### 文档与差异检查

- 使用隔离 HOME/config/cache 和 Node v24.22.3 执行 npm run docs:check：退出码 0，292 个仓库 Markdown 文件通过。
- git diff --check：退出码 0。
- git diff --exit-code -- package.json package-lock.json：退出码 0。
- N0 commit 之后，工作树唯一已跟踪改动仍为本验收回执；node_modules 属忽略的本地依赖安装。未运行全量测试、build 或 Product Runtime。
- N5 判定：fixture 回归和文档/差异检查通过；由于 N1 BLOCKED，真实模型/真实 Product Durable 节点不通过也未运行。N2–N4 保持 NOT RUN。


## 最终 Issue / PR / Project 状态回读（2026-11-28）

本节为当前状态的最新回读，覆盖本回执前文较早记录的 Project #2「尚未同步 / In Progress」信息。

- Issue #16：保持 Open，标签为 BLOCKED；Issue 正文保留 N0 PASS、N1 BLOCKED、N2–N4 NOT RUN 的阶段判定。
- PR #98：保持 Open、未合并，目标分支 develop/retailops，源分支 feat/retail-00b-02v。本次回读时 PR HEAD 为 64b26b958c5fdd5eb15b4f914c87a3b8799c67d6；本次文档补充提交将成为新的 PR HEAD，提交 SHA 由该提交记录及 PR 更新后的 head 回读确认。
- GitHub Project #2 的 #16 卡片：由 #17 owner 的认证 gh context 更新，并通过 project item-list 回读确认为 Blocked（label BLOCKED）。
- 三处状态目前均为未完成阻塞态；此更新只补充状态回执，不改变 N1–N4 判定，不代表真实 Durable Run 或恢复验收通过。
