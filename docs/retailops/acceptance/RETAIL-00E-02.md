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

Issue / Plan / 节点：同 N0；N2。操作前 worktree HEAD bc78d31c532fd547140a1bf88f89b3ac895d0b10；分支 docs/retail-00e-02；Data Research Agent。
依赖：无硬依赖；真实公开 Filter API 响应。允许修改调查/回执文档；原始JSON只在 ignored data/retail-00e-02/。
预期标准：可复核的真实样本、字段类型/单位、候选覆盖、唯一键、日期连续、缺货标签和样本选择验证。
实际命令/退出码：报告“可复现筛选和profile命令”中的Python 3脚本实际执行exit 0。revision/main核验匹配c374e85975c82816c495acfa904cc55ab14a47d3；train/eval各重复请求两次，返回分别90/7行，响应两次相同且与ignore缓存逐字节一致。验证19字段API类型、值类型、null、单series键、连续日期、24项小时数组、stock-hour标签，以及销量和在1e-9内；训练11行尾差，最大4.440892098500626e-16。过滤结果所有行均为store0/product38，未混拼。
证据/模式：公开API请求URL、数据卡SHA、train/eval响应SHA、忽略目录样本；无模型/runtime。coverage=1个编码store×1个SKU，不代表门店全SKU。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 用真实公开样本支持调查且避免外推 | 单一真实store-SKU、97日；门店全SKU数未测量 | PASS |
| Issue / Plan | schema、覆盖、单位、缺失、标签有证据 | 19字段类型、单位限制、唯一键、连续性和缺货标签见报告 | PASS |
| 节点标准 | 可复现筛选与profile，并确认结果 | revision固定检查、双次查询和缓存逐字节相同；命令exit0 | PASS |

偏差：无。复测：API每split重复两次，body与缓存完全一致；复跑profile脚本通过。尚未验证：其它SKU/门店、全量缺失覆盖和业务单位映射。决定：继续N3。记录者/时间：执行 Agent，2026-11-26。

## N3 — 确定时间边界、V0/V1条件与来源缺失

Issue / Plan / 节点：同 N0；N3。操作前 HEAD bc78d31c532fd547140a1bf88f89b3ac895d0b10；分支 docs/retail-00e-02；Data Research Agent。
依赖证据：场景固定SHA e8db2b6b983e9cd2eeca79e596f81b2e5b93663a；baseline代码SHA 8af694a09a5a427d1d50648d348c022565a781f2。允许路径仅调查和回执文档。
预期标准：时间有序、无未来目标泄漏的候选划分；说明单SKU V0和多SKU V1的证据边界及数据源分类。
实际结果：候选train 2024-03-28至06-11（76日）、validation 06-12至06-25（14日）、test 06-26至07-02（7日）。对单series日期窗连续无重叠；跨SKU共同窗口尚未验证。报告新增V0/V1适用条件、场景缺失业务字段、PUBLIC_HISTORICAL/SIMULATED/DERIVED/LIVE_DEVICE映射及未来协变量/目标标签防泄漏要求。静态核验baseline ssa_forecasting.py真实1-based行5、7–9、19–22、47、50、66、70；未训练或运行模型。
证据/模式：报告内固定commit链接与源码行号；静态调查+公开样本profile，不是算法验收。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 根据经营场景明确数据支撑及限制 | 公开历史销量不能冒充库存/批次/价格，V0/V1边界列明 | PASS |
| Issue / Plan | 输出时间划分和完整数据缺口，不实施算法 | 无训练/导入；多SKU coverage标未验证 | PASS |
| 节点标准 | 按日期审查未来泄漏并引用固定源码 | 76/14/7时序方案；基线按6/25与6/26切分，评价缺货标签仅条件过滤 | PASS |

偏差：无。复测：日期交界连续，train-end紧邻eval-start；报告所附profile断言通过。风险：多series共同日期、未来天气/促销实际可用时间仍需后续验证。决定：进入N4受控回归；不解锁下游。记录者/时间：执行 Agent，2026-11-26。

## N4 — 定向检查与文档回归

