# RETAIL-00F 只读验证实例运行手册

## 使用边界

此模式只用于 Issue #7 专用验证。普通宿主不设置权限模式，保留原 Agent 行为。模式由宿主进程决定，不能由 Prompt、模型输出或工具参数切换。只使用 N1 已核验的 `retailops/miniclaw-agent:00f`；不重新构建或拉取镜像，不修改 Docker 全局设置。

## 独立工作区与状态目录

当前 `DATA_DIR` 固定为进程工作目录下的 `data/`，源码未提供 `MINICLAW_DATA_DIR` 配置。必须从独立 Linux worktree 启动，才能隔离宿主 SQLite、groups、配置及会话文件；不得在用户现有工作区或原 Home 工作区启动验证模式。

每次运行使用新 taskRunId，只在 `data/retailops/00f-validation/<taskRunId>/` 放置非敏感 `fixtures/` 和 `evidence/`。宿主为调用创建隔离的 `instance/workspace`、`instance/session`、`instance/ipc`、`instance/extra` 和权限为 0600 的临时 Provider env 文件。fixture/evidence 只读挂载；写目录分开。

独立宿主的环境变量为：

```bash
MINICLAW_HOST_PERMISSION_MODE=readonly_validation
MINICLAW_CONTAINER_LIVE_SOURCE=true
MINICLAW_CONTAINER_IMAGE=retailops/miniclaw-agent:00f
WEB_PORT=39475
```

`WEB_PORT` 是服务实际读取的端口。设置端口与模式变量本身不构成网络隔离。`startWebServer` 当前没有显式绑定 loopback，因此执行服务级验证前，必须先确保该端口只对预期本机调用者可达；不要为此关闭防火墙或更改全局配置。本轮未启动宿主 API，也未打开端口。

## Live Source

宿主以只读方式挂载当前验证 worktree 的 Agent Runner `src/` 与 `prompts/`；原镜像 entrypoint 在启动时编译这些挂载内容。本轮挂载源码和 prompts 摘要：`596fa16337380701efa0bef16a91aa644fd0acd59fad50ea6f6e8208917084f7`。这只证明该验证源码在 N1 镜像内编译并运行，不更改 N1 镜像来源或发布验收结论。

## 验证清单

1. 核实镜像 ID 与 N1 一致，容器无发布端口。
2. 核实 fixture/evidence、源码、prompts 挂载为只读；工作目录、Session、IPC、extra 位于本 taskRunId。
3. 确认没有挂载项目根目录、原 Home、原组工作区、应用数据库、用户插件或 MCP 配置。
4. 在运行前后计算 fixture SHA-256，摘要变化即失败。
5. 在真实 Pi SDK Session 核实活动工具只有 `retailops_read_file`，并执行允许读、缺失、穿越、符号链接和未注册工具用例。
6. 拒绝必须由注册表和执行边界产生；Prompt 自律不算权限控制。
7. 不记录 API Key、Token、真实用户或私人文件。

## 停止、清理及复用

只停止本轮准确记录的容器名和内部网络；不得运行 Docker prune。确认本轮容器和网络已不存在，保留回执、fixture 摘要和必要脱敏日志。

复用镜像时创建新的 taskRunId、Session、IPC 和工作目录。只有确认专用目录不含其他任务数据后，才清理本目录。

## 本轮验证边界

本轮使用 internal Docker network 和未发布端口的 Runner 容器，Provider 是本地合成 Anthropic SSE 服务，不是真实模型，也未使用真实 API 凭证。产品宿主 API、登录、独立 SQLite 和宿主到 Runner 的产品调用链没有启动；服务级 Session 恢复亦未验证。
