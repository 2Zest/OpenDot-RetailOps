# RETAIL-05P N1 公式与决策说明（候选）

状态：N1 设计候选，等待主控核验。下文公式是执行计划内的待审方案，不是已冻结生产规则、KPI 或业务参数；本节点没有实现算法或写测试代码。

## 1. 来源及边界

- 批准 PRD 0.2：PRD-R02 至 PRD-R06 要求批次资格、库存守恒、来源标注和可解释候选；“候选业务指标”一节明确公式尚待审批，需分别呈现模拟售出量、报损量、剩余量、收入/成本/毛利估计；成本来源、单位、舍入、折价弹性、无动作基准与时间窗不得擅自冻结。参见 docs/retailops/initial-plan-v0.2/RETAILOPS-PRD-V0.2.md 第 22–25、50–56、91–100 行。
- D02（DECISIONS-PENDING.md 第 25 行）：数量单位、换算、精度/舍入及时区仍待责任任务决策。
- D04（第 27 行）：折价步长/上限、最低价/毛利及适用时段数值未冻结。
- D05（第 28 行）：最终损耗目标、公式、分母、反事实基准、报告单位由 RETAIL-12/RETAIL-19 冻结。
- D06（第 29 行）：需求响应、替代性、弹性及不确定性仍未冻结；不得声称仿真输入证明真实价格因果。
- v0.3.0 合同：apps/retailops/src/domain/shared/primitives.ts 提供 Quantity、Money；apps/retailops/src/domain/expiry/expiry.ts 的 assessSellability 必须返回明确 ELIGIBLE 才可继续。领域文件只读。
- GitHub Issue #24 只授权纯确定性测算和候选结果合同，不含实际价格执行、审批服务、LLM、数据库或 Runtime。

## 2. 候选输入合同

每次测算限定一个 SKU / 一个批次 / 一个明确场景。以下参数全部由调用方显式提供并附来源引用；不得在实现中补缺省价格、成本、需求、损耗、单位、时间窗或政策值。

| 输入 | 候选语义 | 缺失/冲突处理 |
|---|---|---|
| 批次合同、AsOf | v0.3.0 Batch、日期/时间及时区；用于 assessSellability | schema 非法、质量非 PASS、过期或效期边界未解析时阻断；不得降级为可售 |
| Q_open | Batch.stockBalance.availableToSell，Quantity 与 unitCode 原样保留 | 数量不合法、单位不一致或小于/等于零时拒绝候选 |
| basePrice / unitCost | 每售出单位的价格与直接商品成本，Money，含 currencyCode、minorUnitScale、来源快照与数据层 | 缺失、负成本、币种冲突、来源未知时不可计算 |
| candidateDiscountAmounts | 显式、有限的折价金额列表，来自有版本 Policy/Scenario 输入且带 policy revision / Evidence 引用 | 不自动生成默认折价阶梯；列表缺失、重复、非正、超过显式上限或使售价低于显式最低价时标记无效/拒绝 |
| Q_demand,i | 每个价格候选单独提供的场景需求量，Quantity，带 source layer、场景/参数版本及 Evidence 引用 | 不从公开归一化 sale_amount 推导实际件数；缺失或不确定时该候选不可计算 |
| Q_loss,i | 每个候选对应的场景报损量，Quantity，带来源和假设 | 不从剩余库存自动推断；必须显式给出，允许显式的零值；缺失时损耗量值不可计算 |
| marginConstraint | 调用方显式选择的有来源硬规则：每件最低贡献金额，或最低毛利率的有理数阈值 | 不确定其类型、值或政策来源时不得判候选通过；不得设置默认阈值 |
| horizon / asOf | 场景时间边界、日期/时区或明确 Instant | 未知时区、过期或不兼容时间语义返回不可计算/拒绝 |

v0.3.0 Policy 目前只有 contractVersion、id、revision、evidenceIds，不包含折扣字段。N1 不扩写它。上表的计算参数只能作为 #24 专属纯函数调用输入候选，并携带引用；未来 Policy 集成仍由对应 Issue 决定。

