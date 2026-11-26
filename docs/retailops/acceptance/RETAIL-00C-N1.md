# RETAIL-00C N1 节点验收回执

## 节点目标与实际动作

对照已批准 V0.2 总体计划/场景与旧 V0.1 候选路线图，明确冲突处理并建立当前路线图索引。阅读对象为 `docs/retailops/RETAILOPS-ROADMAP.md`、`RETAILOPS-MASTER-PLAN-V0.2.md`、`RETAILOPS-SCENARIO-V0.2.md` 与 RETAIL-00C Plan。

| 主题 | V0.1 历史提案 | V0.2 决定/状态 | 处理 |
|---|---|---|---|
| 经营主目标 | 商品比价、竞品价格、叠券等优先事项 | 单店生鲜临期损耗治理；以一 SKU、一临期批次作首条切片 | V0.1 保留作历史，不带入当前目标 |
| 门店边界 | 跨店调拨及多店/区域能力曾列入路线图 | V0 聚焦一家门店；V1 再评估多 SKU 与补货；跨店不在本轮范围 | 旧内容保留，不作为 V0.2 承诺 |
| 库存/订单 | 未冻结共享库存与订单状态合同 | 总体场景把线上预占/完成/取消及线下销售共享库存放在 V1；V0 领域模型先冻结单店单 SKU/批次规则 | 实现留给下游 Issue，当前只定义需求边界 |
| 数据证据 | 旧路线图没有明确来源层级 | 区分 PUBLIC_HISTORICAL、DERIVED、SIMULATED、LIVE_DEVICE；公开历史数据不是真实单店库存/成本/件数 | 明确标识，限制推断 |
| Agent 与风险 | 旧内容未给出足够的产品级运行门槛 | 保留 MCP 精确调用审批、独立风控与人工批准的分工；00F BLOCKED 和 Durable/Handoff 真实验证门槛继续有效 | 不把调查或 fixture 结果升级为运行验收 |
| 当前状态 | 标题/内容标为候选，起始 HEAD 过期 | 2026-11-25 G0 已批准；具体任务状态以 GitHub 及合并记录为准；00C 正在架构定稿且 N4 待审批 | 新增当前索引，不重写历史段落 |

## 修改文件及证据

- 修改 `docs/retailops/RETAILOPS-ROADMAP.md`：只在文件首部增加 V0.2 当前路线图和与历史内容的分隔线。
- 未删除或改写分隔线以下的 V0.1 历史原文；未修改旧版 `docs/retailops/RETAILOPS-ARCHITECTURE.md`。
- 实际检查：`Get-Content docs/retailops/RETAILOPS-ROADMAP.md -TotalCount 24`、`Get-Content docs/retailops/initial-plan-v0.2/RETAILOPS-MASTER-PLAN-V0.2.md` 与 `Get-Content .../RETAILOPS-SCENARIO-V0.2.md`。这是文档读取/对照，不是产品测试；N5 检查尚未执行。

## 三层语义一致性

1. 总体计划与场景：以单店临期损耗为 V0 核心，V1 多 SKU/补货分阶段；严格保留真实/公开历史/派生/仿真边界。**PASS**。
2. Issue 与 Plan：输出包括更新路线图；排除旧比价、叠券、跨店任务；不实施业务代码。**PASS**。
3. N1 节点标准：冲突处置表已形成，旧内容历史保留，新索引明确状态权威来源。**PASS**。

## 阻塞与结论

未验证：N5 `npm run docs:check` 与 `git diff --check` 留待 N4 获批后执行。N1 结论：**PASS**，可进入 N2 文档定稿。
