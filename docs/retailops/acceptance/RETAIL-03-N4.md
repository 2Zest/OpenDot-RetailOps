# RETAIL-03（GitHub Issue #22）N4 节点验收回执

日期：2026-11-27
状态：PASS
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 目标、范围与实际动作

- 目标：提供可由事件账本手算复核的需求、销量、未满足需求、到货、显式报损、未售/期末库存、模拟收入、直接成本、贡献及报损成本暴露。
- 所有数量字符串转 BigInt 后在统一数量 scale 运算；Money 使用 BigInt 与明确的 money/quantity scale 相乘和累加，不使用浮点或隐式舍入（`simulator.ts:343-579`）。
- 收入按每个销售事件生效的模拟单价计算；直接成本按显式合成 unitCost 计算；贡献可以有符号。报损成本标为 exposure，不定义 RETAIL-12/RETAIL-19 最终损耗 KPI。
- 输出 Schema 重核数量守恒、总需求拆分、收入减直接成本等于贡献、单币种及金额精度（`simulator.ts:205-308`）。结果声明 `realPriceCausality=NOT_ESTABLISHED`、`finalLossKpi=NOT_CLAIMED`。
- 手算定向例：单价 7.00 CNY、成本 5.00 CNY、销售 0.375 EA 时，收入 2.625、直接成本 1.875、贡献 0.750；输出以 minorUnits `262500` / scale `5`、`187500` / scale `5`、`75000` / scale `5` 精确保留。

## 实际检查

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3/npm 11.19.1） | 0 | 类型检查通过。 |
| `npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts` | 0 | 价格精度/贡献、库存守恒和结果字段验证包含在 11/11 定向测试中。 |

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| 总体计划/Architecture | 仿真结果不冒充真实门店效果、真实价格因果或正式 KPI | 输出显式 SIMULATED，声明未建立因果和未主张最终损耗 KPI | PASS |
| Issue #22/RETAIL-05P | 候选计算指标来源明确、精确数量/金额，不绕过原硬规则 | 使用 RETAIL-05P 已验证候选合同；模拟指标独立从事件账本计算 | PASS |
| N4 节点标准 | 指标可手算一致并分离未售、报损、销售及金额 | 手算 0.375 EA 案例与输出一致，完整不变量校验通过 | PASS |

偏差：无。
未验证：指标是显式合成输入的模拟结果，不是公开数据拟合或真实经营结论。
结论：PASS，继续 N5。
