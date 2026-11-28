# RETAIL-00B-01-R2 Runtime 真实模型只读验证回执

状态：**BLOCKED**（N0 PASS；真实模型运行未启动）。Issue #8 仍由主控维护为 IN_PROGRESS；本回执不改 Issue 或 Project 状态。

## 结论

本轮确认 #7 的隔离镜像、readonly_validation 强制策略和 Live Source 已到达集成基线；#7 的 N2–N4 产品路径使用合成 Provider，不能证明真实模型自主调用工具。当前源码没有受控 Provider Relay，受限 Runner 只加入专用 Docker Internal=true 网络。没有在不改变该边界的情况下把真实模型流量送到 Provider 的现成通道。

因此本轮停在 N0：没有启动 Agent/Provider、没有发起模型 API 请求、没有生成新的 Session/工具事件/Token/费用数据、没有执行取消/重复或负向调用，也没有读取原 Home 数据、密钥或私人配置。未把合成模型、单元测试或程序注入调用写成本轮真实模型结果。需要先由主控/用户确认 Provider 主机和官方模型 ID，再按下文批准的边界建立 Relay。

## N0：输入、环境与文件范围冻结

### 版本及依赖

| 项目 | 固定值 / 证据 |
|---|---|
| 仓库 | 2Zest/OpenDot-RetailOps |
| 分支 / Worktree | feat/retail-00b-01-r2 / /home/szz_user/projects/OpenDot-RetailOps-00B-01-R2 |
| 集成基线 / 当前 HEAD | a3bfec05308f2e94e52324525de7f24156883a1a |
| 初始工作区 | git status --short --branch 显示干净；本轮只在此独立 WSL worktree 工作 |
| Issue #8 | Open / IN_PROGRESS；Plan blob 926fc3eea7ca7038bf0de9ea2ad93f6610da343d |
| 总体计划 / PRD / 场景 | V0.2；文件 blob 分别为 f4baf060fc335a2844b8bf783c2f044cb3b89170、8e6ad021ad6344461407cecea21da8d8b28fa28e、88ec6f760ad92fbd071dc1cea86685bf9dc15b79 |
| RETAIL-00F | Issue #7 Closed / DONE；PR #96 merge SHA a3bfec05308f2e94e52324525de7f24156883a1a |
| 已验收镜像 | retailops/miniclaw-agent:00f；Docker Image ID sha256:3be6d22242492c2eb5d57be1774e6200e767c0b49a858680d0ff4abe09c311e5；linux/amd64；OCI revision a71185311a699db7da29dbf6b8374c7c5dadd3ae |
| #7 Live Source | 8e30401dd7936ecbd77714803e1fa7bcee9d861d；Agent Runner src/ 与 prompts/ 清单 SHA-256 596fa16337380701efa0bef16a91aa644fd0acd59fad50ea6f6e8208917084f7；与当前基线对应目录的 Git diff 为空 |
| Pi SDK | @earendil-works/pi-coding-agent@0.84.2（#7 已核验锁定版本） |
| 运行环境 | WSL Ubuntu；Node v24.22.3、npm 11.19.1；Docker Client/Server 29.9.3；20 CPU、MemAvailable 约 13 GiB、WSL 根盘可用约 937 GiB |

已读取根 AGENTS、Issue #8 与 R2 Plan、Issue #2、R1 审查中的 R01 缺口、#7 N1/N2–N6 回执及只读 Runbook、总体计划/PRD/场景和节点回执模板。

### 只读 Fixture 输入

现有 #7 非敏感 fixture 文件作为候选输入被只读哈希核对，值与 #7 N2–N6 回执一致。本轮没有把它们复制到新的 taskRun 目录或交给模型读取。

| 路径 | 本轮观察到 SHA-256 | 数据来源 / 本轮性质 |
|---|---|---|
| docs/retailops/acceptance/fixtures/retail-00f/fixture-a.json | 48fe0d820087ee0747cc8795f0d36355790b1f77224802e80319186172b97e6f | #7 提交 fixture；静态哈希 |
| docs/retailops/acceptance/fixtures/retail-00f/fixture-b.json | 39e5809bb7f079327dde42c0df4fad5c4269eeaa44afef8450bbfd4b63cde900 | #7 提交 fixture；静态哈希 |
| docs/retailops/acceptance/fixtures/retail-00f/evidence-example.md | 3a575ed844941af41fe1f4a1bf20d646bf2b2f004a487c34abe18af07f2db6bd | #7 提交 fixture；静态哈希 |

