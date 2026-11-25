# RETAIL-00A Linux 基线验收报告

验收日期：2026-11-25；环境：Ubuntu 24.04.1 LTS / WSL2；结论：**PARTIAL**。

Linux 环境搭建成功，续验已确认本地管理员初始化、真实模型对话、Host Runner 工具调用与刷新后会话持久化；但项目完整运行验收仍未全部通过。自动化测试仍存在仓库权限位、模块导入、长时 Cloud Handoff 和 Web E2E 问题，Goal、Product Durable Runtime、MCP 审批及 Container Runner 也未达到真实验证条件。

## Git 基线

| 项目 | 实际值 |
|---|---|
| 仓库 | `https://github.com/2Zest/OpenDot-RetailOps.git` |
| 分支 | `feat/retail-00a-baseline` |
| 验收开始 HEAD | `a1c3af65e73fed102094708e87f01e420a8c635b` |
| Linux 路径 | `/home/szz_user/projects/OpenDot-RetailOps` |
| PR | `https://github.com/2Zest/OpenDot-RetailOps/pull/1`，base `develop/retailops` |

开始时分支与远程一致。三个 V0.1 规划文档从 Windows 工作区复制并校验 SHA-256；Windows 原工作区及其未提交修改未清除。本次只提交规划文档、环境文档与 Linux 验收报告，不提交构建产物、测试日志、图标或 manifest。

## 环境摘要

Node.js v24.22.3、npm 11.19.1、Git 2.43.0、GNU Make 4.3、Python 3.12.3、GCC/G++ 13.3.0、Codex CLI 0.172.0。Docker Desktop Engine 28.5.1 通过 WSL Integration 可用；Playwright 1.62.1 及 Chromium 已安装。完整环境与存储记录见 `docs/retailops/environment/WSL2-SETUP.md`。

## 依赖安装

| 命令 | 退出码 | 耗时 | 结果 |
|---|---:|---:|---|
| `npm ci` | 0 | 40s | PASS，803 packages |
| `npm --prefix web ci` | 0 | 11s | PASS，683 packages |
| `npm --prefix container/agent-runner ci` | 0 | 16s | PASS，242 packages |
| `npm --prefix apps/cloud-agent ci` | 0 | 10s | PASS，332 packages |

所有安装均依据现有 lockfile；未升级依赖，未删除或修改 lockfile。npm 报告了现有漏洞和 install-script 审查告警，未执行自动修复。

## 编译与自动化测试

| 命令 | 退出码 | 通过 / 失败 / 跳过 | 结果 |
|---|---:|---|---|
| `make typecheck` | 2 | 不适用 | FAIL：`scripts/sync-stream-event.sh` 为 Git mode `100644`，Makefile 直接执行时 Permission denied |
| `npm run build:all` | 0 | 后端、Web、Agent Runner 均构建成功 | PASS，22s |
| `npm test -- --run` | 1 | Tests 3657 / 1 / 44；Files 522 / 6 / 13 | FAIL，573s |
| `npm run self-test:agent-runner` | 0 | 自检通过 | PASS，1s |
| `npm --prefix apps/cloud-agent run build` | 0 | Wrangler dry-run 通过 | PASS，3s |
| `npm run test:cloud-authority` | 1 | Tests 133 / 1 / 0；Files 23 / 1 / 0 | FAIL，1126s |
| `npm run docs:check` | 0 | 130 Markdown files | PASS（续验后复跑） |
| `npm --prefix web run test:e2e` | 1 | 44 / 14 / 2 | FAIL，409s |

### 失败证据分类

1. **仓库配置问题**：`scripts/sync-stream-event.sh` 由 Git 记录为 `100644`，但 Makefile 第 192 行以可执行文件调用，真实 Linux 上失败。未用 `chmod` 或修改 Makefile 绕过。
2. **单测/模块导入问题**：五个 suite 在 `src/web.ts` 注册路由时收到 `undefined`，Hono 读取 `.routes` 抛出 TypeError；涉及 goal、team overview、GitHub goals、device nodes 等测试。`tests/pocket-features.test.ts` 的 Node 子进程另有一项失败。
3. **Cloud 稳定性问题**：Cloudflare Durable→Cloudflare Durable 资源冲突恢复用例等待 Isolated Bot Handoff 断言 60 秒超时；同一矩阵其余三个组合通过。
4. **E2E/服务编排与 UI 问题**：14 项失败、2 项跳过。日志包含 Vite 代理连接 `127.0.0.1:3000` 被拒绝、移动端元素未出现和 150 秒 convergence 超时。Playwright 已生成失败截图与 trace。
5. **构建副作用**：`npm run build:all` 在全新 Linux clone 中改写 11 个图标与 `web/public/manifest.webmanifest`。这些文件不属于本次提交，也未清除。

