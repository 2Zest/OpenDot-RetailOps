# RETAIL-03（GitHub Issue #22）N3 节点验收回执

日期：2026-11-27
状态：PASS
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 目标、范围与实际动作

- 目标：在仿真内部消费 RETAIL-05P 有效候选，仅于显式有效时点改变模拟价格，不赋予业务审批或执行权。
- `preparePriceAction` 使用已合并的 `markdownCalculationResultSchema` 独立复核输入；要求顶层状态 CALCULATED、目标候选 CALCULATED 且 `hardRulesPassed=true`、非空候选价格及通过原合同验证的结果（`simulator.ts:581`）。
- 对照候选快照中的 Product（由 Batch.productId 表达）、Batch、Policy ID/revision、Scenario ID/version、候选计算 asOf、生效时点与模拟 clock/horizon。拒绝失效、错配、其他场景/批次/政策或不适用的候选。
- 生效时间等于库存事件时，使用显式 sequence 决定同一时点业务事件先后；边界效期事件仍优先阻断动作。
- PR 任务内部无 Agent/Tool 注册、公开 package 导出或真实 Product/Policy 写入；结果固定 `businessApproval=NOT_GRANTED`、`executionAuthority=NONE`。

## 实际检查

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3/npm 11.19.1） | 0 | 包 TypeScript 检查通过。 |
| `npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts` | 0 | 测试验证同一时点价格序号、折扣候选价格及失效批次拒绝；11/11 通过。 |

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| 总体计划/PRD | 价格只作仿真输入，不越过独立风控/业务批准 | 输出没有批准或执行权；不连接真实商品/价格服务 | PASS |
| Issue #22/RETAIL-05P 合同 | 仅接受合同通过、绑定一致的候选和 Policy revision | `preparePriceAction` 复验结果与上下文，价格动作测试通过 | PASS |
| N3 节点标准 | 受服务内部调用、时间边界正确、不提供 Agent 工具 | 只存在领域纯函数入口；序号、效期和 UTC offset 边界定向测试 11/11 | PASS |

偏差：无。
未验证：未执行任何模型/Agent/Runtime 或真实价格动作，也不属于本节点验收。
结论：PASS，继续 N4。
