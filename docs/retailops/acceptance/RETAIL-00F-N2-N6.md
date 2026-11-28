# RETAIL-00F N2–N6 权限验证回执

## 结果概览

- 集成基线：`0f7c93173b8302d195681fbcd9b2babcf2896ba2`；N1 继续保持 PASS。
- 总体结论：**PARTIAL**。本轮已通过产品宿主入口完成 N2–N4 的合成 Provider 隔离验证；N5 全量回归仍有 8 个失败文件，均在基线 SHA 的对应定向运行中复现；真实模型和服务重启恢复仍未验证。
- Issue #7 保持 OPEN；PR 创建后同步为 REVIEW。不标 DONE，不解锁 #8、#16、#17、#18。
- 分支：`feat/retail-00f`。本轮源码验收 HEAD：`8e30401dd7936ecbd77714803e1fa7bcee9d861d`；文档提交后以 PR #96 回读的最新 HEAD 为准。PR 文件范围为 16 个契约内文件；未改依赖、lockfile、Dockerfile、数据库结构、原镜像、全局代理/安全配置或普通 Agent 默认权限。

## N0：范围与环境

- WSL2 Ubuntu 24.04；Node.js 24.22.3；npm 11.19.1；Docker Desktop daemon。
- 复用 N1 镜像 `retailops/miniclaw-agent:00f`，Manifest ID `sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`，linux/amd64；未重新构建或下载。
- 源码 worktree：`/home/szz_user/projects/OpenDot-RetailOps-00F-N2-N6`。产品宿主验证在独立 Linux worktree `/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL` 运行；该 worktree 使用独立 SQLite、HOME/XDG/Claude 配置和 `data/`，没有挂载原 Home 或主工作区数据。
- Pi SDK 锁定 `@earendil-works/pi-coding-agent@0.84.2`。实际核验了 `tools`、`excludeTools`、`noTools`、`customTools` 和 ResourceLoader 禁用开关。SDK 的 `AgentToolResult` 不含 `isError`；拒绝操作通过抛出脱敏异常回流为错误 tool result。
- 冻结并实际修改的 16 个文件：
  1. `container/agent-runner/src/runtime/types.ts`
  2. `container/agent-runner/src/runtime/pi/pi-runtime.ts`
  3. `container/agent-runner/src/runtime/pi/readonly-validation.ts`
  4. `container/agent-runner/src/pi-index.ts`
  5. `src/config.ts`
  6. `src/container-runner.ts`
  7. `src/readonly-validation-policy.ts`
  8. `src/task-scheduler.ts`
  9. `src/web.ts`
  10. `tests/retail-00f-readonly-runtime.test.ts`
  11. `tests/retail-00f-readonly-policy.test.ts`
  12. `docs/retailops/acceptance/fixtures/retail-00f/fixture-a.json`
  13. `docs/retailops/acceptance/fixtures/retail-00f/fixture-b.json`
  14. `docs/retailops/acceptance/fixtures/retail-00f/evidence-example.md`
  15. `docs/retailops/acceptance/RETAIL-00F-N2-N6.md`
  16. `docs/retailops/environment/RETAIL-00F-READONLY-RUNBOOK.md`
- 无范围外源码、断言、依赖或 lockfile 变更。

## N2：独立实例

状态：**PASS（合成模型的产品宿主路径）**。

从独立 worktree `/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL` 执行 `npm start`。宿主使用自己的 SQLite `data/db/messages.db`、HOME、XDG 和 Claude 配置目录。设置 `MINICLAW_WEB_BIND_LOOPBACK=true` 后，`ss` 只看到 `127.0.0.1:39475`；`GET /api/health` 和 `/` 均为 HTTP 200，首次本地管理员初始化为 201。`MINICLAW_WEB_BIND_LOOPBACK` 未设置时保留既有监听默认行为。

通过真实 `/api/groups`、`/api/tasks` 和 `/api/tasks/:id/run` 创建 container workspace 并启动 Host Runner → Docker → Pi SDK → 受控 Read 工具。任务记录均为 `execution_mode=container`、`context_mode=isolated`；对同一容器 workspace 提交 Host 模式任务得到 HTTP 400。合成 Provider 位于专用 Docker internal network，仅容器网络可达且无发布端口。未调用真实模型或真实 API 凭证。

