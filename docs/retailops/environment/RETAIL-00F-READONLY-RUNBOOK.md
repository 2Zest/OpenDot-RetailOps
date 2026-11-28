# RETAIL-00F 只读验证实例运行手册

## 使用边界

此模式仅用于 Issue #7 的隔离验收。普通宿主不设置 `MINICLAW_HOST_PERMISSION_MODE`，保留原 Agent 行为。权限模式由可信宿主进程决定，Prompt、模型输出及工具参数不能切换模式。使用 N1 已核验的 `retailops/miniclaw-agent:00f`，不重新构建或拉取镜像，不修改 Docker 全局设置。

## 隔离宿主

从独立 Linux worktree 启动服务，使其工作目录下的 `data/`、SQLite、groups、会话、HOME、XDG 和 Claude 配置与日常工作区分开。源码没有 `MINICLAW_DATA_DIR` 选项；不要从原工作区启动验收服务，也不要挂载原 Home、原项目根目录或应用数据库到 Runner。

本轮宿主 worktree：`/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL`。非敏感输入位于 `data/retailops/00f-validation/fixtures/` 与 `data/retailops/00f-validation/evidence/`；每个产品任务以独立 `taskRunId` 创建 `instances/task-run-<taskRunId>-attempt-<n>/` 下的 workspace、extra、env 和临时运行目录。Session 位于宿主 `data/sessions/<group>/agents/`，IPC 位于 `data/ipc/<group>/tasks-run/`，各自实例路径绑定对应 taskRunId。Provider 环境文件由宿主以 0600 权限创建；不记录其内容或凭证。

本轮宿主启动配置：

```bash
MINICLAW_HOST_PERMISSION_MODE=readonly_validation
MINICLAW_CONTAINER_LIVE_SOURCE=true
MINICLAW_CONTAINER_IMAGE=retailops/miniclaw-agent:00f
MINICLAW_READONLY_VALIDATION_NETWORK=retail00f-r1-20261128
MINICLAW_WEB_BIND_LOOPBACK=true
WEB_PORT=39475
```

`MINICLAW_WEB_BIND_LOOPBACK=true` 使服务绑定 `127.0.0.1`；本轮 `ss` 只观察到 `127.0.0.1:39475`。未设置该变量时保留普通服务原有监听默认行为。仅设专用端口不足以形成隔离；健康检查、初始化及任务 API 均通过 loopback 本地访问。不要开放公网端口或关闭防火墙。

只读模式要求专用 Docker internal 网络。验收进程创建唯一命名的 internal 网络，并在启动前用 `docker network inspect` 确认 `Internal=true`。合成 Provider 只连接该网络，不发布宿主端口；Runner 不连接默认 bridge 或其他业务网络。不得复用其他任务的网络。

## 实际产品路径与容器边界

本轮通过产品 API 创建 group、配置合成 Provider、提交 container task 并调用 task run API。受限 group 使用 `execution_mode=container`、`context_mode=isolated`；同一 workspace 的 Host Execution 请求返回 HTTP 400。健康检查与首页返回 HTTP 200，独立数据库的首次管理员初始化返回 HTTP 201。Provider 是本地确定性 Anthropic SSE 合成服务，不是真实模型或真实凭证。

宿主可信权限模式最终传递为 Runner 环境 `MINICLAW_RUNTIME_PERMISSION_MODE=readonly_validation`。Runner 活动工具严格只有 `retailops_read_file`，不注册 Bash、Write、Edit、Agent、MCP 或扩展发现能力。产品任务容器使用 N1 Image ID `sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`，不发布容器端口。

实时 `docker inspect` 核实的挂载：

- 只读：Agent Runner `src/`、`prompts/`、`/retailops/fixtures`、`/retailops/evidence`、`/workspace/env-dir`。
- 每个 taskRunId 独立可写：`/workspace/group`、`/workspace/extra`、`/workspace/ipc`、`/home/node/.claude`。内容限定为本次运行的临时 workspace、IPC 和 Session；任务结束后对应 `instances/task-run-...` 和 Agent 容器清理。
- 不挂载宿主项目根目录、SQLite、原 Home、用户插件或 MCP 配置。fixture/evidence bind 的 `rw` 必须为 `false`。

Live Source 固定在源码提交 `8e30401dd7936ecbd77714803e1fa7bcee9d861d`。Agent Runner `src/` 与 `prompts/` 文件清单 SHA-256 为 `596fa16337380701efa0bef16a91aa644fd0acd59fad50ea6f6e8208917084f7`。这是 N1 镜像加载该验证源码的产品宿主验收证据，不代表重新构建或发布镜像。

## 验证步骤

1. 记录 N1 Image ID、宿主 worktree HEAD、Node/npm/Docker 版本和独立 `data/` 路径；确认 HTTP 只监听 loopback、专用网络 `Internal=true` 且无无关端点。
2. 计算专用 fixtures/evidence SHA-256。通过本地 API 完成管理员初始化、Provider/group 配置和 container task 执行；对同一个受限 workspace 请求 Host 模式，要求被拒绝。
3. 保存 API 响应、脱敏 Provider 请求日志和任务容器存活期间的 `docker inspect`。核对 image、运行模式环境、网络和每个挂载的源/目标/`rw` 标志。
4. 检查 Provider 每个请求的活动工具 schema 只有 `retailops_read_file`；执行允许读取、缺失文件错误回流、多步对话以及未注册 Bash/Write 请求。用独立监视器观察写入哨兵，不能只看模型最终回复。
5. 对照 taskRunId、Pi Session ID、Session 源目录和 IPC 源目录，确认一一对应；重复触发 API 必须返回同一 Run ID。
6. 任务结束后确认专用 Agent 容器与运行目录消失；删除 Provider 前确认网络端点只属于本次任务，端点清零后删除网络。重新计算 fixture SHA-256，确认其他容器仍运行。
7. 服务重启恢复必须单独隔离验证；没有实际执行前记录 NOT_RUN。合成 Provider 验证不能描述为真实模型验收。

## 本轮证据位置

原始日志和报告仅存于本机忽略目录，未纳入 Git：

- 宿主验证：`/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL/data/retailops/00f-validation/r1-host/`
- 全量回归和基线对照：`/home/szz_user/projects/OpenDot-RetailOps-00F-N2-N6/data/retailops/00f-validation/retail00f-evidence-20261128/logs/`

## 清理与复用

仅停止本轮记录的准确容器、宿主 PID 和 internal 网络。删除网络前确认无端点；不得运行 Docker prune、停止其他容器或清理日常工作区/旧运行数据。保留报告、fixture 摘要和脱敏日志。复用镜像时创建新的 taskRunId、Session、IPC 和 workspace。

本轮宿主服务、合成 Provider、专用任务容器和网络已停止或清除；N1 镜像保留。本轮结束时端口 `39475` 无监听，既有无关容器未受影响。

## 未验证能力

本轮 Provider 是合成服务，不是实际模型调用；真实模型多步工具行为留待 #8 验收。服务重启后的 SQLite/Session 恢复、Product Durable checkpoint 恢复和真实模型对话均未验证。总验收仍为 PARTIAL。
