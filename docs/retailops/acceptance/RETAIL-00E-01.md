# RETAIL-00E-01 节点验收回执

Issue：[#12 RETAIL-00E-01](https://github.com/2Zest/OpenDot-RetailOps/issues/12)｜执行角色：领域研究 Agent｜工作区：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00E-01`｜分支：`codex/retail-00e-01-research`

## N0：环境、输入与范围预检

- 实际基线：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`，工作区启动时干净。
- 总体计划批准版本：`08679239c1e9959f465e74f1b191085ce86c2c4b`，APPROVED / G0 已解除。
- Issue #12 远端为 Open、READY、未分配；用户追加执行授权后主控将状态标签设为 IN_PROGRESS，未加 assignee。
- DAG：无上游硬依赖；直接下游 #14、#22。没有运行下游或改其状态。
- 允许修改路径冻结为本任务报告与回执；不改应用源码、依赖、运行时、策略或其他 Issue 内容。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 只研究单店、生鲜批次、仿真与审批参考；未越过业务/运行时范围 | PASS |
| Issue/Plan | 固定候选仓库版本，核对许可，交付研究报告与复用边界 | PASS |
| N0 标准 | HEAD、审批记录、Issue 状态、DAG 和允许文件已固定 | PASS |

## N1：来源、版本和许可

- `git ls-remote <repo> HEAD` 分别确认 RetailBench `f1d37b35abfa60ef5599e56d2cdbdaa4fd9b8bf3`、Grocery Perishables Optimizer `0355b850d8b16213400c2a8eba0adb19a40b593b`、Inventra `3645db24433a0fb6117481a18c9fefced2ad6617`。
- 按上述固定 SHA 静态读取 README、RetailBench LICENSE、Grocery 的 `gp/world.py` / `gp/engine.py`、Inventra `submission/design.md`，并用公开 GitHub REST 树核对许可证路径。
- RetailBench 固定树含 MIT `LICENSE`；Grocery、Inventra 固定树未找到 LICENSE/COPYING/NOTICE，README 未声明许可证，GitHub license API 未识别。后二者仅供设计思想参考，不复制代码/资产。
- 命令模式为远端 ref/tree/文件读取；未克隆大型数据、安装依赖或运行候选代码。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 来源固定且“候选参考不等于已复用”边界保留 | PASS |
| Issue/Plan | 三个计划候选均有 URL、HEAD、许可状态和用途说明 | PASS |
| N1 标准 | 固定版本来源清单已在研究报告记录，可复核 | PASS |

## N2：业务事件、批次和策略映射

- 静态比较单店长期反馈、批次老化/缺货截断需求/折扣测算，以及确定性业务约束与人工审批。
- 形成供 #14 讨论的候选概念，不冻结最终字段或 Schema；注明许可、模拟数据和跨领域差异。
- 手算库存守恒：100 + 40 − 55 − 5 − 3 − 10 = 67 件物理在手；预占 8 − 5 完成 − 2 取消 = 1；可售 66 件。损耗 13 件，按 8 元/件估算 104 元。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 映射覆盖单店共享库存、生鲜批次、渠道预占、损耗及模拟边界 | PASS |
| Issue/Plan | 提供候选模型与复用边界；不移植运行时/代码 | PASS |
| N2 标准 | 至少一个可逐项复核的库存守恒/损耗示例 | PASS |

## N3：风险、审批和评估

- 形成过期/质量异常 fail-closed、版本化策略、审批绑定草案、审批后复核状态、幂等与未知结果对账的候选要求。
- 将公开历史、派生、仿真分层；不把缺货受限销量当真实需求，不把模拟弹性或模拟收益当因果证据。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 保留审批、质量硬约束、仿真与真实业务分界 | PASS |
| Issue/Plan | 各借鉴项标注来源/限制，许可未知时仅作概念参考 | PASS |
| N3 标准 | 有风险/评估边界与可复核依据 | PASS |

## N4：验证与回归

- `git diff --cached --check`：退出码 0，暂存的两份文档无空白错误。
- `PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check`：退出码 1；`docs/retailops/RETAILOPS-ROADMAP.md:1` 引用了缺失路径 `planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`。这是当前基线失败，按权限和任务边界不修复。
- 候选项目测试/运行：不适用且未执行；本任务为静态调查，计划与 Issue 不要求运行第三方项目。T01 的来源/许可/关键业务例已由固定 SHA 文件核查；T02 为上述手算值。

| 对齐层 | 实际事实 | 判定 |
|---|---|---|
| 总体计划/场景 | 研究报告与手算场景满足准备阶段目标；不把模拟数据当实绩 | PASS |
| Issue/Plan | 文档回归已尝试；不修改范围外旧路线图或检查器 | PASS |
| N4 标准 | `git diff --cached --check` 通过；`docs:check` 因基线失效链接失败 | BLOCKED（既有文档引用） |

## N5：交付与限制

- 交付：`docs/retailops/investigation/RETAIL-00E-01.md` 与本回执。
- 三方语义：总体计划/场景 PASS；Issue/Plan PASS；N0–N3节点标准通过；N4文档回归因基线链接错误BLOCKED，不将整体任务标记完成。
- 未验证：第三方项目未运行；未做代码复用；Grocery/Inventra 许可需权利方补充后才能考虑复用代码；正式领域 Schema 仍需 #14 定稿。
- Issue 保持 Open，当前标签为 REVIEW；不标 DONE，不解锁 #14/#22，不合并 PR。
## PR #75 审阅补充（2026-11-26）

- 仅修订本报告与本回执；原三候选仓库、固定 revision、许可证结论和库存守恒手算场景保留。
- 报告新增固定 revision 的源码锚点，明确列出文件、符号及行号：RetailBench `RetailEnvironment.step`、`Inventory.step`、`OrderManager.step` 与 `compute_net_worth`；Grocery `demand_mean`、`simulate`、`demand_models`、`lot_table`、`markdown_dp`、`score`、`approve_markdown`；Inventra `calculate_stock_risk`、`required_quantity`、`evaluate_options`、`review_policy`、`_await_approval`、`revalidate_proposal`、`execute_purchase` 与 `compute_proposal_hash`。详细固定链接在研究报告「固定源码证据定位」表。
- 报告增加可用/不可用与许可复用边界矩阵，以及供 #14 RETAIL-00C 与 #22 RETAIL-03 评审的候选输入；候选输入未冻结 Schema、API 或实现要求。
- RetailBench 过期处理的源码注释与收入表达式不一致（注释写 0.6 倍、表达式为乘 0）；本次将此限制明确列为不可照搬项。
- 未运行第三方项目，未复制许可不明确的代码/数据/资产，未改应用源码或配置。Issue #12 保持 Open/REVIEW，PR #75 保持开放；不标 DONE、不解锁下游。
- `git diff --check`：退出码 0；本次差异仅限上述研究报告与节点回执。未重跑 `npm run docs:check`：历史路线图目标尚未合并修复，按 Review 要求待公共文档修复合并后复验。

## 公共基线合并后最终复测（2026-11-26）

- 集成基线：develop/retailops f6a7f33a3e106a19b8a3c06ee56bb87ccf4f3b61；本任务分支以普通 merge 同步，合并提交 252387bca4f4145f71c84eac52a2304fc0b8efc8，无强推。
- PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm run docs:check：退出码 0，219 个 Markdown 文件通过。
- git diff --check 与 git diff origin/develop/retailops...HEAD --check：均退出码 0；工作树干净。
- 首次在 e8db2b6 基线的 docs:check 失败记录保留；公共 PR #81 合并后的复测通过。
- 三层语义复核：总体计划/场景 PASS（静态业务研究范围不变）；Issue/Plan PASS（未运行参考项目、未复制代码或数据）；N4 节点 PASS（文档检查通过，差异检查通过）。
- N5：PR #75 保持 Open/Review、目标 develop/retailops；Issue #12 保持 Open/REVIEW、未认领；未标 DONE、不解锁 #14/#22。
