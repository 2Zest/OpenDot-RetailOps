# RETAIL-00B-01 | Agent Runtime、Agent Loop 与 Tool Calling 源码调查

状态：READY（远程任务分支尚未建立）｜优先级：P0｜类型：调查 + 安全运行验证，仅文档 PR

## 1. 背景与用户目标

从已跑通的 OpenDot Home 对话入口发出一条普通消息和一条需要读取测试工作区文件的消息，解释真实的 HTTP → 排队/投递 → Host Runner → Pi Session → 模型/工具 → 事件 → 消息存储与前端展示链路。为 RetailOps 分析 Agent 的只读业务工具确定候选接入点；不是实现业务工具。可观察结果：源码位置可追溯，正常/异常路径有证据，能够区分产品封装与 Pi SDK 职责。

## 2. 基线与现有实现

- 仓库：https://github.com/2Zest/OpenDot-RetailOps
- 调查基准：`main` / `0db0ba1bbf658d217f248bf29b5715bcbf09ccac`；集成基线 `develop/retailops` / `d8f3c729a9fd8e38d34db80fac0c63098183e493`（2026-11-25 核实）；PR #1 已合并，仅六份 Markdown。执行前重新核对 HEAD 和差异。
- 运行证据：`docs/retailops/acceptance/RETAIL-00A-LINUX.md`，结论 PARTIAL。DeepSeek `deepseek-flash`（Anthropic 兼容）、Host `local-pi`，10 次 bash、1 次 Workspace Memory 工具、最长 7 个 tool-use 步骤、刷新后历史保留。以上是已提交报告的记录，不是本轮独立复跑结果。
- 已核对的静态锚点见 Plan。锚点是入口线索，不代表已证明所有调用边。
- Goal、Product Durable、Product MCP/Approval、Container Runner 未完成实测；全量测试、脚本权限等已知问题另行管理。

## 3. 本次范围

1. 追踪普通 Host/local-pi 对话的前端提交、鉴权/ACL、会话与消息写入、请求 ID、队列 admission、首次启动与已有 runner 投递分支。
2. 追踪 Host Runner 启动、执行权限、环境与 Provider 选择、Pi Session 创建/恢复、Agent Loop 所在层、工具集合的注册/过滤与执行、结果回流、错误/停止处理。
3. 追踪 stream event 序列化、WebSocket 广播、前端 Store、持久化与刷新重取；区分进程内状态、产品 DB、Pi session 文件以及各标识的映射。
4. 在隔离测试 workspace 中复用已配置模型，验证最小只读工具链及拒绝/取消行为（只在现有支持入口可安全触发时）。调查业务只读工具的候选扩展入口及其权限风险，明确后续 Durable/Product MCP 专项待确认事项。

### 明确不做

不新增 RetailOps Schema、Connector、Tool、Prompt 或 UI；不改变 Runtime、测试、lockfile、数据库结构、功能开关及安全策略；不修复权限位或其他已知基线缺陷；不部署 Cloud 或拉取镜像；不将 Host 的普通工具等同于 Product MCP 审批；不复制整个 SDK 或整仓库源码。允许阅读本地锁定依赖中的 SDK 源码（记录实际版本）。不读取/打印/提交密钥，不读取私人会话或真实业务数据。

## 4. 依赖与兼容边界

依赖已归档的 00A、WSL2 Linux ext4、Node 24、现有模型 Provider。维持原用户/工作区授权；测试在隔离 workspace 下进行，不允许执行写入生产数据或外部动作的工具。若需要创建专用 fixture，可由测试准备步骤在专用目录写入无敏感标识；Agent 只读，不得触碰原工作区。无权限/取消测试需采用受支持的 API/UI 或既有测试 fixture，不通过真实越权访问获取数据。不得为了验证启用未批准的功能或修改产品运行配置；无法安全运行的场景标记 BLOCKED/NOT_RUN。保持当前用户工作树和运行数据，避免构建改写图标；若必须重建，先在独立工作树中确认影响。

## 5. 建议实现顺序

按照同目录 Plan 完成 Git 预检 → 前端/后端消息入口 → Host/Provider/Session → SDK Loop/工具 → 流式与持久化 → 最小运行复现 → 候选接入点与学习总结 → 文档 PR。

## 6. 验收与故障场景

