# RETAIL-03（GitHub Issue #22）N2 节点验收回执

日期：2026-11-27
状态：PASS
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 目标、范围与实际动作

- 目标：按确定性时间/序号推进单批次库存、需求、收货、报损、停售事件并返回事件账本。
- `simulateSingleSku` 与 `runSimulation` 为纯函数，没有 SQLite、网络、Harness、Durable 或真实业务写接口依赖（`apps/retailops/src/domain/simulation/simulator.ts:332,343`）。
- 同一时点按显式输入 `sequence` 排序；自动效期停止事件优先于该时点销售/价格动作；重复 event ID 和重复序号被输入 Schema 拒绝。
- 销售量为 `min(需求, 可售量)`；未满足需求单独记录。到货在可售时增加可售分区，否则增加不可售分区。明确报损只按显式数量扣物理库存；超出实物量时事件拒绝且库存不变。
- 质量非 PASS、未知或效期边界/已过期均禁止销售。过期只把可售量分类到不可售，不减少 physicalOnHand，也不计入报损。
- 定向回归覆盖到货/需求/报损组合守恒、停售边界、质量 FAIL/UNKNOWN、重复事件、超额报损及非负库存。

## 实际检查

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3/npm 11.19.1） | 0 | 包 TypeScript 检查通过。 |
| `npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts` | 0 | 1 个测试文件、11/11 通过。 |

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| 总体计划/场景/Architecture | 库存互斥分区守恒；质量/效期硬规则优先 | `runSimulation` 保持 physical/unavailable/available 三类分区，expiry 事件只变分类；测试检验守恒 | PASS |
| Issue #22/原 Plan | 重复事件拒绝、可重复账本、不可负库存 | event ID/sequence 唯一、确定排序、超量 disposal 返回 REJECTED；测试覆盖 | PASS |
| N2 节点标准 | 初始 + 到货 = 销售 + 显式报损 + 期末 | 回归示例 10 + 3 = 11 + 2 + 0；result schema 也重核守恒；11/11 通过 | PASS |

偏差：无。
未验证：本节点只执行定向单测，完整回归留待 N5。
结论：PASS，继续 N3。
