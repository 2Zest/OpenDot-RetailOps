# RETAIL-05P（GitHub Issue #24）N3 节点回执

Issue / Plan 版本 / 节点 ID：GitHub Issue #24、RETAIL-05P-PLAN、细化 Execution Plan、N3
总体计划/PRD/ADR 版本及 SHA：已批准 RetailOps V0.2；N1 候选公式版本 retailops.markdown-calculation/0.1.0-proposal
实际 Git HEAD / worktree / 执行角色：执行分支起点 ef94bb7d5c124395d75c91a5407ccca5e99903bd；D:/workSpace/codeAgent/OpenDot-RetailOps-05p / feat/retail-05p / Domain Calculation Agent
依赖 Issue 状态、合并 SHA、证据：#19 / PR #86 merge SHA 8ca176ff3f9e5990b6c2487e41be2953e682c192，领域合同 v0.3.0；#14 / PR #83 merge SHA d3b402945ace1da4cd9e032690a394526079d09b；依赖状态沿用 N0/N2 回执
允许修改路径与实际 diff：仅 apps/retailops/src/domain/decision/markdown-calculation.ts、apps/retailops/test/unit/decision/markdown-calculation.test.ts、apps/retailops/test/contract/decision/markdown-calculation.test.ts、本 N3/N4/N5 回执及 docs/retailops/plans/RETAIL-05P-EXECUTION-PLAN.md；未改 #20 文件、领域基础合同、依赖配置、总体计划或 DAG。
预期输出/标准：精确模拟收入/直接成本/贡献与报损暴露；来源、策略版本、场景、快照、单位、公式与假设可追溯；非法、不确定输入 fail closed；schema 拒绝相互矛盾或数值不一致的结果。
实际输入/输出/行为/命令与退出码：下列实际测试与输出均由 WSL Ubuntu 24.04 / Node v24.22.3 / npm 11.19.1 执行；定向命令退出码 0，2 个测试文件、19 项通过。
证据路径、数据来源、运行模式（静态/fixture/测试/真实模型/真实 runtime）：实现与测试使用人工合成 SIMULATED fixture；无真实数据、模型、Runtime、数据库或业务副作用。来源引用字段由合同验证，不以 fixture 冒充经营事实。

## N3 实际实现

- CalculationSource 区分 PUBLIC_HISTORICAL、DERIVED、SIMULATED，记录 dataMeaning、unitCode、evidence IDs、观察时间、scenario id/version、policy id/revision；DERIVED 必须有方法版本及父引用。NORMALIZED_INDEX 不可直接进入价格、成本或件数合同。候选未来需求/损耗来源必须显式绑定单位和场景版本；历史计数必须先显式转换为 DERIVED 或 SIMULATED 场景量。
- 输入绑定精确 Policy revision、Scenario 版本、批次证据、asOf 与输入快照。observedWindow 必须在 asOf 前结束；simulationWindow 必须从 asOf 之后开始。所有 PUBLIC_HISTORICAL 来源都必须处于观察窗、不晚于 asOf/输入快照。历史数据和未来仿真被分开表达。
- 每项候选新增必填 demandAssessment: ADEQUATE | UNCERTAIN。此字段是对 N1“需求不确定则该候选不可计算”的最小合同明确化；无默认值、无概率阈值。字段缺失返回 NOT_COMPUTABLE；UNCERTAIN 输出 REJECTED / DEMAND_UNCERTAIN、metrics: null。结果 schema 交叉验证此约束。
- 对输入 BigInt/Schema 前置技术维度界限：最多 128 位十进制输入、Money/Quantity scale 最大 18、候选最多 128、证据引用数组最多 256、对象节点最多 4096、累计文本最多 262,144 字符；产出金额限制 260 位与 scale 36（128 位金额乘 128 位数量的最坏位数空间）。这些是解析/内存安全上限，不是业务售价、库存、毛利或 KPI 阈值。每个会转 BigInt 的金额 refinement 都先检查合法字符串、位数和 scale。
- 结构化指标：模拟售出量 min(openingQty, Q_demand)；售后余量 openingQty - sold；显式报损量 Q_loss；期末余量 afterSales - Q_loss（报损超余量时不生成非法负数量，endingQty 为 null 并拒绝）；收入 price × sold；直接商品成本 unitCost × sold；Contribution=Revenue - directProductCost；unitCost × Q_loss 单独报告为模拟成本暴露。
- 结果回显原候选列表及各候选 demand/loss 数量和来源，并以 inputOrdinal 将排序后的结果映射回来源输入。结果 schema 校验 candidate status / hardRulesPassed / reasonCodes / proposedPrice / overall status 的一致性，数量守恒、sold ≤ demand，以及收入、直接成本、贡献、报损成本暴露与输入数量/金额的 BigInt 恒等式。
- 每个结果带公式版本、公式说明、来源快照、显式假设、精度规则；Money scale=最大输入金额 scale + 数量 scale，不舍入；Contribution 可为负，非负显式毛利阈值仍拒绝该候选。businessApproval=REQUIRED、executionAuthority=NONE；最终损耗 KPI 和真实价格因果均不声明。

## 测试与历史结果

