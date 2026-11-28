# RETAIL-00F N1 镜像准备节点验收回执

## 基线与范围

- Issue：[#7 RETAIL-00F | 独立 Agent 安全验证环境](https://github.com/2Zest/OpenDot-RetailOps/issues/7)，当前 Open / BLOCKED、GitHub 上未分配。
- 总体计划：V0.2 APPROVED；文件 blob `f4baf060fc335a2844b8bf783c2f044cb3b89170`，合并基线 `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`。
- 场景文件 blob：`88ec6f760ad92fbd071dc1cea86685bf9dc15b79`；依赖图 blob：`b998e8a186a8ae0e6c28468a76377ee3cb66daa2`。
- Issue 契约 blob：`f6a4252cc1187a6f85c3c8d7e2838591df9d1df2`；Plan blob：`c8b139ea41b7853d33db84427800723550fee395`。
- 实际代码 HEAD：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`；worktree `/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00F`；分支 `codex/retail-00f-n1-image`；执行角色 Security Agent。
- DAG 中本任务无上游硬依赖，下游阻塞 #8、#16、#17、#18。本次不修改这些 Issue 的状态或依赖。
- 本回执只覆盖 N0 与 N1。N1 阻塞后停止，不执行 N2/N3。

## N0 环境及源码基线

| 检查项 | 实际事实 |
|---|---|
| WSL | Ubuntu 24.04.1 / WSL2，内核 `6.18.58.1-microsoft-standard-WSL2`，x86_64 |
| Docker | Docker Desktop daemon 28.5.1，Linux amd64，20 CPU；daemon 内存约 15.5 GiB |
| 内存门槛 | 第二次构建前 `MemAvailable=13111944 KiB`；构建期间 available 约 12 GiB，始终超过 4 GiB 门槛 |
| 磁盘 | WSL `/` 起始可用约 947 GiB；D: 可用约 612 GiB |
| 既有容器 | minio、elasticsearch、vector_db、redis、portainer 五个；均未停止、改配或访问 |
| 初始镜像 | 本地没有 `helsome/miniclaw-agent` 或 `retailops/miniclaw-agent` 镜像 |

已读取原仓库 Makefile、container/Dockerfile、container/.dockerignore、.github/workflows/docker-publish.yml、scripts/smoke-agent-image.sh，以及总体计划、场景、DAG、Issue #7 契约、对应 Plan 和回执模板。发布 workflow 使用 container 构建上下文、TOOL_REFRESH 源提交 SHA、OCI revision/source 标签及同一 smoke 脚本。Dockerfile 动态引用包括 node:24-slim、ghcr.io/astral-sh/uv:latest、APT 当前稳定源、agent-browser@latest、headroom-ai[code,mcp] 最新版、feishu-cli latest 与 oh-my-zsh master；构建中止前未解析后续工具版本。

GitHub 当前 Issue #7 为 Open/READY/无人认领；PR #72 已合并至当前 e8db2b6… 基线。GitHub CLI 未安装。推送认证通过 Windows Git Credential Manager 的 dry-run 验证；无凭证被读取或写入回执。

### 官方镜像探测

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `docker pull helsome/miniclaw-agent:latest` | 1 | `pull access denied ... repository does not exist or may require docker login` |
| `docker manifest inspect helsome/miniclaw-agent:latest` | 1 | `denied: requested access to the resource is denied; unauthorized: authentication required` |

官方 tag 无法访问，未取得可验证的 Registry RepoDigest。不能确认官方镜像内容或兼容性。

### N0 三层语义检查

| 对齐层 | 结论 | 证据 |
|---|---|---|
| 总体计划 / 场景 | PASS | 在独立 WSL2/Docker 环境做准备；未访问 Home 数据、未连接真实零售写接口、未改全局安全策略。 |
| Issue / Plan | PASS | 固定实际 HEAD、远端 Issue 和 Plan 版本；本任务无上游硬依赖；使用独立 worktree/分支。 |
| N0 节点标准 | PASS | 环境资源、Docker、运行容器、镜像状态和指定构建入口已核验；可用内存高于门槛。 |

## N1 原 Dockerfile 本地构建

官方镜像无法获取后，按原 Dockerfile、`container` 构建上下文，目标为 `retailops/miniclaw-agent:00f`、平台 `linux/amd64`。两次命令均把源 HEAD `e8db2b6b983e9cd2eeca79e596f81b2e5b93663a` 用作 TOOL_REFRESH 和 OCI revision，并包含仓库 source 标签：

```bash
docker buildx build --load --pull --platform linux/amd64 \
  --build-arg TOOL_REFRESH=e8db2b6b983e9cd2eeca79e596f81b2e5b93663a \
  --label org.opencontainers.image.revision=e8db2b6b983e9cd2eeca79e596f81b2e5b93663a \
  --label org.opencontainers.image.source=https://github.com/2Zest/OpenDot-RetailOps \
  --tag retailops/miniclaw-agent:00f \
  --file container/Dockerfile container
```

| 尝试 | 退出码 | 结果及证据 |
|---|---:|---|
| 1 | 1 | APT 包下载期间多次连接代理 198.18.0.210:80 失败，包含 HTTP 502；apt-get 层以 100 退出。完整压缩日志：[build-attempt-1](evidence/RETAIL-00F-N1-build-attempt-1.log.gz)。压缩附件 SHA-256 baf5790dbf710a0dfc7d7193b4c576532c7050b819b1ecc4ebc88e8aae46ed70；解压原始日志 SHA-256 be393cde1a44f322339ef0e4395ee3a7ada4d6d1ff30df79b7e0b86172b96b08。开始构建前 free -h 显示 available 12 GiB；首次命令中的自动 awk 守门因 Windows shell 转义失败，但该实际资源快照高于4 GiB。 |
| 2 | 1 | APT 下载465个包后，libitm1_12.2.0-14+deb12u1_amd64.deb 返回 HTTP 502，最终 Failed to fetch ... libitm1 ... 502 Bad Gateway，apt-get 层退出100。完整压缩日志：[build-attempt-2](evidence/RETAIL-00F-N1-build-attempt-2.log.gz)。压缩附件 SHA-256 88ec98d43d2bd4dee39255980ee05f0c0511dca616f4f68447f9a329913b7429；解压原始日志 SHA-256 289ee089fb1232c98441b3ceef82ca10d2ea894fec91623dfa0d08ee2afad70b。构建前检查 MemAvailable=13111944 KiB。 |

附加网络探测：宿主机访问 Debian InRelease 返回 HTTP 200；临时 node:24-slim 容器 GET 同一 URL 也返回 HTTP 200。这仅证明 InRelease 元数据端点可达，不代表包池文件稳定。按调度只重试一次；不再重启构建，不修改 Dockerfile、APT 源或安全策略。

### 镜像元数据与冒烟

- Registry RepoDigest：无，官方镜像 manifest 未取得。
- 本地目标镜像 ID：无；`docker image inspect retailops/miniclaw-agent:00f` 返回 `No such image`。未将本地 Image ID 冒充 Registry Digest。
- 构建曾解析的基础镜像 digest（不是 RetailOps 镜像 digest）：node:24-slim = `sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530`；uv:latest = `sha256:a3ea1357342c1a4bf9a0c53a3deb1b55379aefa037338d8113d5771efa01774f`。
- 最终内部工具版本、动态依赖解析版本：不可得；构建在 Dockerfile 的 APT 层退出，后续 npm/pip/Feishu CLI/oh-my-zsh 步骤未运行。
- `scripts/smoke-agent-image.sh`：`NOT_RUN`。目标镜像不存在，未创建 smoke 容器。
- 镜像兼容性：BLOCKED / 未验证。

文档回归：暂存内容的 git diff --cached --check 退出 0。尝试启动 npm run docs:check 时，WSL 实际解析到 Windows Node/npm；Node 无法使用 UNC 当前目录并转到 Windows 系统目录，报找不到 scripts/check-docs.mjs。脚本本身没有执行，因此该检查标记为 CHECK BLOCKED / NOT VALIDATED，而不是源码或文档断言失败。未修改源码。

### N1 三层语义检查

| 对齐层 | 结论 | 证据 |
|---|---|---|
| 总体计划 / 场景 | BLOCKED | 隔离环境需要可信镜像；官方 Registry 不可验证，本地构建未通过，暂时没有可供后续安全验证的镜像。 |
| Issue / Plan | BLOCKED | N1 要求来源可追溯；官方 manifest 未取得，原 Dockerfile 构建失败，镜像准备交付未完成。未以 prompt 或基础镜像替代。 |
| N1 节点验收 | BLOCKED | 目标镜像 ID、工具版本、Registry Digest 均不可得；原 smoke 未运行，兼容性未验证。 |

## 结论与后续边界

N0：**PASS**。N1：**BLOCKED**，原因是 Debian APT 代理对包文件请求连续返回 HTTP 502，两次原 Dockerfile 构建均失败；原始日志已附。仅提交此阶段回执和构建证据。保持 Issue Open/BLOCKED 且 GitHub 未分配；不标记 DONE、不解锁 #8/#16/#17/#18、不运行 N2/N3。任何后续构建需重新确认窗口与网络条件。
## Review 追加：构建日志校验与正确环境文档检查

- 压缩日志 SHA-256 复核：attempt-1 baf5790dbf710a0dfc7d7193b4c576532c7050b819b1ecc4ebc88e8aae46ed70；attempt-2 88ec98d43d2bd4dee39255980ee05f0c0511dca616f4f68447f9a329913b7429，均与原记录一致。
- gzip -t 两份日志均退出 0；解压后 SHA-256 分别为 be393cde1a44f322339ef0e4395ee3a7ada4d6d1ff30df79b7e0b86172b96b08、289ee089fb1232c98441b3ceef82ca10d2ea894fec91623dfa0d08ee2afad70，与原记录一致。
- 凭据扫描：对 GitHub Token、AWS Access Key、OpenAI 样式 API Key、Authorization Bearer/Basic、URL 用户信息、npm token 和常见 secret assignment 模式扫描，两个解压日志均无匹配。
- 正确的 WSL 环境为 Node v24.22.3、npm 11.19.1。命令 PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check 退出码 1；此分支尚未包含公共修复，失败仍为 docs/retailops/RETAILOPS-ROADMAP.md:1 指向缺失 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。保留前一次误用 Windows Node/npm 的历史记录，不把本次结果写成 PASS。
- 网络最小排查建议（本轮未执行构建或网络重试）：后续如获授权，先在同一 BuildKit/代理出口检查日志中失败的精确 .deb URL 响应码与代理缓存/上游日志；分别对比 WSL 主机与构建网络对该包文件的可达性。InRelease 元数据 HTTP 200 不证明包池文件可用。若仍为 502，交由代理/网络维护方排查；不建议改 Dockerfile、切换APT源、绕过代理或放宽安全策略。

### Review 后三层语义复核

- 总体计划/场景：BLOCKED，缺少可信且可验证的目标镜像。
- Issue/Plan：BLOCKED，原 Dockerfile 两次构建失败；未改变 N1 结论。
- N1 节点标准：BLOCKED，smoke 未运行，兼容性未验证。
- 追加验证只核对归档日志和文档检查，不进入 N2/N3，不解锁 #8/#16/#17/#18。

## 公共基线合并后文档复验（2026-11-26）

- 最新 develop/retailops：f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61；本分支普通 merge commit bfe2b9b7ae0e3f0d861a37ff95d6ddaaca7ebc50。
- WSL Node v24.22.3 / npm 11.19.1；PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check 退出码 0，218 个 Markdown 文件通过。
- git diff --check 与 git diff origin/develop/retailops...HEAD --check 均退出 0。
- 本轮没有重新构建镜像、拉取新镜像或运行 smoke。原两次构建失败、官方镜像不可获取、目标镜像不存在、scripts/smoke-agent-image.sh NOT_RUN 等证据均保留。
- N1 最终判定仍 BLOCKED：文档检查通过不能替代可验证的可信镜像、镜像 ID/工具版本与 smoke 证据。
- 三层语义：总体计划 BLOCKED；Issue/Plan BLOCKED；N1 节点 BLOCKED。Issue #7 保持 Open/BLOCKED 且未分配；不进入 N2/N3、不标 DONE、不解锁 #8/#16/#17/#18。
- PR #76 仍为阶段性证据归档 PR，保持 Open、目标 develop/retailops，等待独立 Review。

## N1 远程可信镜像构建与本地导入复测（2026-11-28）

### 节点基线

- Issue #7：当前 GitHub 状态仍为 `OPEN`、标签 `BLOCKED`、未分配；本回执不更新 Issue 或 Project 状态。
- Issue 契约 blob：`f6a4252cc1187a6f85c3c8d7e2838591df9d1df2`；Plan blob：`c8b139ea41b7853d33db84427800723550fee395`。
- 总体计划/PRD/ADR：RetailOps V0.2 APPROVED；计划文件 blob：`f4baf060fc335a2844b8bf783c2f044cb3b89170`。
- 本次回执分支：`codex/retail-00f-n1-receipt`，从 `develop/retailops` HEAD `a71185311a699db7da29dbf6b8374c7c5dadd3ae` 创建；PR #94 已合并到 `main`，merge SHA `f82c3cd7af99a33478bacbf6dfec3353ee058e6d`。
- Actions Run：[#46114549179](https://github.com/2Zest/OpenDot-RetailOps/actions/runs/46114549179)，Job `140885337279`，结论 `success`。工作流 HEAD 为 `f82c3cd7af99a33478bacbf6dfec3353ee058e6d`。
- 构建源码固定为 `a71185311a699db7da29dbf6b8374c7c5dadd3ae`；`container/Dockerfile` blob 为 `840e53c73a152bea6927a59825d3db2d27bea8b1`。未修改 Dockerfile、Runtime、测试、依赖或安全策略。

### 远程构建与来源校验

Runner 为 GitHub-hosted `ubuntu-24.04`，实测 Ubuntu `24.04.5 LTS`、linux/amd64；Docker Engine `28.0.4`、Buildx `v0.39.1`、BuildKit `v0.20.2`。实际步骤及结果：

| 步骤 | 结果 |
|---|---|
| 固定源码 SHA 与 Dockerfile blob 核验 | PASS，退出码 0 |
| 拉取并记录基础镜像、Registry index 到 `linux/amd64` manifest 映射 | PASS，退出码 0；各 index 中恰有一个 amd64 子 manifest |
| 原 `container/Dockerfile` 构建（启用 `--pull`） | PASS，退出码 0 |
| provenance 摘要核验 | PASS，退出码 0；两项 LLB `image.resolvemode=pull` |
| 镜像元数据与工具版本记录 | PASS |
| 原远程 Smoke Test | PASS，退出码 0；Chromium CDP HTTP Smoke 通过 |
| 镜像压缩导出与 Artifact 上传 | PASS，退出码 0 |
| 诊断 Artifact 上传 | PASS，退出码 0 |

| 基础镜像 | BuildKit provenance 摘要 | 预拉取 Registry index | Registry 映射的 amd64 manifest | 比对层级 |
|---|---|---|---|---|
| Node | `sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530` | `sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530` | `sha256:e0e989b967dacc279681ed81774b2ce9eeebbb0efb8e0c427573235bebf1eda1` | BuildKit 值匹配多架构 index |
| uv | `sha256:a3ea1357342c1a4bf9a0c53a3deb1b55379aefa037338d8113d5771efa01774f` | `sha256:a3ea1357342c1a4bf9a0c53a3deb1b55379aefa037338d8113d5771efa01774f` | `sha256:e6f7bcfb74272969c1540d61db9dca207e65d348554ffd7bf4398495d88f8c9f` | BuildKit 值匹配多架构 index |

这次 `--pull` 结果中，BuildKit 摘要与预拉取 index 完全相同；Registry 映射另行记录 amd64 子 manifest，没有把两种摘要层级互相冒充。

### Artifact 下载、校验与本地导入

- 镜像 Artifact：ID `15251415387`，上传大小 `1,096,111,688` bytes；压缩 tar `1,096,111,216` bytes。诊断 Artifact：ID `15250909688`，上传大小 `473,459` bytes。
- 下载目录：`D:\workSpace\codeAgent\artifacts\retail-00f-run-46114549179\`（目录不纳入仓库）。执行 `sha256sum -c miniclaw-agent-00f-linux-amd64.tar.gz.sha256` 得到 `OK`；Windows SHA-256 与随包摘要相同：`5b1321c5c7c6b2a86d377e2c2e1778997014ddc6d7589409380f497133e5c340`。
- `docker load` 退出码 0，输出 `Loaded image: retailops/miniclaw-agent:00f`。未删除或清理既有镜像、容器、卷或缓存。
- 远端 Image ID：`sha256:9d7156efd64e0af6736eb444fcd93ec1a2da1d5fa8190e7ee6f0a12441c449dc`。本地 Docker Desktop `29.9.3` 导入后的 Image ID：`sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`。两者不一致，原因尚未确认；未将 Image ID 声称为相同，也未将其冒充 Registry RepoDigest。
- 同时核对：远端与本地均为 `linux/amd64`；OCI `revision` 均为 `a71185311a699db7da29dbf6b8374c7c5dadd3ae`，`source` 均为 `https://github.com/2Zest/OpenDot-RetailOps`；11 行内部工具版本文本完全相同；Artifact 原始 config blob 的 SHA-256 与远端 Image ID 一致；本地 `RootFS` DiffID 序列及可见 image config 字段与 Artifact config 相同。上述匹配不能消除本地 Image ID 差异。

### 本地 Smoke Test

第一次运行原脚本因 WSL Ubuntu 主机未安装 `jq` 而中断；没有修改脚本或安装系统级包。随后将 Ubuntu APT 的 `jq 1.7.1`、`libjq1`、`libonig5` 解包到 `/tmp/retailops-jq-46114549179/`，仅为本次命令提供临时 PATH/LD_LIBRARY_PATH，再运行固定源码 worktree 中原始脚本：

```bash
bash scripts/smoke-agent-image.sh retailops/miniclaw-agent:00f amd64
```

第二次退出码 0，Chromium CDP HTTP Smoke 通过；脚本退出清理了其临时容器。源码来自独立、干净的 Linux worktree `/home/szz_user/projects/OpenDot-RetailOps-00f-source-a7118531`，HEAD 为固定 SHA。输出留存在本地诊断目录 `local-smoke.log`。WSL 原工作区的未提交图标、文档及验证文件均未触碰。

### 节点语义一致性回执

Issue / Plan 版本 / 节点 ID：Issue #7 / `RETAIL-00F-PLAN` / N1。

总体计划、Issue 契约、执行 Plan 及节点标准：沿用 develop/retailops 上已批准版本；本轮只执行 N1 镜像获取与 Smoke 验证。

实际 Git HEAD / worktree / 执行角色：回执 worktree `D:\workSpace\codeAgent\OpenDot-RetailOps-00f-n1-receipt` / `codex/retail-00f-n1-receipt`；工作流 HEAD `f82c3cd7af99a33478bacbf6dfec3353ee058e6d`；源码 HEAD `a71185311a699db7da29dbf6b8374c7c5dadd3ae`；Linux 源码 worktree 如上；执行角色 Codex。

依赖 Issue 状态、合并 SHA、证据：#7 仍 `OPEN/BLOCKED`；PR #94 已合并，merge SHA 如上；Run 和 Artifact ID 如上。

允许修改路径与实际 diff：本次验收不修改仓库业务文件；回执本节为唯一仓库变更。Dockerfile、Runtime、安全策略均未变更。

实际行为与命令：远程构建、摘要核验、远程 Smoke、导出和上传均成功；SHA-256 校验及 `docker load` 成功；本地 Smoke 退出码 0。远端与本地 Image ID 对照为不一致，见上表。

证据位置：Run `46114549179` 及其两个 Artifact；本机诊断目录包括 `build-metadata.json`、`build.log`、`base-image-build-resolution.txt`、`image-metadata.json`、`tool-versions.txt`、`smoke.log`、`local-smoke.log`、`local-import-verification.txt` 和镜像 SHA-256 文件。大型镜像和原始诊断文件不提交到 Git。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| 总体计划 / 场景 | 取得来源可追溯的 linux/amd64 Agent 镜像，不扩大业务功能 | 固定源码、固定 Dockerfile；远程 provenance、Smoke、Artifact SHA 校验均有真实证据；本地运行 Smoke 通过 | PARTIAL：Image ID 对照未闭合 |
| Issue / Plan | 在真实隔离环境准备可信镜像，保持原 Runtime 与安全限制 | 原 Dockerfile 未改；本次未执行 N2/N3 权限隔离；Issue #7 仍 BLOCKED | PARTIAL |
| N1 节点验收 | 构建、来源核验、Smoke、导出及本地导入核验 | 远程步骤全部通过；本地 checksum、架构、OCI 标签、工具版本、RootFS 和 Smoke 通过，但本地 Image ID 与 Artifact 记录不一致 | PARTIAL，停止于 N1 |

偏差 ID / 影响 / 根因 / 修订措施：`RETAIL-00F-N1-R1`；本地 image ID 与远端/Artifact ID 不一致，影响“本地导入身份等同于远端构建镜像”的确认。根因未确认，不在本轮修改 Runtime 或 Docker 配置；请主控审查差异证据并决定后续诊断条件。

复测结果与回归范围：无源码或测试修改；原远程 Smoke 与原本地 Smoke 均真实执行并通过。此报告不声称本地 Image ID 一致。

尚未验证项与风险：本地 Image ID 差异原因；N2 隔离、N3 强制权限、销毁/复用、安全负向测试均未运行；Durable Runtime 等下游未验证。

决定：停止在 N1，提交本回执供主控审查；在 Image ID 差异经审查前不把 N1 标为 PASS，不启动 N2/N3，不解锁 #8、#16、#17、#18，不关闭 Issue #7。

审核者及时间：待主控审查。

## N1 Image ID 差异复核与最终结论（2026-11-28）

本节复核并更新上文 `RETAIL-00F-N1-R1` 的待确认结论；上文原始观测和历史失败记录保留。

- 本地 `docker info` 实测 `Driver=overlayfs`、`DriverStatus: driver-type=io.containerd.snapshotter.v1`，确认使用 containerd snapshotter；本地 Docker Engine `29.9.3`。远端 Runner Engine 为 `28.0.4`，其存储后端未单独核实，不以版本推断。
- 原始镜像压缩包 SHA-256 已校验为 `5b1321c5c7c6b2a86d377e2c2e1778997014ddc6d7589409380f497133e5c340`。从原始归档提取的 OCI manifest blob 实际 SHA-256 为 `3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5`，等于本地 `docker image inspect .Id`；manifest 的 `config.digest` 指向 `sha256:9d7156efd64e0af6736eb444fcd93ec1a2da1d5fa8190e7ee6f0a12441c449dc`，提取的 config blob 实际 SHA-256 与之相同，也等于远端 `image-metadata.json` 记录的 Image ID。
- 从本地 `docker save` 流提取的 OCI `index.json` 指向同一个 `sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5` manifest；本地 inspect 的 `.Id` 和本地 RepoDigests 条目也显示该摘要。它是本地 manifest 摘要，不能作为已推送 Registry 的 RepoDigest 证据。
- 对照原始 config 与本地 inspect：完整 `Config` 字段、`linux/amd64`、OCI revision/source 标签、24 项 RootFS DiffID 的顺序和内容均一致；原始 manifest 的 24 项未压缩 layer digest 与 config 的 DiffID 序列一致。远程和本地工具版本文件的 11 行一致，原远程与本地 Smoke 均退出 0。
- 因此本次两个不同 ID 分别对应同一镜像的 manifest 与 config；以上原始 blob 哈希、manifest 到 config 的引用、本地导出 index 和运行配置比对建立了两者的对应关系。[Docker CLI issue #5526](https://github.com/docker/cli/issues/5526) 记录了 containerd image store 的类似显示行为，[Docker 文档](https://docs.docker.com/engine/storage/containerd/) 说明了该存储后端。远端具体存储后端不影响本次已验证的摘要链。
- 证据留存于 `D:\workSpace\codeAgent\artifacts\retail-00f-run-46114549179\diagnostics\`：`archive-manifest-oci.json`、`archive-config-oci.json`、`local-export-index.json`、`local-inspect-current.json`，以及原有 metadata、校验与 Smoke 记录。`docker save` 仅通过管道读取 index，未写入完整临时镜像。

三层复核：总体计划/场景 **PASS**；Issue/Plan 的 N1 镜像准备 **PASS**；N1 构建、来源、归档、导入身份链与远程/本地 Smoke **PASS**。这是 N1 节点结论，Issue #7 完整安全验收尚未完成。

决定：停止于 N1，等待主控最终 Review。N2–N6 尚未执行；Issue #7 保持 OPEN/BLOCKED，不解锁 #8、#16、#17、#18。未改动 Docker 存储配置、Dockerfile、Runtime 或安全策略。
