# RETAIL-00A Linux 基线验收报告

验收日期：2026-11-25；环境：Ubuntu 24.04.1 LTS / WSL2；结论：**PARTIAL**。

Linux 环境搭建成功，但项目完整运行验收未全部通过。自动化测试存在仓库权限位、模块导入、长时 Cloud Handoff 和 Web E2E 问题；产品首次初始化因缺少用户指定的本地管理员凭据而停止在 `/setup`，真实模型链路未验证。

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
| `npm run docs:check` | 0 | 128 Markdown files | PASS |
| `npm --prefix web run test:e2e` | 1 | 44 / 14 / 2 | FAIL，409s |

### 失败证据分类

1. **仓库配置问题**：`scripts/sync-stream-event.sh` 由 Git 记录为 `100644`，但 Makefile 第 192 行以可执行文件调用，真实 Linux 上失败。未用 `chmod` 或修改 Makefile 绕过。
2. **单测/模块导入问题**：五个 suite 在 `src/web.ts` 注册路由时收到 `undefined`，Hono 读取 `.routes` 抛出 TypeError；涉及 goal、team overview、GitHub goals、device nodes 等测试。`tests/pocket-features.test.ts` 的 Node 子进程另有一项失败。
3. **Cloud 稳定性问题**：Cloudflare Durable→Cloudflare Durable 资源冲突恢复用例等待 Isolated Bot Handoff 断言 60 秒超时；同一矩阵其余三个组合通过。
4. **E2E/服务编排与 UI 问题**：14 项失败、2 项跳过。日志包含 Vite 代理连接 `127.0.0.1:3000` 被拒绝、移动端元素未出现和 150 秒 convergence 超时。Playwright 已生成失败截图与 trace。
5. **构建副作用**：`npm run build:all` 在全新 Linux clone 中改写 11 个图标与 `web/public/manifest.webmanifest`。这些文件不属于本次提交，也未清除。

## 产品冒烟

| 检查项 | 状态 | 实际结果 |
|---|---|---|
| `npm start` | PASS | `dist/index.js` 正常启动，端口 3000 |
| Windows 访问首页 | PASS | `http://127.0.0.1:3000/` 返回 200，页面标题 OpenDot |
| 健康检查 | PASS | `/api/health` 返回 200；database=true、queue=true |
| 前端加载 | PASS | 浏览器真实加载并重定向 `/setup`，显示管理员初始化页面 |
| 管理员初始化/登录 | BLOCKED | 未提供用户指定的本地管理员用户名/密码；未自行生成或保存凭据 |
| Host Runner 产品链路 | NOT_RUN | 登录前置未满足；独立 Agent Runner 自检通过不能替代产品链路 |
| 模型 Provider / 真实回复 | BLOCKED | 未配置或读取任何模型凭证；没有把模拟模型结果描述为真实模型 |
| 会话持久化 | NOT_RUN | 登录与真实模型前置未满足 |
| Goal 创建与实际状态 | NOT_RUN | 登录前置未满足 |
| MCP 审批 | NOT_RUN | 产品初始化未完成 |
| Durable 重启恢复 | NOT_RUN | 未创建真实产品 Run；自动化覆盖不替代产品冒烟 |
| Docker Runner | PARTIAL | Docker daemon 与 `hello-world` 通过；应用内 Docker Runner 未在未初始化账号下执行 |

服务停止前已保存 `/setup` 页面截图，随后使用 `Ctrl+C` 正常终止。启动日志中的 `~/.claude/plugins/marketplaces` 不存在仅产生 importer warning，服务继续运行。

## 日志与截图

日志未加入 Git，保存在本机 Linux 工作区：

- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/logs/`
- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/environment-snapshot.txt`
- `/home/szz_user/projects/OpenDot-RetailOps/.retailops-validation/screenshots/setup.png`
- `/home/szz_user/projects/OpenDot-RetailOps/web/test-results/`（Playwright 失败截图、error context、trace）

关键日志包括 `make-typecheck.log`、`npm-build-all.log`、`npm-test-run.log`、`self-test-agent-runner.log`、`cloud-agent-build.log`、`test-cloud-authority.log`、`docs-check.log`、`web-e2e.log` 与 `npm-start.log`。

## 未解决问题与建议

- 单独修复脚本 executable bit，并在 Linux CI 校验，而不是在本任务工作区临时 chmod。
- 调查路由模块导入为 `undefined` 的测试隔离/Mock 顺序，保留最小复现，不删除断言。
- 对 Cloud Handoff 超时用例做可重复性测试和事件时间线分析；未证实前不简单归因于机器性能。
- 明确 Web E2E 哪些配置负责启动后端，避免 Vite 代理指向未启动的 3000 端口。
- 由用户创建本地管理员并自行录入 Provider 凭证后，再补做真实模型、会话持久化、Goal、审批、Durable 与应用内 Docker Runner 冒烟。
- 评估 `build:all` 改写受跟踪图标/manifest 是否为预期；若是生成步骤，应确保可重复且工作区干净，否则另开修复 PR。

## 最终结论

**PARTIAL**。

WSL2 Linux 开发环境满足复用要求，Node 24、GNU 工具链、Docker、Codex、VS Code Remote WSL、符号链接与 POSIX 权限均验证成功；Windows 原工作区未被破坏。项目构建成功且大量测试通过，但完整自动化并非绿灯，真实产品初始化和模型链路仍受凭据前置阻塞。因此不能判定 RETAIL-00A 项目完整运行成功。
