# RETAIL-00E-02 节点验收回执

依据 docs/retailops/initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md 逐节点记录。样本与调查事实见 [调查报告](../investigation/RETAIL-00E-02.md)。

## N0 — 环境、基线和范围预检

Issue / Plan / 节点：Issue #13 RETAIL-00E-02；RETAIL-00E-02-PLAN.md；N0。
总体计划版本/SHA：RetailOps V0.2 已批准；归档提交 08679239c1e9959f465e74f1b191085ce86c2c4b。
HEAD / worktree / 角色：初始 HEAD e8db2b6b983e9cd2eeca79e596f81b2e5b93663a；/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00E-02；分支 docs/retail-00e-02；Data Research Agent。
依赖：无新增硬依赖，主控确认授权；不解锁 #14/#21。
允许路径：调查报告、acceptance 回执；样本仅在 ignored data/retail-00e-02/。
预期标准：固定基线、环境、权限、范围和输出路径。
实际动作/命令/退出码：核对 Git 状态、HEAD、WSL2 Ubuntu 24.04、Node 24.22.3/npm 11.19.1、资源；样本窗口前 MemAvailable 约12 GiB；确认 .gitignore 第10行 /data/ 规则命中，初始工作区无未提交改动；exit 0；未安装依赖。
证据/运行模式：本地环境静态核查，无业务 runtime；主控 N0 授权回执与 Git 状态。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 仅做公开数据调查 | 未开发业务、未训练模型、无经营写操作 | PASS |
| Issue / Plan | 固定上游、节点、路径 | 主控确认 N0；数据目录被忽略 | PASS |
| 节点标准 | 环境、依赖、范围、HEAD可复核 | 环境和固定HEAD已记录 | PASS |

偏差：无。复测：不适用。未验证：WSL资源会变化，高负载前需重查。决定：继续。记录者/时间：执行 Agent，2026-11-26。

## N1 — 固定数据版本及许可

Issue / Plan / 节点：同 N0；N1。
总体计划/SHA：同 N0。HEAD/worktree/角色：独立任务 worktree；Data Research Agent。
依赖证据：无硬依赖；报告记录数据卡 revision、文件和基线代码 SHA。
允许路径与实际 diff：仅调查和回执文档，数据不提交。
预期标准：数据版本、许可和哈希 manifest。
实际动作/退出码：只读核查数据卡、LFS元信息、筛选API；train.parquet 106,436,287 bytes (>100MB) 未下载；区分数据 CC BY 4.0 与代码 Apache-2.0；exit 0。
证据/模式：调查报告“版本、来源与许可”；真实公开数据元信息，非模型/runtime。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 调查公开来源及边界 | 固定revision、许可、文件哈希 | PASS |
| Issue / Plan | 记录版本及署名要求 | 来源、日期、数据/代码许可已区分 | PASS |
| 节点标准 | manifest可核查 | 文件大小与LFS SHA齐全 | PASS |

偏差：无。复测：交叉核对数据卡与LFS元信息。风险：API URL未固定revision参数，报告注明前后revision与响应SHA。决定：继续。记录者/时间：执行 Agent，2026-11-26。

## N2 — 抽样分析 store/product/date/缺货

Issue / Plan / 节点：同 N0；N2。HEAD/worktree/角色：独立 worktree；Data Research Agent。
依赖：无硬依赖；样本是公开 API 返回的真实数据。
允许路径：文档；JSON仅在 ignored data/retail-00e-02/，不得stage。
预期标准：真实样本、字段、覆盖、缺失与缺货 profile。
实际动作/命令/退出码：按 store_id=0 AND product_id=38 查 train/eval；响应90和7行；Python 3标准库 JSON profile exit 0。97行无null、复合键唯一、日期连续，库存标签97/97吻合。销量使用1e-9容差；训练11行最大尾差4.44e-16。
证据/模式：真实公开 API 响应及SHA-256；仅描述单序列，不是模拟数据或runtime。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 判断公开数据证据和覆盖范围 | 一条真实序列，明确不外推 | PASS |
| Issue / Plan | 字段、覆盖、缺失和缺货可复核 | 97行结构及标签结果见报告 | PASS |
| 节点标准 | 留下输入、输出、命令和结果 | API查询、样本哈希和profile已记 | PASS |