## 真实模型与运行时续验（2026-11-25）

续验只读取非敏感配置元数据和本地会话事件；未读取、打印或写入 API Key。

| 项目 | 实际值 | 状态 |
|---|---|---|
| Provider | `deepseek`，类型 `third_party`，Anthropic 兼容端点 `https://api.deepseek.com/anthropic` | PASS |
| 模型 ID | `deepseek-flash` | PASS |
| 工作区 | `web:main` / `main`，`execution_mode=host`，Home workspace | PASS |
| 实际 Runner | Host Runner 的 `local-pi` 路径；后端已拉起 `container/agent-runner/dist/pi-index.js` | PASS |
| 模型成功证据 | 成功会话共 39 个事件，18 个含非零 token usage 的模型响应；既有 `stop` 也有 `toolUse` | PASS |
| Tool Calling | 10 次 `bash`、1 次 `mcp__miniclaw__workspace_memory_remember` | PASS |
| 多步调用 | 单次任务最长连续 7 个 assistant `toolUse` 步骤，之后以正常文本响应结束 | PASS |
| 会话持久化 | 浏览器刷新及离开页面后返回，历史消息仍可见；后续轮次可取回先前保存的测试标识 | PASS |

最初两个会话把模型误配为 `deepseek-flash[1m]`，均收到上游 404 且无 token 使用；这些失败记录保留。修正模型 ID 后创建的新会话使用 `deepseek-flash` 并持续成功。这里的持久化只证明页面刷新、重新进入会话和 Workspace Memory 跨轮次有效，**未**证明后端重启恢复或 Product Durable Runtime 恢复。

普通对话并未经过 Container Runner 或 Product Durable Runtime。依据工作区 `execution_mode=host`、当前会话 runtime 选项仅为 `local-pi`、`product_session_runtimes`/`product_session_inputs` 为空，以及进程树中的 Pi Runner，可判定本次成功链路为 **Host Runner → Pi coding runtime → Anthropic 兼容 Provider**。另一个名为 `test` 的 Dot 配置为 `execution_mode=container`，但因本机缺少 `helsome/miniclaw-agent:latest` 镜像而未成功启动，不能用 Host 对话结果替代其验收。

### 高级能力启用条件与入口

| 能力 | 实际开关/入口 | 当前状态 |
|---|---|---|
| 普通 Host 对话 | Host workspace 创建/打开会话；runtime 选项为 `local-pi` | 已验证 |
| Personal Goal | `/api/goals/availability?workspace_jid=web:main`；需 `MINICLAW_PERSONAL_GOALS=true` | `enabled=false`，NOT_RUN |
| 自动 Goal Durable 执行 | 还需 `MINICLAW_DURABLE_RUNTIME=true`、授权 Host workspace 和兼容模型 | NOT_RUN |
| Product Durable Runtime | 新建授权 Host 会话时需 `MINICLAW_DURABLE_RUNTIME=true`；Home 主会话还受 `MINICLAW_DURABLE_MAIN=true` 与既有回复条件约束 | 两个开关均未设置，runtime 表为空，NOT_RUN |
| MCP | Product session 的 MCP 配置/调用入口；实际 MCP 配置文件与 `product_mcp_calls` 均为空 | NOT_RUN |
| 审批 | MCP consent/call 或 Durable private-artifact approval 产生后进入审批入口 | `product_approvals` 为空，NOT_RUN |
| Cloud Durable / Handoff | 需 Cloud admission、gateway、secret、handoff/approval feature flags 及相应 capability | 相关环境变量均未设置，NOT_RUN |
| Container Runner | Container Dot 启动入口；需 Docker daemon 与 agent 镜像 | daemon 可用，但镜像缺失，BLOCKED |

未为了扩大通过范围而临时开启上述开关、创建虚假 Run、拉取未知镜像或修改源码。当前没有可恢复的 Product Durable Run，因此 Durable 重启恢复没有安全且真实的验证对象。

## 产品冒烟

