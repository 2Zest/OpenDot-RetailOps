# RetailOps 工程执行约定

本文件约束本仓库中由 RetailOps Issue 授权的工作。具体范围以已批准总体计划、对应 Issue 契约、执行 Plan 和 N0 文件清单为准；本文件不授权扩展任务、不改变 DAG，也不允许把工程规范任务变成业务功能实现。

## 目录与代码隔离

- RetailOps 采用轻量 DDD 与六边形架构；业务能力按领域边界组织，Domain、Application、Adapters、Composition 依赖向内。Entity、Value Object、Aggregate、Repository、纯函数和状态 Guard 按需使用，须能说明其解决的业务不变量；不强制 CQRS、Event Sourcing 或微服务。
- 现有 OpenDot 代码保持在既有目录。RetailOps 业务代码未来只可放在经对应 Issue/Plan 授权的 `apps/retailops/**`；本任务只记录目录设计，不创建业务代码或运行包。
- `src/**`、`apps/cloud-agent/**`、`web/**`、`electron/**`、`shared/**` 和 `container/**` 都是现有项目边界。没有逐路径授权时，不向这些目录加入 RetailOps 实现，也不以“共享”为由改写原模块。
- 计划中的前端文件使用 `web/src/features/retailops/**`；仅在 Issue 明确包含前端工作时创建。测试文件使用 `apps/retailops/test/**`；文档使用 `docs/retailops/**`。
- 目录示意和路径所有权见 [`PROJECT-STRUCTURE-AND-OWNERSHIP.md`](docs/retailops/engineering/PROJECT-STRUCTURE-AND-OWNERSHIP.md)。示意路径不代表当前已经存在或已获业务实现授权。

## 依赖与 Harness 边界

- RetailOps 的业务规则放在领域层；应用层定义用例和端口；适配器对接持久化、OpenDot/Pi Harness 或外部工具；组合根负责装配。
- 依赖向内：应用层依赖领域层；适配器实现应用层端口并依赖领域合同；组合根装配应用层和适配器。领域层不得导入 Harness、数据库、Web、MCP、Cloudflare 或产品服务。
- 领域层可依赖已经批准的纯领域校验库（例如 GitHub Issue #19（RETAIL-01）要求的 Zod schema）；具体依赖来源、版本、包可见性和锁文件由对应 Issue 的 N0 冻结。不得把“纯领域”解释为只能使用标准库，也不得擅改根依赖。
- 只复用现有 OpenDot/Pi Harness。Pi SDK 的导入和原生会话/提交/检查点映射只放在 RetailOps Harness 适配器内；不建立第二套 Agent Runtime，不把 Pi 原生对象泄漏给领域层、Web 或业务持久化层。
- Agent analysis、独立 risk-review、context/prompts、业务算法、仿真以及 Trace/Eval 的候选职责和路径见 [`PROJECT-STRUCTURE-AND-OWNERSHIP.md`](docs/retailops/engineering/PROJECT-STRUCTURE-AND-OWNERSHIP.md)。候选路径需由具体 Issue/Plan 授权；领域规则不依赖模型、宿主或数据库。
- `apps/retailops/**` 是独立包边界候选：对应实现 Issue 的 N0 应冻结 package manifest、专属锁文件、build/typecheck/test 命令与 test discovery；根 `tsconfig.json` 不自动纳入该目录。宿主只能通过明确的公共 API/包接缝或 Application ports 注入连接；禁止导入 `src/**`、`apps/cloud-agent/src/**` 等宿主私有源码，也不得复制 Runtime。
- Runtime 检查点由底座负责恢复；产品数据库负责业务任务、草案、审批及业务回执。不得用产品表伪造 Runtime 检查点，也不得以静态调查或 fixture 代替真实运行门槛。
- 根 `package.json`、锁文件、根 `tsconfig.json`、`src/index.ts`、路由注册、数据库迁移入口、`apps/cloud-agent` 包和部署配置是共享/跨边界路径。改动前须在 N0 指明唯一责任人、依赖和回归命令；出现并行所有权冲突时串行处理。

## Issue、PR 和 Projects 状态

- 只在用户授权后认领 Issue。每个 Issue 使用独立 Worktree、分支、Plan、节点回执和 PR；分支从 N0 确认的最新 `develop/retailops` 创建。
- Issue 标签、Issue 正文的最新状态、PR 状态和 GitHub Projects 状态必须按 [`ISSUE-PR-PROJECT-STATUS.md`](docs/retailops/engineering/ISSUE-PR-PROJECT-STATUS.md) 同步并回读核验。
- READY 不表示已认领。没有授权不得分配执行人或转入 IN_PROGRESS。未合并 PR 不能标 DONE；DONE 必须记录实际 merge SHA 并关闭 Issue。
- 若 GitHub CLI 未授权或 Projects 写入失败，记录真实错误和未同步字段；状态漂移未修复前，不解锁下游任务，不得报告“同步成功”。

## 执行、验收与安全

- 每个任务先完成 N0：基线、上游、工作区、资源、允许路径、依赖和检查命令均有证据。
- 保留批准的 37 份原始执行 Plan 与机器可读 DAG。Issue 认领后，N0 按实际源码细化被分配任务的 Execution Plan 并核对已批准架构；普通实现细化由主控核验，范围、依赖、验收或安全边界变更须另行审批，不在本任务中改写或逐份深审其它 Plan。
- 每节点按 `docs/retailops/initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md` 留痕，并对照总体计划/场景、Issue/Plan、当前节点标准做三层语义检查。失败先记证据；不得降低断言或把未运行写成通过。
- 使用 WSL Ubuntu 24.04、Node 24 和仓库锁文件；在节点回执记录实际版本、命令、退出码和结果。不得提交密钥、真实数据集或运行时数据。
- 不运行未获授权的真实模型、Runtime、MCP、Handoff 或有副作用操作。RETAIL-00F（GitHub Issue #7）为 BLOCKED 时，任何依赖其隔离环境的任务都不得启动。
- 禁止强推、`reset --hard`、`git clean`、覆盖未提交文件或擅自合并 PR。