容器实时 `docker inspect` 证据保存在本机忽略目录 `/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL/data/retailops/00f-validation/r1-host/logs/docker-live-inspect.jsonl`。三个任务容器均使用 N1 image ID `sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`，网络为专用 internal 网络，容器环境实际包含 `MINICLAW_RUNTIME_PERMISSION_MODE=readonly_validation`。fixtures、evidence、Live Source `src/` 与 `prompts/`、环境目录均为只读挂载；没有项目根目录、应用数据库、原 Home、插件或 MCP 配置挂载。唯一可写的 workspace、extra、IPC、Session 均位于独立 taskRun 路径。

两个正常任务均成功；产品 API 的重复触发返回同一 Run ID。第三个任务执行 Bash/Write 未注册工具负向探测。三次 Agent Session ID 不同，Session 与 `/workspace/ipc` 的宿主挂载源均包含对应 taskRunId。任务结束后专用容器自动消失，三个 `instances/task-run-<id>-attempt-1` 目录均不存在；专用 Provider 和 internal 网络随后按 N4 清理。服务重启后的 Session 恢复仍未验证。

Live Source 源码固定在 `8e30401dd7936ecbd77714803e1fa7bcee9d861d`。`container/agent-runner/src` 与 `prompts` 的文件清单 SHA-256：`596fa16337380701efa0bef16a91aa644fd0acd59fad50ea6f6e8208917084f7`。Host 工作区使用该提交构建的 dist；每个成功任务均经过 N1 entrypoint 的 Live Source 编译并进入 Agent 执行。

## N3：强制权限

状态：**PASS（合成 Provider 产品路径与 Pi 工具边界）**。

- 三个实际产品任务中，Provider 收到的活动工具 schema 每次都严格只有 `retailops_read_file`。两个正常任务各按 `fixture-a.json`、`fixture-b.json`、不存在的 evidence 文件、多步最终回答执行；第二次模型请求含前一工具结果，缺失文件错误回流后仍完成。
- 第三个任务令合成模型在未提供的 schema 外依次请求 `bash` 与 `write`，目标分别是 `/workspace/group/RETAIL00F_UNAUTHORIZED_BASH_SENTINEL` 和 `...WRITE_SENTINEL`。Pi SDK 收到工具结果后继续到最终轮；实时监视容器挂载源，全生命周期均未发现两个哨兵文件。Provider 记录 11 次请求，工具 schema 始终只有 `retailops_read_file`。该结果是确定性合成 Provider 验证，不代表真实模型测试。
- 定向测试 `tests/retail-00f-readonly-policy.test.ts`、`tests/retail-00f-readonly-runtime.test.ts`：2 个文件、13 项通过。覆盖活动工具定义缺失 Bash/Write/Edit/Agent/MCP、允许读取、缺失文件、路径穿越、绝对路径、Windows 路径、文件及父目录符号链接、父目录替换竞争、非普通文件及超限文件；普通模式仍具有 read/bash/write/edit 默认工具，无效受限配置拒绝启动。
- fixture 测试前后 SHA-256 相同，且 Docker inspect 显示 fixture/evidence bind 为 `rw=false`：

| 文件                | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| fixture-a.json      | `48fe0d820087ee0747cc8795f0d36355790b1f77224802e80319186172b97e6f` |
| fixture-b.json      | `39e5809bb7f079327dde42c0df4fad5c4269eeaa44afef8450bbfd4b63cde900` |
| evidence-example.md | `3a575ed844941af41fe1f4a1bf20d646bf2b2f004a487c34abe18af07f2db6bd` |

- 越权覆盖绝对路径、Windows 路径、路径穿越、文件及父目录符号链接、父目录切换竞争、非普通文件及超过 1 MiB 的文件。未产生 write/edit/bash 标记文件。
- 普通 Agent 模式仍包含 read/bash/write/edit；受限配置无效时拒绝启动，不回退到默认工具集。

## N4：销毁与复用

状态：**PASS（专用任务实例生命周期）**。

同一隔离宿主 group 连续创建两个正常任务和一个负向任务，分别使用独立 taskRunId、workspace、IPC 源路径及 Agent Session ID。三次 API 幂等重试都回到原 Run ID。每次任务完成后对应临时 `instances/task-run-<id>-attempt-1` 已移除，Docker Agent 容器也已自动移除；专用 Provider 容器随后删除，确认 internal 网络只剩 0 个端点后删除该网络。未运行 prune。minio、elasticsearch、vector_db、redis、portainer 等既有运行容器仍在运行。宿主应用 SQLite 保留在专用 worktree；服务重启恢复未验证。

