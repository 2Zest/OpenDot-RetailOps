# RETAIL-05P（GitHub Issue #24）N1 节点回执

- 当前状态：N1 已通过主控复核；N2 已交付并等待主控核验；N3 未开始。
- 节点目标：提出折价候选生成、资格/硬约束、需求及损耗输入、精确金额和模拟指标公式，并用手算案例核对。
- 日期：2026-11-27（Asia/Shanghai）。
- Issue / 原 Plan：GitHub Issue #24 / RETAIL-05P-PLAN。
- 总体计划：已批准 PRD/Architecture/ADR；领域合同 v0.3.0。
- Git 基线：develop/retailops 8ca176ff3f9e5990b6c2487e41be2953e682c192。
- Worktree / 分支：D:/workSpace/codeAgent/OpenDot-RetailOps-05p / feat/retail-05p。
- 上游证据：Issue #19 / PR #86 merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192；Issue #14 / PR #83 merge SHA d3b402945ace1da4cd9e032690a394526079d09b。两项依赖均 CLOSED / DONE，Project #2 Done。
- N0 审查：主控已审查 #24 N0 并批准进入 N1；Issue #24 Open / IN_PROGRESS，Project #2 In Progress。#7 仍 Open / BLOCKED。
- 执行材料：[细化 Execution Plan](../plans/RETAIL-05P-EXECUTION-PLAN.md)，[N1 公式决策候选](../plans/RETAIL-05P-N1-FORMULA-DECISIONS.md)。

## 实际执行与证据

本节点完成了批准 PRD/Architecture、Issue #24、原始 RETAIL-05P-PLAN、DECISIONS-PENDING D02/D04/D05/D06、v0.3.0 Money/Quantity 与 assessSellability 合同对照；形成显式输入参数方案、可售硬约束、模拟数量守恒、收入/贡献/成本暴露公式与手算 fixture。

- 实际修改：仅 #24 文档；没有业务源码、算法、Schema 或测试代码修改。
- 测试/检查：
  - WSL Node：v24.22.3；npm：11.19.1。
  - 首次 docs:check：因命令中的 GIT_WORK_TREE 路径漏掉 codeAgent 目录，退出码 1（work tree not found）；未改 Git 配置。修正环境变量后复跑 npm run docs:check：退出码 0，258 份仓库 Markdown 检查通过。
  - git diff --check：退出码 0；无 whitespace error。Windows Git 给出 LF/CRLF 转换提示，不影响检查结果。
  - 未运行 build、typecheck、test 或真实运行；本节点是设计/手算验算，没有代码改动。
- fixture：均为人工合成、SIMULATED，明确标记，不是生产默认或真实销量/价格证据。
- N1 初次提交时状态快照：等待主控核验集中待决事项；主控决定已追加于下方，现已批准口径并放行 N2。所有业务数值仍未获默认批准。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 分别展示模拟售出、剩余、报损和收入/成本/毛利估计；来源可追溯；仿真不代表因果 | N1 方案分离售后余量与报损后余量；候选需求/报损需要 SIMULATED 来源引用；明确无 KPI/因果结论 | PASS |
| Issue #24 / RETAIL-05P-PLAN | 候选价、销售资格/毛利约束、收入/贡献/损耗和原因；纯计算、不可执行 | 参数化折价列表及阈值；Quality/expiry/inventory fail-closed；候选计算状态与执行权限分离 | PASS |
| N1 节点标准 | 公式与假设、手算案例、失败/不确定边界和来源明确 | 候选公式版本、变量单位、手算 fixture、三组决策请求已列出；真实金额实现测试未运行且非本节点要求 | PASS |

- 偏差：无范围偏差。公式和接口候选已获主控批准作为 N2 实施依据；具体业务数值仍未获默认批准，继续要求显式输入。
- 复测：修正 WSL GIT_DIR/GIT_WORK_TREE 参数后 docs:check 通过（258 Markdown）；git diff --check 通过。
- N1 初次提交时结论快照：设计提交核验并暂停于 N1；已由下方主控决定覆盖，当前允许进入 N2。

## N1 主控复核决定（2026-11-27）

主控完成 N1 复核并批准候选设计，授权进入 N2。批准决定及适用边界：

1. 每个候选显式提供带来源的 Q_demand 与 Q_loss，并使用有版本、带来源的折价候选列表；缺少任一必需输入时 fail closed。
2. Contribution = Revenue − 直接商品成本；Q_loss 单独报告；unitCost × Q_loss 仅为非 KPI 成本暴露，不是 RETAIL-12/RETAIL-19 的最终损耗 KPI。
3. 使用 BigInt 精确计算；结果 Money scale = 输入金额 scale + 数量小数位，禁止舍入。毛利规则必须是带来源的显式参数；候选毛利率 = Contribution / Revenue，Revenue=0 时不可判定并 fail closed。

本次决定不批准任何数值默认值，不冻结 RETAIL-12/RETAIL-19 KPI，不修改 v0.3.0 领域合同。N2 仅实施候选 Schema 与确定性规则；不进入 N3，不实现解释报告/Agent/执行。Issue #24 保持 Open / IN_PROGRESS，Project #2 保持 In Progress。
