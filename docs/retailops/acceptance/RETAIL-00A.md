# RETAIL-00A 本地可运行基线验收报告

验收日期：2026-11-25（Asia/Shanghai）

最终结论：**BLOCKED**

原项目可以在本机完成依赖安装、类型检查、全量构建、Cloud Worker dry-run 构建、Agent Runner 自测、后端启动、健康检查、前端加载、已有管理员登录、会话持久化及 Goal 创建/重启恢复。但完整测试套件在 Windows 的符号链接、POSIX 权限、路径与进程信号语义上大量失败；Host Runner 也在同步 `.claude`/Skills 时被 Windows `EPERM` 阻断。当前没有模型 Provider 配置或常见 API Key，Docker daemon 未启动，因此真实模型回复、审批执行与完整 Durable Runtime 恢复不能验收通过。

## 1. Git 基线与任务边界

- 仓库：`2Zest/OpenDot-RetailOps`（本地 `origin` 仍配置为旧地址 `https://github.com/2Zest/OpenDot.git`，GitHub 自动重定向到新仓库）
- 当前分支：`feat/retail-00a-baseline`
- Base 分支：`develop/retailops`
- 验收前 HEAD：`0db0ba1bbf658d217f248bf29b5715bcbf09ccac`
- 固定基线：`main` / `0db0ba1bbf658d217f248bf29b5715bcbf09ccac`
- 开始时已有未提交改动：11 个 PNG/ICNS 图标文件、`web/public/manifest.webmanifest`，以及未跟踪的 `docs/retailops/`。
- 本任务未清除上述改动，未修改 `main`，未修改业务源码，未升级依赖，未删除或改写 lockfile。
- 三份 RetailOps 前置文档在本机存在，但开始时均为未跟踪文件，不属于 Git 基线：`RETAILOPS-ARCHITECTURE.md`、`RETAILOPS-BASELINE.md`、`RETAILOPS-ROADMAP.md`。

注意：`npm run build:all` 的 Web `prebuild` 会执行 `generate-icons`，规定的构建命令因此重新写过原本已修改的图标资源。它们仍未被暂存或提交，但这是对既有未提交文件的构建副作用，后续应由原改动所有者核对图像内容。

## 2. 前置阅读

已阅读：

- `README.md`
- `CLAUDE.md`
- `package.json`
- `Makefile`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `docs/retailops/` 下现有三份本地工程文档

CI 当前仅支持 `workflow_dispatch`；文件注释显示自动 CI 自 2026-10-25 起因 Actions 分钟耗尽而暂停。

## 3. 环境收据

| 项目 | 实际值 | 判定 |
| --- | --- | --- |
| 操作系统 | Microsoft Windows 10 家庭中文版 10.0.19045，64 位 | 已记录 |
| Node.js | `v26.13.0` | 满足最低 22.19；不是推荐的 24 LTS |
| npm | `11.20.0` | 可用；安装时出现 `allowScripts` 覆盖警告 |
| Git | `2.45.1.windows.1` | 可用 |
| Docker CLI | `28.5.1` | 可用 |
| Docker daemon | 无法连接 `dockerDesktopLinuxEngine` named pipe | BLOCKED |
| GNU Make | 命令不存在 | NOT_RUN |
| 初始端口 | 3000、5173、9222 均未监听 | PASS |
| 验收后端口 | 服务已停止；3000、5173、9222 均未监听 | PASS |

## 4. 依赖安装

