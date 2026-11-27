# RETAIL-03（GitHub Issue #22）N1 节点验收回执

日期：2026-11-27
状态：PASS
RETAIL 编号：RETAIL-03；GitHub Issue #22
分支：`feat/retail-03`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-03`
集成基线：`d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；分支同步提交：`0344532e58fa545029818e25db3ce6ab0a6bdbe7`

## 目标、范围与实际动作

- 目标：建立 V0 单抽象门店/单 Product/单临期 Batch 的仿真输入合同与测试情景，显式绑定场景、库存、价格、成本和各类事件来源。
- 在 `apps/retailops/src/domain/simulation/simulator.ts` 定义严格的输入 Schema。每个输入要求 `SIMULATED` 来源及完全匹配的 scenario ID/version；seed、模拟 clock、horizon、scenario version、库存批次、需求/到货/报损/价格动作均由调用方显式提供。
- 在 `apps/retailops/test/fixtures/simulation/single-sku-scenario.ts` 创建仅用于测试的合成 fixture，单独提供经 RETAIL-05P 合同计算的折扣候选。Fixture 数值不是生产默认参数。
- 没有引入随机需求分布或模型；未批准价格弹性/业务阈值保持未设置。seed 在输入/输出记录以便场景复现，需求量由场景显式输入。
- 实际源码证据：`simulationInputInnerSchema`（`simulator.ts:66`）、SIMULATED source schema（`simulator.ts:35`）、fixture `singleSkuScenarioFixture`（`single-sku-scenario.ts:23`）。

## 实际检查

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm --prefix apps/retailops run typecheck`（WSL Node 24.22.3/npm 11.19.1） | 0 | 包 TypeScript 检查通过。 |
| `npm --prefix apps/retailops test -- test/unit/domain/simulation/simulator.test.ts` | 0 | 1 个测试文件、11/11 通过。 |

## 三层语义一致性

| 对齐层 | 预期语义 | 实际事实与证据 | 判定 |
|---|---|---|---|
| 总体计划/PRD/场景 | V0 单 SKU 单批次；公开历史、派生、仿真严格区分 | 输入只接受 SIMULATED 事件与 scenario；没有读取或换算 FreshRetailNet | PASS |
| Issue #22/原 Plan/Execution Plan | 显式 seed/clock/horizon、来源、事件 ID；不增生产默认值 | schema 对来源、时间、数量、单位、事件 ID/顺序作约束；fixture 仅为测试输入 | PASS |
| N1 节点标准 | 初始批次/需求情景来源为 SIMULATED，输入可追溯 | fixture 和输入 schema 校验通过；定向测试 10/10 | PASS |

偏差：无。
未验证：本节点未执行全包 build、全包回归；留待 N5。
结论：PASS，继续 N2。