### 候选修改路径及资源边界

- 本任务唯一仓库修改：新增 docs/retailops/acceptance/RETAIL-00B-01-R2.md（本回执）。没有修改源码、测试、断言、依赖、lockfile、配置、数据库、原 #7 fixtures、Plan 或安全策略。
- 本轮没有创建本任务的运行实例或 taskRun 目录。若确切 Provider/官方模型获确认且 Relay 再次冻结后，运行只能使用该独立 worktree 下的专用 data/、SQLite、唯一 loopback 端口、专用 Docker internal 网络、独立 Session、IPC、taskRun 工作目录和本轮只读 fixture 副本；不得访问或挂载原 Home/数据库/凭据目录。
- 不启动 Host 模式、普通工具模式或开放端口；不连接默认 bridge/host network；不拉取或构建其他镜像；不改 Docker 全局配置。N1 镜像保留现有已验收摘要。

### N0 已执行命令与退出码

| 命令 / 检查 | 退出码 | 结果 |
|---|---:|---|
| git status --short --branch；git rev-parse HEAD | 0 | 初始 worktree 干净；HEAD 与指定基线一致 |
| git diff --quiet 8e30401dd7936ecbd77714803e1fa7bcee9d861d HEAD -- container/agent-runner/src prompts | 0 | 基线的 Live Source 文件与 #7 已验收版本相同 |
| docker version --format 'client={{.Client.Version}} server={{.Server.Version}}' | 0 | Client/Server 29.9.3 |
| docker image inspect retailops/miniclaw-agent:00f ... | 0 | 镜像存在、amd64、Image ID 与 #7 本地验收值相同 |
| sha256sum <三份 #7 fixture> | 0 | 三份哈希与 #7 回执一致 |
| 只读源码搜索 provider relay / model gateway / ANTHROPIC_BASE_URL / readonly_validation | 0 | 找到 Provider 直连配置和 internal-network 强制；未找到 Relay/Gateway 实现 |

以上命令均没有启动容器、进程、Provider 或模型 API 请求；没有检查或导出任何 API Key/Token 值。

## 源码可行性与具体阻塞

- src/readonly-validation-policy.ts 要求设置专用 MINICLAW_READONLY_VALIDATION_NETWORK。
- src/container-runner.ts 在 readonly_validation 下只为任务容器设置这个网络，并在启动前核验 Docker Internal=true；未发现通过该模式直连宿主/默认 bridge/公网的受控机制。
- container/agent-runner/src/runtime/pi/pi-provider.ts 支持将自定义 Provider 注册到 ANTHROPIC_BASE_URL，src/container-runner.ts 允许传递限定的 Provider 配置变量。该能力是直连 Provider URL 的配置，不是 Relay 或出口 allowlist。
- #7 Runbook 和 N2–N6 回执记录的 Provider 是仅在该 internal 网络中的本地合成服务。其多步工具结果、ENOENT 回流、拒绝 Bash/Write 和 API 去重均为既有合成 Provider 证据，**不是本轮或 #7 的真实模型自主行为**。
- 将 Runner 网络改为普通 bridge、加入任意 HTTP(S) 代理、直连 Provider 公网或使用原 Home 凭据，都会越过本任务安全边界。本轮不执行这些操作。
- 确切 Provider 主机与官方模型 ID、独立实例安全存储中的可用凭据尚未确认。Issue #2 中的历史 Provider/模型记录仅为历史证据，不构成本轮 Provider 授权。

## 最小受控 Relay 方案（边界已获批；目标主机/模型待确认；未实施）