Issue / Plan / 节点：同 N0；N4。HEAD/worktree/角色：PR #79任务分支；Data Research Agent。
允许路径：报告/回执文档；不修公共roadmap。预期：样本检查与文档检查的实际命令、退出码、失败归类。
实际动作/退出码：本轮报告所附网络筛选/profile命令已实际执行，exit 0；本轮git diff --check实际执行exit 0。此前本工作树npm run docs:check exit 1，唯一报告项为 docs/retailops/RETAILOPS-ROADMAP.md:1 引用不存在的 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。依照主控调度，等待公共链接修复合并后再运行docs:check；本轮不运行依赖安装、不改公共文档。
证据/模式：本轮脚本实际结果；此前docs:check失败输出。文档静态检查。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 不扩大到公共文档修复 | 错链只记录，等待公共修复 | PASS |
| Issue / Plan | 定向样本profile与docs回归如实记录 | 样本验证exit0；文档回归被外部已知基线错误阻断 | BLOCKED |
| 节点标准 | 测试结果真实、退出码齐全 | docs:check此前exit1；公共修复未合并前不重试 | BLOCKED |

偏差 BASELINE-DOCS-LINK：公共roadmap遗留路径；由独立公共修复处理，本任务不包含。风险：docs:check暂不能通过。决定：保持BLOCKED，等待修复合并后重跑docs:check；不标DONE。记录者/时间：执行 Agent，2026-11-26。

## N5 — 交付与 Review

Issue / Plan / 节点：Issue #13 RETAIL-00E-02；RETAIL-00E-02-PLAN.md；N5。总体计划/SHA：同 N0。HEAD/worktree/角色：PR创建时的head SHA为d9b7d9bc6a00f9b636289e974220e7d69922178a；docs/retail-00e-02；Data Research Agent。
依赖/PR：PR #79 — https://github.com/2Zest/OpenDot-RetailOps/pull/79；目标分支 develop/retailops；当前 Open、未合并，等待独立 Review。主控已将 Issue #13 正文/标签同步为 REVIEW。
允许路径/预期：调查报告和节点回执，不含原始数据；独立中文 PR 关联 #13。
实际结果：PR #79 创建时的head SHA为d9b7d9bc6a00f9b636289e974220e7d69922178a。后续已有文档回执提交；本轮调查补充也将作为中文文档提交推送至同一分支并推进PR head。PR 保持开放，尚未 Review 或合并；不关闭 Issue、不标 DONE。两份报告已交付，无业务代码或数据文件。
证据/模式：PR #79、固定 head SHA、调查报告与本回执；公开元信息和单序列 profile，非训练/runtime。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 独立 Review，人工合并 | PR #79 指向 develop/retailops，Open、未合并；Review 尚未发生 | PASS |
| Issue / Plan | 交付本调查，不提前实施下游 | PR 关联 #13；没有业务实现或 #21 导入 | PASS |
| 节点标准 | 文档、关联 PR、head SHA 可核验 | 两份文档和 PR #79 均已交付；创建时 head SHA 已记；未 Review/合并 | PASS |

偏差：无新的 N5 交付偏差；Review/合并尚未发生，后续由主控/Reviewer处理。复测：PR创建时head SHA记录为d9b7d9bc6a00f9b636289e974220e7d69922178a；提交前git diff --check及staged diff检查通过。风险：N4 的基线 docs:check 失败仍阻塞整体任务状态。决定：N5 PR交付节点完成；整体保留 BLOCKED，不标 DONE、不关闭 Issue，等待独立 Review。记录者/时间：执行 Agent，2026-11-26。

## 三层语义总检

1. 总体计划/场景：PASS；仅调查公开数据，没有开发业务能力。
2. Issue #13 / Plan：PASS；版本许可、真实单序列profile、归一化限制和时间边界齐全。
3. 节点验收：BLOCKED；npm run docs:check基线坏链失败，PR/独立Review待主控。没有算法验收结论，不解锁#14/#21。


## PR #81 合并后的最终复验补充（2026-11-26）

