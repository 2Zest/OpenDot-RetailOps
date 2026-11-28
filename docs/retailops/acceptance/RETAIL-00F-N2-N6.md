# RETAIL-00F N2–N6 权限验证回执

## 结果概览

- 集成基线：`0f7c93173b8302d195681fbcd9b2babcf2896ba2`；N1 继续保持 PASS。
- 总体结论：**PARTIAL**。N3、N4 的 Agent Runner 隔离验证通过；N2 容器隔离通过，但宿主 API/独立 SQLite 未启动；N5 全量回归有失败；N6 提交 PR 后等待 Review。
- Issue #7 保持 OPEN；PR 创建后同步为 REVIEW。不标 DONE，不解锁 #8、#16、#17、#18。
- 分支：`feat/retail-00f`。仅改本回执列出的 13 个文件；未改依赖、lockfile、Dockerfile、数据库结构、原镜像、全局代理/安全配置或普通 Agent 默认权限。

## N0：范围与环境

- WSL2 Ubuntu 24.04；Node.js 24.22.3；npm 11.19.1；Docker Desktop daemon。
- 复用 N1 镜像 `retailops/miniclaw-agent:00f`，Manifest ID `sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`，linux/amd64；未重新构建或下载。
- worktree：`/home/szz_user/projects/OpenDot-RetailOps-00F-N2-N6`。专用数据位于 `data/retailops/00f-validation/retail00f-evidence-20261128/`。
- Pi SDK 锁定 `@earendil-works/pi-coding-agent@0.84.2`。实际核验了 `tools`、`excludeTools`、`noTools`、`customTools` 和 ResourceLoader 禁用开关。SDK 的 `AgentToolResult` 不含 `isError`；拒绝操作通过抛出脱敏异常回流为错误 tool result。
- 冻结文件：agent-runner 的 runtime types、Pi adapter、Pi entry 和新增受控 Read 工具；宿主容器挂载策略和新只读策略模块；两份定向测试；本回执、运行手册及三个非敏感 fixture。无范围外源码、断言、依赖或 lockfile 变更。

## N2：独立实例

状态：**PARTIAL**。

Runner 容器级验证通过：使用专用 task id `retail00f-evidence-20261128`、容器身份、内部测试网络、工作目录、Session、IPC、extra、日志目录。fixture/evidence 和 Live Source 的 `src/`、`prompts/` 只读挂载；可写目录位于本次独立实例。容器无发布端口，无项目根目录、原组工作区、用户 Home、插件、MCP 配置或应用数据库挂载。容器退出码 0；entrypoint 对挂载源码完成 TypeScript 编译。源码与 prompts SHA-256：`596fa16337380701efa0bef16a91aa644fd0acd59fad50ea6f6e8208917084f7`。

使用内部网络上的合成 Anthropic SSE Provider 驱动工具循环；没有调用真实模型或真实凭证。

宿主 API 未启动，因此产品端口、登录、独立 SQLite 及 HTTP 到 Runner 的产品调用链未验证。当前 `startWebServer` 未显式绑定 loopback；为避免额外端口暴露，本轮没有启动宿主 API。不能把容器级隔离描述成产品服务级端到端通过。

## N3：强制权限

状态：**PASS（Agent Runner 边界）**。

- Pi SDK 每轮活动工具集合严格为 `["retailops_read_file"]`。
- 调用顺序：读取 fixture A、fixture B、evidence；读取缺失文件；尝试路径穿越；尝试未注册 Bash、Write、Edit、Agent、MCP。三项授权读取成功；缺失文件返回 `READ_NOT_FOUND`；越权路径返回 `READ_DENIED`；未注册能力均拒绝且错误回流。
- 合成 Provider 记录 11 次请求，包含 10 个 tool result、7 个 tool error。此证据验证 Runner 的工具调用/错误回流，不代表真实模型测试。
- fixture 测试前后 SHA-256 相同，仓库文件与只读挂载副本摘要一致：

| 文件 | SHA-256 |
| --- | --- |
| fixture-a.json | `48fe0d820087ee0747cc8795f0d36355790b1f77224802e80319186172b97e6f` |
| fixture-b.json | `39e5809bb7f079327dde42c0df4fad5c4269eeaa44afef8450bbfd4b63cde900` |
| evidence-example.md | `3a575ed844941af41fe1f4a1bf20d646bf2b2f004a487c34abe18af07f2db6bd` |

- 越权覆盖绝对路径、Windows 路径、路径穿越、文件及父目录符号链接、父目录切换竞争、非普通文件及超过 1 MiB 的文件。未产生 write/edit/bash 标记文件。
- 普通 Agent 模式仍包含 read/bash/write/edit；受限配置无效时拒绝启动，不回退到默认工具集。

## N4：销毁与复用

状态：**PASS（容器与 Session 生命周期）**。

同一 N1 image ID 多次用于新容器；各次使用不同 task 根目录和 Pi Session JSONL。专用容器及内部网络停止、删除后查询确认不存在，未运行 prune。五个无关容器（minio、elasticsearch、vector_db、redis、portainer）仍保持运行。宿主应用数据库清理及重启恢复未验证。

## N5：测试与回归

状态：**PARTIAL**，没有修改失败测试或断言。

| 命令 | 结果 | 退出码 |
| --- | --- | ---: |
| 只读权限及宿主/Runner 定向测试，10 个文件 | 10 文件通过；84 通过、30 按既有配置跳过 | 0 |
| `npm run self-test:agent-runner` | 自检通过 | 0 |
| `npm run build:all` | 后端、Web、Runner 构建通过；Web 有 chunk size 警告 | 0 |
| `npm run typecheck` | 通过 | 0 |
| `make typecheck` | 后端、Web E2E、Runner、共享类型检查通过 | 0 |
| `npm run docs:check` | 291 份 Markdown 检查通过 | 0 |
| `git diff --check` | 通过 | 0 |
| `npm test -- --run` | 3,836 通过、2 失败、44 跳过；文件 541 通过、7 失败、13 跳过 | 1 |

全量失败用例单独复核仍失败：

1. 五个文件导入 `src/web.ts` 时在 Hono `app.route` 报 `Cannot read properties of undefined (reading 'routes')`：cloud-goal-admission、routes-personal-goals、device-nodes、github-goals、routes-team-overview。
2. `tests/browser-target-policy.test.ts` 的跨进程崩溃持锁用例在 150ms 观察窗内调用 backend.observe；单独重跑仍失败。
3. `tests/pocket-features.test.ts` 的通知文案断言失败；直接 Node 子测试为 40 通过、1 失败，期望“打开 Miniclaw 查看”，实际“打开查看”。

失败栈在未改动的 `src/web.ts`、浏览器锁和通知文案相关路径。本轮未在基线提交上单独重跑，故不宣称已证明为基线问题。它们不是只读权限测试的通过证据。

## N6：交付

- 原始隔离日志保存在本地忽略目录 `data/retailops/00f-validation/retail00f-evidence-20261128/logs/`，包含 agent、合成 Provider、全量测试、自检及构建日志；不提交原始运行日志。
- 仅提交本回执、隔离运行手册及非敏感 fixture；凭证与真实用户数据未加入工作树。
- 结论保持 PARTIAL，等待主控 Review。PR 合并前 #7 保持 OPEN，不标 DONE，不解锁下游任务。