来源规则：价格、成本、初始库存和需求若是仿真值必须标 SIMULATED；按公开数据计算的量只能标 DERIVED 并保留父输入/方法版本；PUBLIC_HISTORICAL 的规范化字段不是实际售价、库存件数或成本；当前无 LIVE_DEVICE 证据。每一候选携带相同场景版本及自身价格/需求/报损来源引用。

## 3. 候选价格生成与硬约束

给定 basePrice P0 和显式折价列表 D={d1…dn}，逐项生成候选售价 Pi=P0−di。折价值以同币种、同金额精度的非负精确整数金额表示；每一项必须同时满足显式 Policy 输入的折价上限和最低售价。无有效折价候选时返回 NO_FEASIBLE_CANDIDATE，不回退到隐含默认折价或原价执行动作。重复折价值在输入校验时拒绝并给出 DUPLICATE_DISCOUNT，避免候选来源歧义。

候选检查顺序：

1. 对 batch 和输入分别运行现有 v0.3.0 Schema。Quality 必须为 PASS，expiry/asOf 必须合法且 assessSellability 为 ELIGIBLE；FAIL、UNKNOWN、缺字段、非法日期/时区、过期或效期等值边界均不生成可售候选。
2. Q_open 必须大于零；质量、效期和现有库存合同均 fail-closed。不能将 unavailable 或 reserved 计为可售量。
3. 折价候选必须落在显式折价上限和售价下限范围内，候选售价不能为负；最低价/上限缺失即无法判定，而不是认为无限制。
4. 按显式 marginConstraint 检查每件贡献金额或毛利率。候选每件贡献金额 = Pi − unitCost；如输入规则选择最低毛利率，则候选毛利率提案为 Contribution_i / Revenue_i = (Revenue_i − COGS_i) / Revenue_i。Revenue_i=0 时毛利率不可判定，返回 MARGIN_UNDEFINED_REVENUE_ZERO，不能按零或通过处理。用有理数交叉乘法判定，不用浮点或先舍入。不同阈值类型不互相推断。规则失败的候选明确记 HARD_RULE_REJECTED 和命中项，不能标为 calculation pass/executable。
5. 输入来源缺失、币种/单位冲突、需求/报损未知或时间范围不符，返回 NOT_COMPUTABLE 与具体原因。不可把未知值当零。

候选排序只按明确输入列表的折价金额升序生成固定输出次序；若后续 Policy 优先级要求不同，必须由有版本的显式输入给出，不设本地默认优先级。

## 4. 数量、收入、贡献与报损口径（候选公式版本）

建议公式标识：retailops.markdown-calculation/0.1.0-proposal。任何下游变更须增加版本，不原地重解释历史结果。

对有效候选 i：

- 开场可售量 Q_open = Batch.stockBalance.availableToSell.value；单位 u 来自原 Quantity。
- 模拟售出量 Q_sold,i = min(Q_open, Q_demand,i)。Q_demand,i 必须是本候选场景显式给出的需求量，不由本模块根据折价推断弹性。
- 售后剩余量 Q_after_sales,i = Q_open − Q_sold,i。
- 模拟报损量 Q_loss,i = 调用方显式给出的候选场景报损量，且 0 ≤ Q_loss,i ≤ Q_after_sales,i。它不能从未售库存、到期时间或缺失字段中自动推断。
- 期末余量 Q_ending,i = Q_after_sales,i − Q_loss,i。结果同时呈现售后余量和报损后余量，避免将两者混称“剩余”。
- 数量守恒：Q_open = Q_sold,i + Q_loss,i + Q_ending,i。所有量使用同一 unitCode；无包装换算。

金额：

- Revenue_i = P_i × Q_sold,i。
- COGS_i = unitCost × Q_sold,i。
- Contribution_i = Revenue_i − COGS_i。仅表示销售收入减直接商品成本；未输入的人工、租金、履约、支付、补货等成本不暗中扣除。可出现负数，沿用 Money 有符号合同。
- SimulatedLossCostExposure_i = unitCost × Q_loss,i。仅表示场景给定报损数量对应的成本暴露；不是最终损耗 KPI，不含反事实基准、损耗率分母、机会成本、折价因果效果或跨期聚合。

