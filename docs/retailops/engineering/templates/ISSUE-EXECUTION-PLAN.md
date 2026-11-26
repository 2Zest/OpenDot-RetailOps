# Issue 执行计划模板

> 复制到对应 Issue 的 Plan 路径；保留原契约语义，不在模板中扩大范围。

## 原 Plan 与批准架构

- 原始 37 份任务 Plan 与机器可读 DAG：只读保留；本模板不要求重写或逐份深审与本任务无关的 Plan。
- Issue 经授权认领后，N0 根据实际源码、环境、对应契约和该 Issue 原 Plan 细化执行节点、路径、命令及证据；同时核对已批准 PRD/Architecture/ADR。
- 主控核验范围内的普通执行细化后可继续；改变任务范围、依赖/DAG、验收标准或安全边界必须单独提交变更提案，获得批准并版本化后执行。
- 新增/修改路径仍以本 Issue N0 文件清单为准；未列路径默认只读。

## 任务与基线

- RETAIL 编号 / GitHub Issue：
- Issue 当前标签 / Projects 当前状态 / 是否已授权认领：
- 对应 Plan 与 Plan SHA：
- `develop/retailops` 基线 SHA：
- 上游依赖及各自合并/验收 SHA：
- Worktree 路径 / 分支 / tracking：
- 执行人 / 执行环境 / Node、npm、OS：

## 范围与路径所有权

| 路径 | 操作 | 所有者 | 共享/冲突人 | 目标与验证 |
|---|---|---|---|---|
|  | 新增 / 修改 / 只读 |  |  |  |

- 本任务允许做：
- 明确不做：
- 上下游安全/Runtime 门槛：
- 并行文件冲突时的串行方案：

未列入表格的路径默认只读。共享依赖、迁移、路由、工具注册、策略或包配置需要单独列明 owner 与兼容检查。

## 包、模块依赖与测试发现（适用时）

- 是否为独立包；manifest / lockfile / TypeScript 配置的责任路径及 owner：
- 根 `tsconfig.json` 与宿主私有源码排除方式：
- 宿主公共 API 或 Application port 注入接缝：
- build / typecheck / test 命令及实际 runner：
- unit / contract / integration 测试目录与 discovery pattern：
- 依赖方向、纯领域校验库及版本冻结证据：
- 本次显式不创建/不修改的包配置和共享路径：

## 节点计划

| 节点 | 对应原 Plan 目标 | 实际入口/动作 | 允许路径 | 测试/证据命令 | 验收条件 |
|---|---|---|---|---|---|
| N0 | 预检与冻结 |  |  |  |  |
| N1 |  |  |  |  |  |
| N2 |  |  |  |  |  |
| N3 |  |  |  |  |  |
| N4 | 回归与独立验收 |  |  |  |  |
| N5 | PR 与交付 |  |  |  |  |

## 每节点执行记录

逐节点使用 [总体计划节点回执模板](../../initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md)，记录实际动作/改动、来源证据、命令及退出码、阻塞、PASS/DEVIATION/BLOCKED 和三层语义核对。

## 发布与回滚

- 提交范围和提交 SHA：
- PR URL、目标分支、head/base SHA：
- Issue/PR/Projects 当前值及回读时间：
- 已知风险、未验证项、回滚/修复步骤：
- 下游是否满足 DAG 与安全门槛：
