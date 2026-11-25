# RETAIL-00E-01 单店经营开源业务研究

状态：研究报告｜证据级别：固定版本源码与文档静态审阅；没有运行候选项目，也没有复用其代码、数据或资产。

## 1. 任务与证据基线

- GitHub Issue：[#12 RETAIL-00E-01](https://github.com/2Zest/OpenDot-RetailOps/issues/12)，执行开始时 Open、READY、未分配；本次获用户授权后由主控标记 IN_PROGRESS，未认领给个人。
- 集成基线：`develop/retailops`，`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`。总体计划批准记录固定在 `08679239c1e9959f465e74f1b191085ce86c2c4b`，G0 已解除。
- Worktree：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00E-01`；分支：`codex/retail-00e-01-research`。
- 本次对照的仓库文件都来自基线 HEAD：Master Plan blob `f4baf060fc335a2844b8bf783c2f044cb3b89170`；Scenario `88ec6f760ad92fbd071dc1cea86685bf9dc15b79`；DAG `b998e8a186a8ae0e6c28468a76377ee3cb66daa2`；Issue 契约 `7a4e2e8656f4f961a722b18f12f1d04be0b07ed5`；执行 Plan `0ea7de32a4039a4057d54fd3a5ce31c4d592fb41`；节点回执模板 `e276079adc8678ee4366d43e90f3f765156a5bb3`；审批回执 `7b841510a3db670a6396d1c731a863c37d1345a2`。
- Issue #12 在 DAG 中没有硬上游；直接下游是 #14 `RETAIL-00C` 和 #22 `RETAIL-03`。本报告不解锁下游。

## 2. 固定候选版本与许可核对

| 候选 | 固定仓库版本 | 许可证据 | 本任务处理 |
|---|---|---|---|
| RetailBench | [README](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/README.md)、[LICENSE](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/LICENSE)，HEAD `f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3` | 固定树有 `LICENSE`；README 声明 MIT。 | 只研究其单店交互仿真与长期评估；未复制代码或数据。MIT 是潜在复用条件，不是本任务的代码移植授权。 |
| Grocery Perishables Optimizer | [README](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/README.md)、[`gp/world.py`](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/world.py)、[`gp/engine.py`](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/engine.py)，HEAD `0355b850d8b16213400c2a8eba0adb19a40b593b` | 固定树未找到 LICENSE/COPYING/NOTICE，README 未见许可授予；GitHub license API 未识别许可证。 | 仅概述公开展示的业务设计；不复制代码、数据、文档片段或图像。许可状态解决前不纳入代码/资产复用候选。 |
| Inventra | [README](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/README.md)、[`submission/design.md`](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/design.md)，HEAD `3645db24433a0fb6117481a18c9fefced2ad6617` | 固定树未找到 LICENSE/COPYING/NOTICE，README 未见许可授予；GitHub license API 未识别许可证。 | 仅研究显式审批、规则与模型职责边界；不导入其 LangGraph、SQLite 或其他运行时代码，不复制资产。 |

三个 HEAD 由 `git ls-remote <repo> HEAD` 取得；公开 GitHub REST 树及固定 SHA 的 README/源码用于确认文件路径与许可。RetailBench 是 MIT；另外两项许可未证实，应按不可复用代码处理。该结论只描述本次固定版本，不推断仓库作者的其他授权。

## 3. 业务、仿真与审批设计发现

### RetailBench：长期反馈仿真

固定 README 将其描述为工具驱动的单店超市长期基准：Agent 读取库存、补货、供应商和价格等状态，采取状态变更动作，并根据销售、退货、评价、库存老化、供应商变化和现金流获得延迟反馈；环境同时涵盖补货、损耗、缺货和客户反馈。可借鉴的是把决策质量放在多期业务结果中评估，而不是只评一条即时回复。它是研究型零售环境，不等同于 RetailOps 的生鲜批次业务或可接生产的数据源；它的总体财富/供应商策略不应直接映射为本项目 KPI。

### Grocery Perishables Optimizer：批次、损耗与不确定性

固定 README 与 `gp/world.py`、`gp/engine.py` 显示其将每日需求、库存批次、温度暴露、货架寿命、销售、过期/腐损、折扣和补货放进仿真闭环。模型区分真实需求与缺货截断后的销售，以模拟真值评分预测；保质期按日期与温度暴露估计；折扣规划考虑库存、需求价格响应与腐损风险；补货按需求及预计可存活库存计算。设计价值在于将库存批次和库存流转作为一等对象、区分观测销售与未满足需求，并把模型预测与仿真真值分开。

重要限制：仓库明确说明链路与数据是模拟的；价格响应和模型评估结果不能当作真实商超因果结论。其 README 也指出折扣弹性来自有限且混杂的历史折扣，模型可能输给简单固定折扣；因此未来评估必须保留无折扣、固定策略等基线并做敏感性分析。无许可证进一步排除其代码/资产复用。

### Inventra：确定性约束和人工审批

固定 README 与 `submission/design.md` 描述单 SKU/仓库补货提案流程：Agent 只负责受限判断与解释，确定性代码计算数量/成本/日期、执行硬性预算/新鲜度/期限约束；提案由具名人员审批，审批后再次读取关键事实，校验提案摘要并幂等写入。它提供“LLM 不作权威算术”“审批绑定提案版本”“审批后重新核验事实”的设计参考。该系统目标是仓库补货，不是单店生鲜定价；它的业务阈值、采购字段、工作流和运行时不能直接沿用。许可未知，不能复制实现。

## 4. 固定源码证据定位

下列源码链接全部固定到本报告列出的仓库 revision，行号来自该 revision 的文件，不指向浮动分支。

| 项目与证据主题 | 固定源码 / 符号 / 行号 | 审阅结论 |
|---|---|---|
| RetailBench 逐日业务模型 | [`retail_environment.py::RetailEnvironment.step` L346–400](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/retail_environment.py#L346-L400)；[`module/inventory.py::Inventory.step` L65–259](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/module/inventory.py#L65-L259)；[`module/order_manager.py::OrderManager.step` L77–112](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/module/order_manager.py#L77-L112) | Environment 每步推进库存销售、资金、订单到货和时间；库存按 SKU 的逐件商品列表计算销量/缺货，适合观察多周期反馈。 |
| RetailBench 损耗与库存价值 | [`Inventory.step` 过期处理 L231–245](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/module/inventory.py#L231-L245)；[`Inventory.compute_net_worth` L333–355](https://github.com/linghuazhang01/RetailBench/blob/f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3/module/inventory.py#L333-L355) | 过期商品会从库存移除；代码注释说按进价 0.6 倍出售，但对应收入表达式乘以 0，故不能将该路径当作可信的折价回收或损耗金额实现。库存净值采用剩余保质期线性折旧，是模拟估值，不是会计口径。 |
| Grocery 仿真与需求 | [`gp/world.py::demand_mean` L83–88](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/world.py#L83-L88)；[`gp/world.py::simulate` L102–146](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/world.py#L102-L146) | 仿真产生需求与价格响应、按批次年龄售出、区分销售/缺货，并把腐损和到期余量清除；世界中的真值仅供模拟评估。 |
| Grocery 批次与策略 | [`gp/engine.py::demand_models` L98 起、`lot_table` L147 起](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/engine.py#L98-L185)；[`markdown_dp` L247–273](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/engine.py#L247-L273)；[`score` L278–284](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/engine.py#L278-L284) | 按缺货截断销售拟合需求、用腐损/到期标签估寿命；动态规划按折扣与腐损风险选价。评估将腐损、到期、损耗成本、毛利、未满足需求分开计算。 |
| Grocery 审批边界 | [`gp/api.py` 角色权限与深折扣阈值 L22–27](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/api.py#L22-L27)；[`markdown` 规划及 `approve_markdown` L365–417](https://github.com/mrrishit909/grocery-perishables-optimizer/blob/0355b850d8b16213400c2a8eba0adb19a40b593b/gp/api.py#L365-L417) | 规划者可提出折扣，40% 及以上折扣需要 store_manager 权限且不得由同一 planner 自批；此为该模拟项目的设计，不自动适用于 RetailOps。 |
| Inventra 业务风险与人审 | [`tools/inventory.py::calculate_stock_risk` L156–218](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/tools/inventory.py#L156-L218)；[`graph/economics.py::required_quantity` L168–191、`evaluate_options` L409–702](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/economics.py#L168-L702)；[`nodes.py::review_policy` L791–852、`request_approval` L859–871](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/nodes.py#L791-L871)；[`workflow.py::_await_approval` L99–114](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/workflow.py#L99-L114) | 单 SKU/仓库现货风险和订货量/供应商方案由确定性代码计算；策略审查中代码强制硬性拦截，图节点以 interrupt 暂停并要求审批决定。审批载荷包括提案 hash 和数量/成本。 |
| Inventra 再校验与幂等 | [`revalidation.py::revalidate_proposal` L29–66](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/revalidation.py#L29-L66)；[`nodes.py::revalidate` L1109–1117、`execute_purchase` L1120–1145](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/nodes.py#L1109-L1145)；[`hashing.py::compute_proposal_hash` L12–24](https://github.com/Balaastratech/Inventra/blob/3645db24433a0fb6117481a18c9fefced2ad6617/submission/graph/hashing.py#L12-L24) | 执行前重查库存时效、当前报价、预算及 proposal hash，写入以 hash 为幂等键。该仓库没有生鲜批次寿命仿真证据。 |

## 5. 可用 / 不可用与复用边界矩阵

| 候选 | 可提供的参考 | 不适用或不可据此推断 | 许可与复用边界 |
|---|---|---|---|
| RetailBench | 单店多周期决策反馈；SKU 库存/订单/销售/缺货演进（见 `RetailEnvironment.step`、`Inventory.step`、`OrderManager.step`）；MIT 许可文本可核对。 | 不直接提供 RetailOps 所需的批次级温度暴露/生鲜寿命统计或可直接照搬的人工审批契约。其过期处理注释与收入表达式不一致，库存净值也不是损耗会计；不得将其数字作为本项目验收口径。 | MIT 允许的潜在代码复用仍需后续单独审查文件、NOTICE/署名、依赖及接口；本 PR 只引用，不复制代码或数据。 |
| Grocery Perishables Optimizer | 批次年龄/暴露、需求受缺货截断、腐损与到期拆分、折扣规划及 store-manager 深折扣审批；适合为仿真契约提供候选事件和指标。 | README 明示链、数据与真值均为模拟；模型性能、弹性、收益不是真实因果结论。不能直接给出本项目的价格弹性、寿命阈值或生产 SLA。 | 固定版本未发现许可证授权；仅可作事实性概念参考，不复制其实现、数据、测试、文档表达或资产。 |
| Inventra | 确定性算术/硬规则、具名审批、批准后读新鲜事实、hash 绑定提案和幂等写入；适合参考审核流程边界。 | 目标是仓库补货而非零售生鲜；不含按批次过期/损耗的模拟闭环。其模型/代理/数据库栈不能替代 OpenDot/RetailOps 架构，仓库内的“live-tested”表述不是本项目证据。 | 固定版本未发现许可证授权；仅作设计层面的概念引用，不复制其代码、提示词、数据或资产。 |

## 6. 可供 #14 与 #22 评审的候选输入

以下内容是研究建议，不是合同冻结或实现指令；#14 和 #22 仍应按各自 Issue、DAG 与批准的领域 Schema 决定是否采纳。

| 接收任务 | 可讨论的输入 | 验收边界 |
|---|---|---|
| #14 `RETAIL-00C` PRD / 领域架构 | 定义单店共享物理库存、SKU 批次、在线预占与可售量的不同口径；把收货、POS 销售、线上完成/取消、报损、过期作为不同事件；公开历史/派生/仿真数据分层；明确价格响应是假设并记录策略版本/审批人。 | 仅作业务词汇与不变量候选；不由本报告定字段、阈值、API、权限接口或最终架构。 |
| #22 `RETAIL-03` 单 SKU 经营仿真器 | 固定 seed/clock；区分 `on_hand`、`reserved`、`available`；逐事件更新账本；同 seed 可重放；拆分售出、报损、到期及未满足需求；比较原价/折扣方案时记录价格生效窗口。Grocery 的 `world.simulate`/`engine.score` 可提供候选指标名称；Issue #22 的重复事件、负库存、到期停售测试应留作硬验收项。 | 只服务临时数据库内的确定性仿真，不开放 Agent 直接写入口、不连接真实零售系统；库存守恒与数据分类由 #22 自己落实和测试。 |

## 7. 面向 RetailOps 的候选模型与边界

以下是供后续 #14 `RETAIL-00C` 领域契约讨论的候选，不是已冻结 Schema 或实现要求：

1. **库存与批次**：单店共享库存按 SKU 汇总、按批次追踪；批次记录到货量、剩余量、单位、日期、质量状态及来源。将“物理在手”“线上预占”“可售量”分开，避免把预占错误地记成出库。
2. **库存事件**：以收货、POS 销售、线上预占/完成/取消、报损、过期、盘点调整记录变化。释放预占只改变可售量；完成订单才减少在手量。过期/质量异常为确定性不可售条件，折扣或审批不得覆盖。
3. **需求与仿真**：公开历史、派生数据、仿真状态分别标记；缺货日销售是需求下界而非完整需求。仿真价格弹性必须标为假设/情景，并与历史预测指标分开评估，不声称因果或生产收益。
4. **策略与审批**：策略、价格、授权和数据新鲜度应有版本与证据；执行前按草案版本重新核对库存、批次和策略，审批人绑定具体草案；结果未知时对账，不能盲目重试。此为方向建议，不能取代 #00C 对合同、权限和架构的正式决定。
5. **评价**：每个仿真固定初始状态、需求情景和随机种子；对照无折扣、简单折扣及策略方案，分别报告毛利口径、废弃量、缺货率与需求满足率。指标只说明仿真结果，不宣称真实业务效果。

### 手算库存守恒与损耗（合成示例）

假设单个 SKU 初始在手 100 件，当日收货 40 件；POS 售出 55 件、线上订单完成 5 件、报损 3 件、过期报废 10 件。线上曾预占 8 件，其中 5 件完成、2 件取消、1 件仍待完成。则：

- 期末物理在手 = 100 + 40 − 55 − 5 − 3 − 10 = **67 件**。
- 期末预占 = 8 − 5 − 2 = **1 件**；可售量 = 67 − 1 = **66 件**。
- 当日损耗 = 报损 3 + 过期 10 = **13 件**。若单位成本假设为 8 元，则库存成本损失 = 13 × 8 = **104 元**，未计处置费用或残值。
- 取消订单只释放预占，不增加物理在手；模型若再次把取消数记作入库会错误地得到 69 件。

该例为手算数据，用于校验事件口径，不来自候选仓库或真实商店。

## 8. 可复用性结论

- 当前提交没有复用第三方代码、数据、测试样本或图像。
- RetailBench MIT 许可证已在固定树确认；如后续确有必要复用代码，应单独确定具体文件、保留版权与许可证声明并由维护者审查依赖/安全影响。
- Grocery Perishables Optimizer 与 Inventra 的许可未证实；当前仅引用其固定版本中的设计事实，不复制受版权保护的表达、代码或资产，也不宣称获得授权。
- 所有候选均未在本任务执行；引用的 README 结果不是本项目实测，fixture/仿真结果不代表真实零售运行。