| 命令/阶段 | 退出码 | 结果 |
|---|---:|---|
| 首轮红测：npm test -- test/unit/decision/markdown-calculation.test.ts test/contract/decision/markdown-calculation.test.ts（实现前） | 1 | 2 文件、17 项；12 fail / 5 pass。失败对应新增输入上下文、完整指标、来源绑定、输出一致性等合同尚未实现；保留原 N2 测试。 |
| 定向复测：同一命令（N3 修复后） | 0 | 2 文件、19 项通过，覆盖旧 12 项及精度、来源、时间窗、状态一致性、金额恒等式、显式需求确定性。 |
| npm run typecheck | 0 | tsc -p tsconfig.test.json --noEmit 通过。 |
| npm run build | 0 | 包生产 TypeScript build 通过。 |
| npm test | 0 | 5 个测试文件、45 项通过（包含原领域合同测试）。 |

- 开发期间曾有一次定向运行失败，原因是新增金额恒等式校验引用了错误变量 loss；更正为 lossInput 后复跑通过。早期 typecheck 报告测试断言未收窄 inputSnapshot 可空类型；改为可选链后复跑通过。以上均为实现过程记录，当前结果已绿。
- 结果 schema 的非法 minorUnits 数值/空值和 4096 位字符串回归调用 safeParse 并断言不抛异常；输入侧也覆盖 4096 位超限但仍低于总文本限制的金额，以及错误 minorUnits、非法 scale、极大数量和超候选维度。
- 非负候选毛利阈值 fixture=0；成本高于收入时仍回显负贡献并拒绝。负数最低贡献金额合同输入被拒绝，未以负阈值掩盖负贡献。
- N3/N4 无真实数据、真实模型、Agent、MCP、Runtime、数据库或业务副作用运行。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 PASS/DEVIATION/BLOCKED |
|---|---|---|---|
| PRD / 总体计划 | 可解释模拟不被描述为现实因果；硬规则和权威证据优先 | 结果标记 SIMULATED、公式和来源，最终 KPI 为 NOT_CLAIMED、因果为 NOT_ESTABLISHED；业务审批 REQUIRED 且执行权限 NONE | PASS |
| Issue / Plan | 参数显式、有来源；数量/金额精度保持；不扩入数据库或 Runtime | 来源、策略/场景版本、快照、公式/指标均在纯领域计算合同；需求 UNCERTAIN 明确拒绝；没有修改基础合同或依赖 | PASS |
| N3/N4 节点验收 | 完整结构化结果、可复现测试、边界 fail-closed | 指标、来源映射、BigInt 精度和状态交叉校验由 19 项定向测试及 45 项全包测试验证 | PASS |

偏差 ID / 影响 / 根因 / 修订措施：N3 复核发现原 N2 输入未表达需求确定性；根据 N1“不确定需求不可计算”增加最小必填 demandAssessment，无概率参数；补充 UNCERTAIN 拒绝与缺字段测试。未改变 PRD、Issue 目标、DAG 或业务默认值。
复测结果与回归范围：定向 19/19、包 build、typecheck 及完整 45/45 测试通过。
尚未验证项与风险：N5 文档检查、差异检查、最终文件范围审查和 PR 交付尚待完成；测试数据全部为合成 fixture，不是业务/模型效果证据。
决定：N3 与 N4 通过，继续 N5 静态验收与交付。
审核者及时间：执行 Agent，2026-11-27；独立主控审查待 PR。

## PR #88 最终针对性修订（追加记录，不覆盖上述历史结果）

独立 Review 复核发现：原 260 位输出上限未计入金额与数量共同放大到统一 scale 的零位扩展。该数值仅代表上一版候选实现；当前技术界限为输入 Money/Quantity 均最多 128 位、scale 最多 18；归一化整数分别最多 146 位；精确乘积最多 292 位。因此 `MAX_OUTPUT_DIGITS = 2 * (MAX_DIGITS + MAX_SCALE) = 292`，输出金额 scale 最大 36。统一数量 scale 后，输出 Quantity 最多 146 位、scale 最大 18。所有限制均为解析/资源边界，不是业务阈值。

- `checkQuantityConservation` 的统一 scale 现包含 opening、simulated demand、sold、remaining、loss 与 ending；覆盖 `opening=10, demand=10.5, loss=0` 及 `1.2 / 1.25 / 0`。
- DATE_ONLY snapshot 与历史来源边界按其明确业务时区，将 capturedAt instant 转成该时区日历日；不再截取 ISO 字符串前十位。回归覆盖 Asia/Kolkata、America/Los_Angeles、跨日与等价 `+05:30` offset 时间戳。
- 结果快照保留完整 batch 和 asOf，以及折价列表 policy/source 元数据。Result schema 校验输入快照、batch、asOf、opening、policy revision 和来源绑定；`inputOrdinal` 必须构成 0..n-1 的唯一全排列。
- Result schema 从保留的原始输入重新判定售卖资格、质量、效期、库存、币种、单位、折扣上下限、售价底线、毛利和损耗边界，并校验候选原因数组；CALCULATED 必须通过全部硬规则、数量守恒且有非空 endingQty。schema refine 仅在已验证数值界限内执行 BigInt，不使用 catch-all 屏蔽异常。
- 所有新增回归仍是合成 fixture；没有改 v0.3.0 基础合同、政策阈值、业务默认值、KPI、因果声明或下游功能。

本轮新增测试的首轮红测见 N4 追加记录；修订后定向 24/24 通过，完整包 50/50 通过。