| 检查项 | 状态 | 实际结果 |
|---|---|---|
| `npm start` | PASS | `dist/index.js` 正常启动，端口 3000 |
| Windows 访问首页 | PASS | `http://127.0.0.1:3000/` 返回 200，页面标题 OpenDot |
| 健康检查 | PASS | `/api/health` 返回 200；database=true、queue=true |
| 前端加载 | PASS | 浏览器真实加载，初始化后可进入 Home 对话页面 |
| 管理员初始化/登录 | PASS | 用户已完成本地管理员初始化并成功进入产品；报告不记录凭据 |
| Host Runner 产品链路 | PASS | 普通 Home 对话确认走 Host `local-pi`，真实 Runner 进程存在 |
| 模型 Provider / 真实回复 | PASS | `deepseek` / `deepseek-flash` 多轮真实响应成功，token usage 非零 |
| Tool Calling | PASS | 实际执行 10 次安全只读 `bash` 调用和 1 次 Workspace Memory 写入 |
| 多步工具调用 | PASS | 最长连续 7 个 tool-use 步骤后返回最终答案 |
| 会话持久化 | PASS | 刷新与页面往返后历史仍在，测试标识可在后续轮次取回；后端重启未验证 |
| Goal 创建与实际状态 | NOT_RUN | availability API 明确返回 `enabled=false`、`cloud_enabled=false` |
| MCP 审批 | NOT_RUN | 无 Product MCP 配置/调用，审批表为空；普通 Host 工具调用不等同于 MCP 审批 |
| Durable 重启恢复 | NOT_RUN | Durable 开关未设置且无 Product Run；普通对话成功不等同于 Durable 通过 |
| Docker Runner | BLOCKED | Docker daemon 与 `hello-world` 通过；Container Dot 因缺少 `helsome/miniclaw-agent:latest` 启动失败 |

首次验收阶段曾保存 `/setup` 页面截图并正常停止服务；续验时服务已重新启动并完成初始化后的真实产品检查。启动日志中的 `~/.claude/plugins/marketplaces` 不存在仅产生 importer warning，未阻断服务。

## 日志与截图

日志未加入 Git，保存在本机 Linux 工作区：

- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/logs/`
- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/environment-snapshot.txt`
- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/screenshots/setup.png`
- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/logs/real-model-smoke-safe.json`（仅非敏感元数据与事件计数）
- `/home/szz_user/projects/OpenDot-RetailOps/web/test-results/`（Playwright 失败截图、error context、trace）

关键日志包括 `make-typecheck.log`、`npm-build-all.log`、`npm-test-run.log`、`self-test-agent-runner.log`、`cloud-agent-build.log`、`test-cloud-authority.log`、`docs-check.log`、`web-e2e.log` 与 `npm-start.log`。

## 未解决问题与建议

- 单独修复脚本 executable bit，并在 Linux CI 校验，而不是在本任务工作区临时 chmod。
- 调查路由模块导入为 `undefined` 的测试隔离/Mock 顺序，保留最小复现，不删除断言。
- 对 Cloud Handoff 超时用例做可重复性测试和事件时间线分析；未证实前不简单归因于机器性能。
- 明确 Web E2E 哪些配置负责启动后端，避免 Vite 代理指向未启动的 3000 端口。
- 在独立任务中按产品设计开启并配置 Goal、MCP/审批或 Durable，再创建真实 Run 验证；不能用普通 Host 对话结果代替。
- 通过可信镜像仓库取得 `helsome/miniclaw-agent:latest`，或依据项目 `container` 目录构建同名镜像后，再复测 Container Dot；每个 Dot 不需要重复安装镜像，镜像在 Docker 主机上只需存在一次，但每个 Container Dot 会创建自己的隔离容器。
- 评估 `build:all` 改写受跟踪图标/manifest 是否为预期；若是生成步骤，应确保可重复且工作区干净，否则另开修复 PR。

## 最终结论

**PARTIAL**。

WSL2 Linux 开发环境满足复用要求，Node 24、GNU 工具链、Docker、Codex、VS Code Remote WSL、符号链接与 POSIX 权限均验证成功；Windows 原工作区未被破坏。项目构建成功且大量测试通过，真实 Host Runner 模型对话、Tool Calling、多步调用和刷新后会话持久化也已通过；但完整自动化并非绿灯，Container Dot 受镜像缺失阻塞，Goal、MCP/审批、Product Durable Runtime 与重启恢复没有达到启用和验证条件。因此 RETAIL-00A 仍为 **PARTIAL**，不能判定全部 Agent 能力通过。