此次复验基于已合并公共修复后的集成基线 `f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61`，在原 worktree `/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00E-02`、分支 `docs/retail-00e-02` 内完成；未新建分支或 PR。早期回执中“仅一个SKU / 尚未测量跨SKU共同窗口”准确描述了当时单SKU抽样状态，现由以下全门店编码范围分页结果补充并取代其作为最终覆盖结论；原记录保留为历史。

### N2/N3 补充：同一编码门店多SKU覆盖

实际执行：`python3 docs/retailops/investigation/RETAIL-00E-02-store-coverage.py`，退出码0。脚本分页读取 store_id=0 的全部公开 Dataset Viewer `/filter` 行，不下载 Parquet。revision 前后均为 `c374e85975c82816c495acfa904cc55ab14a47d3`。

- train：6,660行、67页、74个SKU；每个SKU连续90天；复合键6,660/6,660唯一；分页响应SHA-256（按8字节大端长度前缀及offset顺序聚合）`60b5ee76e48f94549b74d21119b7b249b409edbf2748a56327cf9bc536f4ee85`。
- eval：518行、6页、相同74个SKU；每个SKU连续7天；复合键518/518唯一；聚合SHA-256 `f710d7bea6428190da664ada60869fca4b09b1a556f6a47579ebc916d6af671c`。
- 74/74 SKU 的共同窗口为2024-03-28至2024-07-02，连续97天；train/eval日期相邻且无重叠。筛选结果 `partial=false`，SKU集合无差异。
- 多SKU判断：数据集 store_id=0 范围内足以支持从74个编码SKU中按明示标准选择20–50个用于后续研究；不证明现实门店身份或完整商品目录，不补足库存、批次、成本等经营字段，也不代表真实经营验收。没有混入其他门店数据。

对应可复现分析脚本及逐项结果已加入调查报告。样本仍只存于被 `.gitignore` 忽略的本地 `data/retail-00e-02/`，未进入提交。

### N4/N5 状态说明

- `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check`：退出码0，219份Markdown文档通过。
- `git diff --check`（本次全部修改后）：退出码0。

此前 N4 的 docs:check BLOCKED 是公共失效链接尚未合并时的历史结果；失败证据保留，本轮合并后的 N4 文档回归为 PASS。PR #79 仍保持 Open，Issue #13 保持 Open/REVIEW；不标记 DONE、不解锁 #14/#21。没有训练模型、实现导入模块或执行算法验证。


## 文件范围授权与节点回执补充（2026-11-26）

### N0 — 调查辅助脚本文件范围

用户在本轮 Review 中授权将以下唯一新增辅助文件纳入本 Issue 的文件范围：

- `docs/retailops/investigation/RETAIL-00E-02-store-coverage.py`：只读、标准库 Python 调查脚本；读取固定 revision 的 Dataset Viewer 筛选 API，枚举已批准的 `store_id=0` train/eval 结果，校验覆盖并输出聚合哈希。脚本不修改仓库业务源码、依赖、配置或安全策略，不保存或输出原始销售行。

本 PR 的交付文件清单限定为：
1. `docs/retailops/investigation/RETAIL-00E-02.md`（调查报告）
2. `docs/retailops/acceptance/RETAIL-00E-02.md`（本节点回执）
3. `docs/retailops/investigation/RETAIL-00E-02-store-coverage.py`（上述单一调查辅助脚本）

该补充仅确认辅助脚本的调查范围；未授权或实施数据导入器、业务代码、模型、算法、第三方源码或原始数据提交。

| 对齐层 | 检查结果 | 判定 |
|---|---|---|
| 总体计划 / 场景 | 仅调查公开数据覆盖，不实现零售业务能力；脚本不改变运行环境 | PASS |
| Issue / Plan | 用户明确将该路径纳入 RETAIL-00E-02 文件范围；现有报告和回执记录了脚本目的及边界 | PASS |
| 节点验收 | N2/N3 脚本实际执行及74 SKU、共同97天证据保留在上节；本次不重做数据调查。新增范围记录后执行 `git diff --check` 和 `npm run docs:check` | PASS（以本次命令结果为准） |

PR #79 保持 Open，Issue #13 保持 Open/REVIEW，等待人工合并确认；不认领、不标 DONE、不解锁 #14/#21。
