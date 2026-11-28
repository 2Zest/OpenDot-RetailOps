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