偏差：无。复测：落盘样本复核哈希/profile。风险：未下载全量文件，单序列不代表总体。决定：继续。记录者/时间：执行 Agent，2026-11-26。

## N3 — 确定时间边界

Issue / Plan / 节点：同 N0；N3。总体计划/SHA：同 N0。HEAD/worktree/角色：独立 worktree；Data Research Agent。
依赖证据：基线源码固定 SHA 8af694a09a5a427d1d50648d348c022565a781f2。允许路径：报告、回执。
预期标准：时间顺序的 train/validation/test 方案和未来泄漏检查。
实际结果：train 2024-03-28至06-11（76日），validation 06-12至06-25（14日），test 06-26至07-02（7日）；静态检查 baseline ssa_forecasting.py 第5、7–9、19–22、47、50、66、70行；未运行模型。
证据/模式：报告引用固定源码SHA及行号；静态检查，非算法验收。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 时间顺序且避免未来目标泄漏 | 边界递增、不重叠，官方eval最后7日 | PASS |
| Issue / Plan | 输出边界建议而非算法 | 仅形成候选方案 | PASS |
| 节点标准 | 固定源码和行号证据 | 基线按06-25/06-26切分并使用90日encoder | PASS |

偏差：无。复测：检查日期交界连续。风险：其它序列须重新核验覆盖；模型/指标未运行。决定：继续N4，不解锁下游。记录者/时间：执行 Agent，2026-11-26。

## N4 — 定向检查与文档回归

Issue / Plan / 节点：同 N0；N4。HEAD/worktree/角色：独立 worktree；Data Research Agent。
允许路径：调查/验收文档；不修公共 roadmap。预期：profile、git diff --check、npm run docs:check结果和失败归类。
实际动作/退出码：profile exit 0；本工作树 npm run docs:check exit 1，报告 docs/retailops/RETAILOPS-ROADMAP.md:1 指向不存在的 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。本工作树 git diff --cached --check exit 0（仅暂存两份文档）。
证据/模式：主控预检和仓库文档静态检查。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 如实记录失败，不扩范围 | 既存坏链只记录 | PASS |
| Issue / Plan | 回归并分类失败，不降低标准 | profile通过，docs:check基线失败 | BLOCKED |
| 节点标准 | 测试结果和退出码齐全 | docs:check exit 1，不声称通过 | BLOCKED |

偏差 BASELINE-DOCS-LINK：公共检查指向遗留不存在路径；超出本任务范围，建议单独修复。复测不更改无关文档。风险：公共文档CI可能失败。决定：BLOCKED，提交调查供主控Review，不标DONE。记录者/时间：执行 Agent，2026-11-26。

## N5 — 交付与 Review

Issue / Plan / 节点：同 N0；N5。总体计划/SHA：同 N0。worktree/角色：docs/retail-00e-02；Data Research Agent。
依赖/PR：由主控创建目标 develop/retailops、关联 #13 的中文PR；保持开放，不自动合并。
允许路径/预期：调查报告和回执，不含原始数据。
实际结果：两份中文文档待提交；PR URL和独立Review尚未发生，等待主控。无业务代码、无数据文件。
证据/模式：调查报告、节点回执；公开元信息和单序列profile，非训练/runtime。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 独立Review，人工合并 | 等主控建PR，未合并 | PASS |
| Issue / Plan | 不实现下游、不擅自认领 | 没有业务实现或#21导入 | PASS |
| 节点标准 | 文档、PR、Review证据完整 | 文档备齐，PR/Review待主控 | BLOCKED |

偏差：N4基线docs:check失败；PR及Review URL尚无。复测：已执行git diff --cached --check，exit 0。风险：不得标DONE或关闭Issue。决定：交主控创建中文PR和Review后停止。记录者/时间：执行 Agent，2026-11-26。

## 三层语义总检

1. 总体计划/场景：PASS；仅调查公开数据，没有开发业务能力。
2. Issue #13 / Plan：PASS；版本许可、真实单序列profile、归一化限制和时间边界齐全。
3. 节点验收：BLOCKED；npm run docs:check基线坏链失败，PR/独立Review待主控。没有算法验收结论，不解锁#14/#21。
