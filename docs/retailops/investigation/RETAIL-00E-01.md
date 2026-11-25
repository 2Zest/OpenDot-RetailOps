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

## 4. 面向 RetailOps 的候选模型与边界

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

## 5. 可复用性结论

- 当前提交没有复用第三方代码、数据、测试样本或图像。
- RetailBench MIT 许可证已在固定树确认；如后续确有必要复用代码，应单独确定具体文件、保留版权与许可证声明并由维护者审查依赖/安全影响。
- Grocery Perishables Optimizer 与 Inventra 的许可未证实；当前仅引用其固定版本中的设计事实，不复制受版权保护的表达、代码或资产，也不宣称获得授权。
- 所有候选均未在本任务执行；引用的 README 结果不是本项目实测，fixture/仿真结果不代表真实零售运行。