精度候选规则：将 Quantity 字符串解析为 decimal integer + scale；金额全部转 BigInt。先把金额按相同 currencyCode 规范到较大的输入 minorUnitScale，再将金额整数乘数量 scaled integer。结果 Money 的 minorUnitScale 提议为规范后的金额 scale + 数量小数位数，从而精确保留每件价格/成本乘数量，不舍入、不使用浮点。Contribution 按该共同 scale 作有符号 BigInt 减法。任何输入 currency/unit 不同或 scale 非法均不可计算。主控需确认：既有 Money.minorUnitScale 是否允许派生金额增精度；若必须固定货币 scale，则在舍入策略冻结前，无法精确表示的金额必须拒绝并返回 PRECISION_NOT_REPRESENTABLE，不可擅选舍入模式。

## 5. 纯手算 fixture（非业务参数）

仅用于校验 N1 公式。以下均为标记 SIMULATED / FIXTURE 的合成整数值，不是门店/SKU 参数、生产默认值、预测结果或真实折价因果证据：

- Opening stock：10 EA；unit cost：CNY minorUnits 500 / scale 2（¥5.00）。
- Base price：CNY minorUnits 700 / scale 2（¥7.00）。
- 显式折价输入：minorUnits 50 和 100（¥0.50、¥1.00）；fixture 中最低售价 ¥6.00、最高折价 ¥1.00；margin fixture 为每件贡献至少 ¥1.00。
- 两个候选的需求是独立手填 SIMULATED fixture，不表示价格导致销量变化：¥6.50 候选 Q_demand=5 EA；¥6.00 候选 Q_demand=8 EA。两个候选都显式提供 Q_loss=1 EA。
- Candidate ¥6.50：Q_sold=min(10,5)=5；售后余量 5；报损 1；期末余量 4；收入 650×5=3250 minor = ¥32.50；COGS 500×5=2500 minor = ¥25.00；贡献 750 minor = ¥7.50；成本暴露 500 minor = ¥5.00。
- Candidate ¥6.00：Q_sold=min(10,8)=8；售后余量 2；报损 1；期末余量 1；收入 600×8=4800 minor = ¥48.00；COGS 500×8=4000 minor = ¥40.00；贡献 800 minor = ¥8.00；成本暴露 500 minor = ¥5.00。
- 守恒分别为 10=5+1+4 与 10=8+1+1。例中候选差异只是人为提供的需求 fixture，禁止据此声称折扣提升销量或利润。
- 计算结果状态最多是 CALCULATED / REJECTED / NOT_COMPUTABLE。即使规则通过，businessApproval=REQUIRED、executionAuthority=NONE；此 Issue 不产生可执行草案或现实业务副作用。

## 6. 集中待决事项

本节点只提交以下三组决策，所有其他数字值仍按 D02/D04/D05/D06 责任任务显式传入，不要求现在设默认：

1. **输入与候选合同**：是否批准将每个候选的需求量和报损量作为带来源的显式场景输入，缺失即 NOT_COMPUTABLE；折价候选由调用方提供版本化折价列表，本模块只计算 base−discount 并执行显式上/下限。需求响应/弹性留给拥有相应证据的下游任务，不从价格差异推断。
2. **中间指标口径**：是否接受 Contribution = Revenue−直接商品成本；同时报告独立的 Q_loss 和 SimulatedLossCostExposure=unitCost×Q_loss。该暴露只服务当前候选解释，不是 RETAIL-12/RETAIL-19 的最终损耗 KPI、分母、反事实、价格因果或业务 uplift。
3. **精度与毛利硬规则输入**：是否批准计算结果用 BigInt 并把 Money scale 扩展到输入金额 scale + Quantity 小数位，无舍入；毛利限制以调用方显式带来源的 tagged constraint 表达（每件最低贡献金额，或最低毛利率 = Contribution / Revenue，Revenue=0 时不可判定），必须给值才可判通过。若不接受 scale 扩展，需在后续责任节点冻结舍入合同或同意对不可表示值 fail-closed。

决策值获批准后，N2 才能实施候选 Schema 与规则；本说明不冻结任何具体货币、SKU、折价阶梯、成本、需求、损耗、毛利数值、时间窗或 KPI。