- 每个关键调用边须有固定 SHA 文件链接、函数/行号与调用/分支依据；依赖 SDK 证据单列版本及包内文件。未追踪到的边明确标 UNKNOWN，不以命名推断事实。
- 正常场景：真实普通对话、只读工具读取唯一 fixture 标识、多步读取；记录实际模型/运行模式、工具开始/结束、结果及流式事件顺序（脱敏）。
- 权限：核对消息 ACL、Host 权限、工具过滤及执行边界；优先执行原有针对性权限测试。不实际访问他人数据。失败：不存在的 fixture 文件，报告实际工具失败和最终响应，不要求模型自报成功。
- 取消/重复：查清请求去重与 interrupt/abort 分支；可控情况下验证取消和重复请求，标识请求、事件及终态；无法安全复现则标 NOT_RUN。不能将普通聊天去重当成业务 exactly-once。
- 恢复：页面刷新后历史恢复；若有安全条件并经用户确认，另验证停止/重启后会话保留；不要求在本轮验证进程中断后的 Durable checkpoint 恢复。无 DB migration 不虚构迁移验证。
- 回归：基于 Plan 中实际存在的针对性测试运行，记录命令、退出码、用例与失败；已知全量失败不掩盖、不改断言。`npm run docs:check` 与 Git diff 检查。真实模型、fixture、自动化、静态证据分别标记，不新增虚假通过记录。
- 调查验收 PASS 与原项目运行验收 PARTIAL 分开。若核心调用链无法追踪或证据矛盾，调查 REQUEST_CHANGES/BLOCKED；非核心场景未运行须有理由与后续任务，不阻止记录事实。

## 7. PR 切片和回滚

分支 `feat/retail-00b-source-investigation`（从最新已核实的 develop 建立；如已存在，先检查不覆盖）；PR base `develop/retailops`。仅允许 `docs/retailops/issues/RETAIL-00B-01.md`、`docs/retailops/plans/RETAIL-00B-01-PLAN.md`、`docs/retailops/investigation/RETAIL-00B-01.md` 及必要脱敏证据（若另增文件先说明）。不提交本地日志、配置、fixture 私有数据或生成资源。禁止 reset --hard/git clean/强推。独立文档提交可 revert；不自行合并。脚本权限修复另用独立分支。

## 8. 完成说明（执行后填写）

以下为原始执行阶段的完成说明模板，R1 状态与结果见本节后续“审查修订状态”；原始 Issue 验收条件保持不变。合并前保持 READY/IN_PROGRESS/REVIEW，只有通过审查并实际合并才标 DONE。

### 审查修订状态（RETAIL-00B-01-R1）

状态：REVIEW（原始调查已提交并合并；审查修订 PR 待 Review）。

- 原始调查提交：`f76970e83c0c9816604587ebab4c9ddbccd874da`，经 PR #3 合并为 `2a3465b3bdd2e2b776cd41ad3c052748e90fb3ea`。
- 原始定向测试历史结果：8 个测试文件、58 passed、0 failed、0 skipped、exit 0。该结果来自 PR #3 调查，不是本轮重新执行。
- 原始 Host Runner 真实运行：两轮用户任务共 user=2、assistant transcript=11、toolResult=9、工具调用=9；包含 bash=2、write=2、read=5。两次 write 发生在管理员 Home workspace 下的专用子目录。该记录不是独立 workspace 隔离测试，也不是 Agent 只读测试。
- 本轮补充验证：R01 因缺少可证明 read-only 工具权限的独立测试 workspace，且 Container Runner 镜像不可用，标为 BLOCKED；未运行 Agent，不生成新的 fixture、工具事件或 SHA-256 证据。
- 本轮对照源码修订了 Product Approval operation 限制、Pi 工具适配边界、Goal 开关条件、assistant 记录与模型 API 请求计数口径，以及持久化/重启恢复结论。
- 仍未验证：独立隔离 workspace 只读及拒绝 write、多步读取与缺失文件错误的隔离复测、服务重启后 Pi Session 恢复、Product Durable checkpoint 恢复、Goal/MCP/审批和 Container Runner。
- RETAIL-00A 完整运行基线继续为 PARTIAL。
- 审查记录：`docs/retailops/reviews/RETAIL-00B-01-REVIEW.md`。
- 修订 PR：创建后回填 URL；合并前状态保持 REVIEW，不将原 Issue 验收条件改写为通过。