## N5：测试与回归

状态：**PARTIAL**，未修改失败测试或断言。

| 命令                                                                                                   | 结果                                                                   | 退出码 |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | -----: |
| `npm test -- --run tests/retail-00f-readonly-policy.test.ts tests/retail-00f-readonly-runtime.test.ts` | 2 个文件、13 项通过                                                    |      0 |
| `npm run build:all`（源码 HEAD `8e30401`）                                                             | 后端、Web、Runner 构建通过；Web 有既有 chunk size 警告                 |      0 |
| `npm run typecheck`                                                                                    | 通过                                                                   |      0 |
| `npm test -- --run`（PR HEAD `8e30401`）                                                               | 3,837 通过、4 失败、44 跳过；文件 540 通过、8 失败、13 跳过；615.26 秒 |      1 |
| 七个文件的基线/PR 定向对照（五个 Hono 文件、浏览器锁、Pocket 文案）                                    | 基线与 PR 均为 5 项通过、2 项失败；7 个文件都失败且签名相同            |  1 / 1 |
| `npm test -- --run tests/brand-assets.test.ts`（基线及 PR HEAD 各一次）                                | 两边均 2 项失败；PNG/ICNS 像素摘要一致不匹配                           |  1 / 1 |
| `npm run self-test:agent-runner`                                                                       | Agent Runner 自检通过                                                  |      0 |
| `make typecheck`                                                                                       | 后端、Web E2E、Runner、共享类型检查通过                                |      0 |
| `npm run docs:check`                                                                                   | 291 份 Markdown 检查通过                                               |      0 |
| `git diff --check`                                                                                     | 通过                                                                   |      0 |

七文件对照日志保存在本机忽略目录 `/home/szz_user/projects/OpenDot-RetailOps-00F-N2-N6/data/retailops/00f-validation/retail00f-evidence-20261128/logs/r1-baseline-failure-comparison.log` 与 `r1-pr-failure-comparison.log`；PR 全量回归日志为同目录 `r1-full-suite-final.log`。逐项结果：

1. 五个 Hono 测试文件（cloud-goal-admission、routes-personal-goals、device-nodes、github-goals、routes-team-overview）导入时均在 `app.route` 报 `Cannot read properties of undefined (reading 'routes')`，未收集到测试用例；基线和 PR 定向运行均复现。
2. `tests/browser-target-policy.test.ts` 跨进程崩溃持锁用例在 150ms 观察窗内调用 `backend.observe`；基线和 PR 均复现。
3. `tests/pocket-features.test.ts` 通知文案断言期望“打开 Miniclaw 查看”，实际为“打开查看”；基线和 PR 均复现。
4. `tests/brand-assets.test.ts` 两个 PNG/ICNS 像素断言期望摘要 `ec44b2...`、实得 `45974f...`；基线和 PR 独立定向运行均复现。

上述失败签名均在基线 SHA `0f7c93173b8302d195681fbcd9b2babcf2896ba2` 的对应定向运行中重现，记录为已知基线失败，不在 #7 中扩大修复范围。完整套件只在 PR HEAD 运行一次，不将其整体结果冒充基线对照。未修改或跳过原测试断言。

## N6：交付

- 独立 PR：[PR #96](https://github.com/2Zest/OpenDot-RetailOps/pull/96)，目标 `develop/retailops`，关联 #7，当前 Open/Review；不自动合并。
- 产品宿主报告、Provider 请求记录、API 回执和实时 Docker inspect 保存在独立验证 worktree `/home/szz_user/projects/OpenDot-RetailOps-00F-R1-HOST-FINAL/data/retailops/00f-validation/r1-host/`；基线/PR 对照和全量回归日志保存在源码 worktree 忽略目录 `/home/szz_user/projects/OpenDot-RetailOps-00F-N2-N6/data/retailops/00f-validation/retail00f-evidence-20261128/logs/`。原始运行日志仅在本机，不提交。
- 仅提交本回执、隔离运行手册及非敏感 fixture；凭证与真实用户数据未加入工作树。
- 结论保持 PARTIAL，等待主控 Review。PR 合并前 #7 保持 OPEN，不标 DONE，不解锁下游任务。
