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