四个安装命令均基于已提交 lockfile，退出码均为 0。

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm ci` | 0 | PASS；新增 798 个依赖包 |
| `npm --prefix web ci` | 0 | PASS；新增 678 个依赖包 |
| `npm --prefix container/agent-runner ci` | 0 | PASS；新增 242 个依赖包 |
| `npm --prefix apps/cloud-agent ci` | 0 | PASS；新增 327 个依赖包 |

npm 11 报告若干安装脚本尚未被 `allowScripts` 覆盖，包括 `better-sqlite3`、`electron`、`esbuild`、`node-pty`、`agent-browser`、`workerd` 等。未修改配置绕过该策略。

安装后 `git diff --quiet` 对四个 lockfile 返回 0，说明 lockfile 未发生 Git 差异。SHA-256：

- 根目录：`335B44BE71B5FF3BE2A995CD04D8B321EDCC105945E13454D19AA76053F60886`
- Web：`37419A0B20FCCDD799064031B2BA1FA12F7B607A9C1104F7E76FDA13F7484F10`
- Agent Runner：`AA7F71ED5AAA94621CBFBC2A75A18741F917BCFCEEB1788A2CD691D0A34DCDB2`
- Cloud Agent：`69B2363EDA7069066451DC312E4CD7DA18F8A3581CDF8E480ED8A80F3AAEA2BB`

## 5. 编译与测试结果

| 命令 | 退出码 | 通过 | 失败 | 跳过 | 结果与证据摘要 |
| --- | ---: | ---: | ---: | ---: | --- |
| `npm run typecheck` | 0 | N/A | 0 | 0 | PASS；Backend 与 Personal Agent TypeScript 检查通过 |
| `npm run build:all` | 0 | 3 个子构建 | 0 | 0 | PASS；Backend、Web、Agent Runner 均构建成功；Vite 有大 chunk 警告 |
| `npm test -- --run` | 1 | 3432 tests / 404 files | 226 tests / 124 files | 44 tests / 13 files | FAIL；另有 2 个 unhandled errors；总计 3702 tests，耗时 289.70s |
| `npm run self-test:agent-runner` | 0 | 1 | 0 | 0 | PASS；stale background-task wait reply 自测通过 |
| `npm --prefix apps/cloud-agent run build` | 0 | 1 | 0 | 0 | PASS；Wrangler dry-run bundle 成功，未部署 |
| `npm run test:cloud-authority` | 1 | 3 tests / 3 files | 131 tests / 21 files | 0 | FAIL；总计 134 tests，耗时 117.47s |
| `make typecheck` | N/A | N/A | N/A | N/A | NOT_RUN；GNU Make 不可用 |

### 5.1 主要失败簇

1. Windows 当前进程无创建符号链接权限，大量测试在 `fs.symlinkSync` 处返回 `EPERM`；Cloud Authority 的 Group/Durable HTTP fixture 同样被阻断。
2. 多个安全/迁移测试断言 POSIX `0600`/`0700` 权限，Windows 返回不同 mode 位。
3. 少量测试假定 POSIX 路径分隔符、信号和进程树行为，在 Windows 上不成立。
4. Vitest 另出现若干路由 mock 装配错误，例如被 mock 的 route 对象为 `undefined`；需在目标 Linux/Node 24 环境复测后判断是否为独立问题。
5. Cloud Goal 集成测试有 1 个非符号链接表象的授权时序失败：`Goal has no current authorized Scheduler claim`；当前 Windows 运行噪声下未修改源码定位。

未删除测试、未修改断言、未伪造通过结果。

## 6. 产品冒烟测试

启动命令：`npm start`。为验证可选 Goal 页面，另两次仅在进程内设置 `MINICLAW_PERSONAL_GOALS=true` 后执行 `npm start`；未写入 `.env`、系统环境或源码。服务均由 Ctrl+C 停止，因此停止进程的 shell 退出码为 1，不代表启动失败。

| 验收项 | 状态 | 实际结果 |
| --- | --- | --- |
| 后端启动 | PASS | 数据库初始化、Scheduler、IPC watcher 与 Web server 均启动，监听 3000 |
| `GET /api/health` | PASS | HTTP 200；`status=healthy`，database/queue 均为 true |
| 前端页面 | PASS | `GET /` HTTP 200；Chrome 实际加载 OpenDot 工作台 |
| 用户初始化/登录 | PASS（已有状态） | 复用本机已有 `admin` 管理员会话；未新建用户或改密码 |
| 模型 Provider | BLOCKED | UI 显示 `0 个模型配置`；常见 Provider API Key 环境变量均不存在，根目录无 `.env` |
| 创建/打开 Dot 会话 | PASS | 已打开现有 Miniclaw / `admin Home` 会话 |
| 发送消息并获得真实模型回复 | BLOCKED | 已发送 `RETAIL-00A baseline smoke: reply with exactly OK`；UI 返回“执行进程异常退出”，没有真实模型回复 |
| 刷新后历史会话存在 | PASS | 刷新后测试消息与失败回执仍存在 |
| 创建 Goal 并检查状态 | PASS（持久化层） | 创建 `RETAIL-00A 本地基线验收`；状态“待开始”，执行预算 `0/10`，服务重启后仍存在 |
| 审批 | NOT_RUN | 无可到达模型/工具执行链路，不制造 Mock 审批结果 |
| Durable Runtime 实际执行 | BLOCKED | Host Runner 在推理前被 Windows symlink `EPERM` 阻断 |
| 重启恢复 | PARTIAL | 会话消息与 Goal 在服务重启后恢复；未验证进行中模型/工具调用的 Durable 恢复 |
| Docker 容器模式 | NOT_RUN | Docker daemon 未启动；当前已有工作区为 Host 模式 |

### 6.1 Host Runner 阻塞证据

消息处理进入 `runHostAgent` 后出现：

```text
EPERM: operation not permitted, symlink
C:\Users\Administrator\.claude\skills\od-update
-> data\sessions\main\.claude\.skills-staging-*\od-update
```

`.claude.json` 链接创建也返回 `EPERM`。应用进行了有界退避重试，UI 因而保存了多条失败回执；请求没有到达真实模型 Provider。

## 7. 已知问题与未验证能力

- Windows 家庭版当前进程不具备测试与 Host Runner 所需的符号链接能力；不应在本任务中修改系统安全设置。
- 建议在 Ubuntu 24.04 或 WSL2/Linux、Node 24 LTS、GNU Make 可用的环境复跑 CI 同款命令。
- Docker daemon 未启动，容器执行、容器镜像与容器重启恢复未验证。
- 没有 Provider 凭证，真实模型、真实工具调用、模型用量与回复质量未验证。
- 审批、进行中 Durable checkpoint、崩溃后继续执行、云端部署、真实移动端均未验证。
- `npm run build:all` 的 `generate-icons` 会触碰已有未提交图标；提交前必须排除并由原改动所有者复核。
- 三份前置 RetailOps 文档在开始时未被 Git 跟踪，本提交不擅自接管它们。

## 8. 日志与截图位置

- 结构化结果与关键错误摘录：本报告。
- 原始命令输出与浏览器可访问性快照：本次 Codex 任务执行记录；未另行提交包含本机路径或潜在运行数据的完整原始日志。
- 持久化截图：未生成。浏览器验收通过实时 UI/可访问性状态完成，避免把本机账号或会话内容写入仓库。

## 9. 后续建议

1. 在 Node 24 LTS + Ubuntu 24.04/WSL2 环境安装 GNU Make，按 `.github/workflows/ci.yml` 原样复跑四个 `npm ci`、`make typecheck`、完整 Vitest、Cloud Authority 与 Web E2E。
2. 单独解决或明确支持 Windows symlink/ACL 语义；不要在 RETAIL-00A 文档 PR 中直接扩大为通用 Runtime 修复。
3. 启动 Docker daemon 后验证容器 Runner 与镜像；仍需保持 Host/Container 结果分开记录。
4. 由用户安全配置一个可用 Provider 后重新执行真实模型消息、审批、Durable checkpoint 与重启恢复，避免在文档、终端或截图中暴露 API Key。
5. 对 `generate-icons` 的工作区副作用建立独立 Issue，避免验收构建覆盖开发者未提交的品牌资源。

## 10. 验收结论

**BLOCKED**：静态构建和基础 Web 产品面可运行，但强制测试门槛未全绿，真实模型闭环与 Host Runner 被 Windows symlink 权限阻断，Docker/审批/完整 Durable 能力未验证。本结论不阻止提交这份事实性验收文档，但在问题解决并复测前，不应把该基线标记为可全面运行。