1. **单一目标 allowlist**：用户确认本轮唯一 Provider 和官方模型 ID 后，将确切 Provider FQDN、TCP 443、TLS SNI 和证书校验规则写入冻结计划。拒绝通配域、重定向、动态 Provider fallback、其他端口或任意 CONNECT。目标主机尚未确认，因此现在不写入域名或地址。
2. **保持 Runner 隔离**：Agent Runner 始终只连专用 Docker Internal=true network，无 default bridge、host network、发布端口或任意公网出站。单用途 Relay 只接入该 internal network，并经独立 default-deny egress proxy 出口；egress proxy 只允许上一步 FQDN:443/SNI。其他容器不加入该出口。Relay 不能成为通用 HTTP/SOCKS/CONNECT 代理。
3. **应用层约束**：Relay 仅接受冻结模型所需的精确推理 API 方法和路径，拒绝其他方法、路径、模型、Host、非 TLS 上游、重定向和额外 CONNECT；限制请求/响应大小。若 SDK 实际需要额外 endpoint，停止并重新审批。
4. **密钥边界**：密钥只能通过独立实例的安全 UI/安全 store 注入。真实 Provider API Key 不进入命令行、普通日志或源码；由隔离宿主安全地注入 Relay，Relay 仅在批准的请求中添加上游认证头。Runner 只持有本次 taskRun 的短期 Relay token。任务结束/取消后销毁 Relay 与 task token；禁止在聊天或报告中传密钥。
5. **失败与取消**：TLS/allowlist/认证错误、Provider 错误、超时、限流、Relay 不可达均停止该请求；无 fallback、零自动重试。传递 AbortSignal/客户端断开以取消上游请求；取消后不发起新请求。只记录脱敏 request ID、Provider/模型、状态码、耗时、Token usage 和错误类别，不记录 Authorization、请求正文或完整响应。
6. **成本上限**：本轮最多 12 次模型 API 请求，重复与取消场景也计数，自动重试为 0；总输入 Token 不超过 20,000、总输出 Token 不超过 4,000。Provider/模型和可审计价格须在运行前冻结；按模型官方价格核算实际成本并记录，若价格/Token usage 无法验证则不发起请求。
7. **权限证据仍需独立验证**：Relay 只解决模型访问。仍须从正式产品入口在同一批准镜像/Live Source、只读 Runtime 下完成模型自主多步读取、错误返回后继续、fixture 哈希对比、重复/取消与工具事件采集。Write/Edit/Bash 的拒绝必须来自 Runtime/工具注册/权限边界证据或明确标注为程序注入负向探测，不能以 Prompt 或模型未尝试违规代替。

Relay 边界已经批准，但缺少确切非敏感 Provider 主机和官方模型 ID，因此不实施 Relay、不接通外网、不注入密钥。本任务也不把 Issue #2 的历史 Provider/模型作为默许授权。

## 节点与 Issue #2 建议

| 节点 | 结果 | 证据 / 限制 |
|---|---|---|
| N0 范围冻结 | **PASS** | 基线、依赖、Live Source、镜像、现有 fixture 哈希、单一文档改动范围、命令与资源边界均固定 |
| N1 准备独立 taskRun fixture | **NOT_RUN** | 只核对已归档 #7 fixture 静态哈希；未创建本任务运行目录或副本 |
| N2 真实模型多步只读/缺失文件 | **BLOCKED** | 当前无受控真实模型 Relay；确切 Provider 主机/模型待确认 |
| N3 拒绝写入/重复/取消 | **NOT_RUN** | 没有真实模型任务或 Session；不以 #7 合成 Provider 的 N2/N3 结果代替本轮 |
| N4 归档 | **PARTIAL** | 本回执保留 N0/阻塞与待批准方案；没有本轮模型事件、Token/cost、取消或运行日志可归档 |
| N5 文档回归 | PASS | npm run docs:check：292 份 Markdown 通过，退出码 0；git diff --cached --check 通过，退出码 0。不运行源码测试 |
| N6 交付 | PARTIAL | PR #97 Open，目标 develop/retailops；仅文档变更，未合并；Issue #8 保持 IN_PROGRESS，未改 Issue #2 状态 |

### 三层语义核对

| 对齐层 | 预期语义 | 本轮事实 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 保持 Runtime/业务边界；真实模型运行、工具轨迹和预算证据不得由 fixture/静态源码替代 | 未运行模型；只将 #7 已验收隔离能力和 Relay 缺口记录为现状 | BLOCKED（运行目标未满足） |
| Issue #8 / Plan | 用正式入口、真实模型、批准的隔离只读工具完成读取与错误回流；不得扩大默认安全权限 | 需要未现存的 Provider Relay/模型访问路径；没有 Provider 主机/模型确认前停止 | BLOCKED |
| 当前节点标准 | 两个 fixture 的真实模型自主读取、多步工具回流、哈希、重复与取消证据 | 本轮没有任何真实模型请求或运行事件；哈希仅为静态输入冻结 | BLOCKED |

**R01 完成建议**：当前只能确认“隔离只读 Runtime 底座已由 #7 在合成 Provider 下通过”；Issue #2 的 R01 真实模型补测仍未完成。建议 Issue #2 保持原状态，等受控 Relay 获批、Provider/模型固定并且真实模型运行证据通过后再评估完成，不以本回执单独建议关闭 #2。

审核者及时间：待主控 Review。
