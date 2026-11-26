# RETAIL-00F N1 镜像网络诊断与条件重试回执

**结论：N0 PASS；N1 BLOCKED。** 本回执只记录 Issue #7「下一块任务 B」授权的镜像网络诊断和一次原 Dockerfile 构建重试。构建未完成，没有目标镜像；未运行 smoke、N2 或 N3。Issue #7 继续 Open/BLOCKED。

## 基线、范围与依赖

- Issue：[#7 RETAIL-00F | 独立 Agent 安全验证环境](https://github.com/2Zest/OpenDot-RetailOps/issues/7)。任务及 Plan：[`RETAIL-00F-PLAN.md`](../initial-plan-v0.2/plans/RETAIL-00F-PLAN.md)。
- 总体计划：V0.2 已批准；本轮不改变计划、Issue 契约、DAG 或安全门槛。
- 实际基线：`develop/retailops` / `4110e8e5f429ccd021e4cc0ada2e4eb188f037da`。
- Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-00f-n1-network`；分支：`codex/retail-00f-n1-network-diagnostics`。启动时工作树干净，基于上述远程基线。
- 本轮文件范围：本回执和下方一份脱敏构建日志。未修改原 `container/Dockerfile`、APT 源、全局代理、安全策略或既有 N1 回执。
- 本块收尾依赖核对：PR #84 已合并，merge SHA 为 `4110e8e5f429ccd021e4cc0ada2e4eb188f037da`；#14、#15 Closed/DONE，Project #2 分别为 Done；其唯一后继 #19 已核验为 Open/READY、Project 为 Ready，未认领或启动。

## N0 环境与历史证据

| 项目 | 实际结果 |
|---|---|
| WSL | Ubuntu 24.04.1，WSL2，`x86_64` / `linux/amd64` |
| Docker | Docker Desktop 4.50.0；Linux daemon 28.5.1；Buildx 使用 `default` docker driver |
| 可用内存 | 构建前 `MemAvailable=13,316,740 KiB`（约 12.70 GiB），高于 4 GiB 门槛 |
| 可用磁盘 | WSL `/` 约 940 GiB；`D:` 约 611 GiB |
| 既有容器 | minio、elasticsearch、vector_db、redis、portainer。构建前后容器 ID、镜像和状态相同，均保持运行 |
| 目标镜像 | 构建前后均不存在本地 `retailops/miniclaw-agent:00f`；未覆盖现有镜像 |
| 诊断基础镜像 | 本机已有 `node:24-slim`，`linux/amd64`，digest `sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530` |

此前两份 gzip 构建日志均重新执行 `gzip -t`，退出码均为 0；压缩及解压 SHA-256 与既有记录一致：

| 历史日志 | 压缩文件 SHA-256 | 解压内容 SHA-256 |
|---|---|---|
| [构建尝试 1](evidence/RETAIL-00F-N1-build-attempt-1.log.gz) | `baf5790dbf710a0dfc7d7193b4c576532c7050b819b1ecc4ebc88e8aae46ed70` | `be393cde1a44f322339ef0e4395ee3a7ada4d6d1ff30df79b7e0b86172b96b08` |
| [构建尝试 2](evidence/RETAIL-00F-N1-build-attempt-2.log.gz) | `88ec98d43d2bd4dee39255980ee05f0c0511dca616f4f68447f9a329913b7429` | `289ee089fb1232c98441b3ceef82ca10d2ea894fec91623dfa0d08ee2afad70` |

历史 PR #76 已记录官方 `helsome/miniclaw-agent:latest` 拉取与 manifest 检查失败。本轮未改用或拉取其他来源的镜像。

## N1 网络诊断

从历史失败日志提取的精确包 URL：

`http://deb.debian.org/debian/pool/main/g/gcc-12/libitm1_12.2.0-14%2bdeb12u1_amd64.deb`

历史包 URL 原先曾经返回 HTTP 502。本轮仅对该 URL 分别执行一次宿主机 GET 和一次 BuildKit GET；两者都收到完整 HTTP 200 响应，因此该包版本未被替换，无需改查当前 APT 索引。`InRelease` 状态不作为包文件成功的替代证据。

| 路径与命令 | 时间/退出码 | 实际结果 |
|---|---|---|
| WSL 宿主机：`curl --location --max-time 45 --silent --show-error --output /dev/null --write-out "http=%{http_code} remote=%{remote_ip} total=%{time_total}\n" http://deb.debian.org/debian/pool/main/g/gcc-12/libitm1_12.2.0-14%2bdeb12u1_amd64.deb` | 2026-11-26（N0 诊断时段，约 22:09–22:12 +08）；退出码 0 | `http=200 remote=198.18.0.210 total=0.329219` |
| BuildKit：本地已有 `node:24-slim` 临时探针，`docker buildx build --pull=false --no-cache --progress=plain --output=type=cacheonly --file /tmp/retailops-n1-buildkit-probe/Dockerfile /tmp/retailops-n1-buildkit-probe` | 2026-11-26 22:13:20 +08；退出码 0 | `proxy=none http=200 peer=198.18.0.210`。BuildKit RUN 未注入代理环境变量；其 socket peer 与宿主机 curl 的 remote IP 相同。探针 Dockerfile SHA-256：`eb74e4675a7dae7cda97d1ccc281797825dbe230f477cb08ddb4a220ebe49681`。临时上下文位于 `/tmp`，未改仓库文件。 |

一次初始 BuildKit 探针因 Dockerfile 位于上下文外，命令在读取阶段退出码 1（`failed to read dockerfile`），没有发起网络请求；随后已将临时探针放入独立 `/tmp` 上下文，完成上表中的唯一实际 BuildKit GET。

## 唯一一次原 Dockerfile 条件重试

重试前重新确认可用内存约 12.70 GiB、`D:` 可用约 611 GiB、目标 tag 不存在。使用原 `container/Dockerfile`、原 `container` 构建上下文、`linux/amd64`、真实基线 SHA 作为 `TOOL_REFRESH` 与 OCI revision，并设置仓库 source 标签。命令仅执行一次：

```bash
docker buildx build --load --pull --platform linux/amd64 \
  --build-arg TOOL_REFRESH=4110e8e5f429ccd021e4cc0ada2e4eb188f037da \
  --label org.opencontainers.image.revision=4110e8e5f429ccd021e4cc0ada2e4eb188f037da \
  --label org.opencontainers.image.source=https://github.com/2Zest/OpenDot-RetailOps \
  --tag retailops/miniclaw-agent:00f \
  --file container/Dockerfile container
```

- 时间：2026-11-26 22:13–22:16 +08；`docker buildx build` 退出码 1；Dockerfile 的 `apt-get install` 层退出码 100。
- APT `InRelease` 与签名索引下载成功（共 9,420 kB）。实际包下载时，Debian 包池的多项 GET 经 `198.18.0.210:80` 返回 `Unable to connect`，包括 `zsh`、`redis-tools`、`ripgrep`、`shellcheck`、`sqlite3`、`tree`、`unzip`、`zip` 和 `zsh-common`；APT 层最终以 100 退出。完整日志保留于[本轮脱敏构建日志](evidence/RETAIL-00F-N1-network-build-attempt.log.gz)。
- 日志 2,995 行；脱敏规则扫描 0 项匹配，归档为脱敏副本；gzip 完整性检查退出码 0。压缩文件 SHA-256：`fbce912f6a9b572dda6ea5faac66d34876d7418ebdefd90f2df6246b1b707f72`；解压内容 SHA-256：`2d98753fd826f8415443e8afc02d7ee02d7d4dba6dc0bd1be95e53ba5c04d4e5`。
- 构建失败后目标镜像仍不存在；没有可报告的 RetailOps Image ID、RepoDigest、OCI 元数据或内部工具版本。基础镜像 digest 不等于 RetailOps 目标镜像 digest。
- `scripts/smoke-agent-image.sh`：`NOT_RUN`，无目标镜像、无 smoke 容器。N2/N3：`NOT_RUN`。不代表隔离、权限或真实 Runtime 验收通过。
- 构建前后五个既有容器状态一致；未清理或停止任何其他容器。未再次重试。

## 检查与三层语义验收

本回执按 `NODE-RECEIPT-TEMPLATE.md` 记录节点目标、动作、文件范围、命令/退出码、证据、阻塞和验收结论。

| 对齐层 | 预期 | 实际证据 | 判定 |
|---|---|---|---|
| 总体计划 / 场景 | 安全验证需使用来源可信、可追溯且兼容的镜像；保留隔离和安全门槛 | 两路单包 GET 成功，但原 Dockerfile 唯一重试因代理包文件连接失败；目标镜像不存在 | BLOCKED |
| Issue #7 / RETAIL-00F Plan | N1 准备可验证镜像；失败时保留证据并停止，不以未知镜像替代 | Buildx 退出 1、APT 退出 100；没有 Image ID、RepoDigest、工具版本或兼容性证据 | BLOCKED |
| N1 节点验收 | 来源、镜像元数据、工具版本与原 smoke 均有真实证据 | Smoke NOT_RUN；没有可供检查的目标镜像；本轮唯一重试已耗尽 | BLOCKED |

| 检查 | 命令/环境 | 退出码及结果 |
|---|---|---|
| 文档一致性 | WSL Node `v24.22.3`、npm `11.19.1`：`npm run docs:check` | 0；252 个 Markdown 文件通过 |
| 差异空白检查 | `git diff --check`、暂存后 `git diff --cached --check` | 0；无空白错误 |
| 文件范围 | `git diff --cached --name-only` | 仅本回执与一份脱敏网络构建日志，符合已冻结范围 |

这些文档检查不能替代镜像验收。

## 阻塞处理建议与边界

需要网络/代理维护者检查并恢复通过当前代理 `198.18.0.210:80` 到 `deb.debian.org` Debian 包池的稳定 GET/下载连接；优先核对上表列出的包 URL 在代理侧的连接失败和缓存/上游状态。宿主机和 BuildKit 的单次 `libitm1` GET 返回 200，不能证明批量包下载稳定。不要切换 APT 源、绕过代理或改安全策略；当前任务已用完允许的构建重试次数，须待网络条件恢复并另获授权后再继续。

三层均为 **BLOCKED**。保持 Issue #7 Open/BLOCKED，不关闭、不标 DONE；不进入 N2/N3，不解锁 #8、#16、#17、#18，也不认领或启动 #19。阶段 PR 仅归档 N1 网络诊断证据，等待独立 Review。
