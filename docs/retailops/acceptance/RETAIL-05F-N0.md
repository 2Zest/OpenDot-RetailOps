# RETAIL-05F（GitHub Issue #23）N0 节点验收回执

节点状态：**N0 完成，等待主控核验；N1 未开始。** 本轮仅冻结计划、来源、时间切分、文件所有权和验收命令；没有实现预测算法、下载/导入真实数据、运行模型或产生评测结果。

## 执行事实

- Issue / Plan：GitHub Issue #23 RETAIL-05F；原计划 `docs/retailops/initial-plan-v0.2/plans/RETAIL-05F-PLAN.md` 保持只读；细化计划 `docs/retailops/plans/RETAIL-05F-EXECUTION-PLAN.md`。
- 总体计划/PRD/Architecture/ADR：均读取自集成基线 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；D01–D16 维持既有责任划分，未填写未批准的业务默认值。
- Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-05f`；分支 `feat/retail-05f`；操作前 HEAD `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；工作区初始干净。
- 上游硬依赖：RETAIL-02 / GitHub Issue #21 已关闭 DONE；PR #89 merge SHA 同最新集成基线 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`。数据调查 RETAIL-00E-02 / GitHub Issue #13 的报告、样本检查及固定 split 证据为只读输入。
- 本机执行环境：WSL Node `v24.22.3`、npm `11.19.1`；`gh auth status` 显示已认证账号 `2Zest`，具备 `repo` 与 `project` scope。

## 固定来源与评估边界

固定数据源为 FreshRetailNet-50K，revision `c374e85975c82816c495acfa904cc55ab14a47d3`，许可 CC BY 4.0。#21 正式契约对 train/eval Parquet、固定 JSONL 字节 hash、门店/SKU/日期覆盖及数据导入作来源验证；本任务只消费被验证的 store 0 固定快照，不提交原始样本。

固定快照摘要：train 6,660 行、eval 518 行；各 74 SKU、每 SKU train 90 天和 eval 7 天，共同覆盖 2024-03-28 至 2024-07-02。train JSONL SHA-256 `4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005`；eval JSONL SHA-256 `0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2`。N0 仅核对已合并报告中的证据，尚未在本 Worktree 重取或实际导入，不把旧快照报告冒充本轮导入结果。

计划固定的评估顺序是每个 SKU 原 train 前 76 天训练、后 14 天验证，官方 eval 原 7 天留作最终测试；训练/验证/测试按时间前后切分，不打乱。正式实现须防止验证/测试目标或标签泄漏到该日预测输入，测试不参与候选选择。指标为归一化单位 MAE/WAPE；零 WAPE 分母返回结构化未定义，空配对/短序列/缺失值明确报告，不能补零或静默丢弃。

朴素基线冻结为训练窗口有效历史 `sale_amount` 算术均值。缺货候选包括未修正观测基线、仅用无缺货日观测的筛选估计；小时可用性外推仅当原字段映射和覆盖条件有来源证据时可运行，否则标记 NOT_RUN/BLOCKED。它们均为归一化历史估计，不构成真实需求恢复、因果价格效果、实物数量或经营 KPI。

## 文件范围与隔离

本轮实际修改路径仅为细化执行计划和本回执。后续实现候选精确路径、owner 与限制记录在执行计划：`apps/retailops/src/domain/history/demand-estimation.ts`、对应单元测试、`scripts/retail-05f/evaluate-fixed-snapshot.mjs`、完整验收报告；须等主控核验 N0 后方可开始。#22 使用独立 Worktree/分支并拥有仿真域路径，不与上述文件重叠。

`apps/retailops/package.json`、锁文件、根配置、基础领域合同、#21 来源/导入/SQLite 适配器和 migration-runner 均只读。#23 不拥有 migration lock，不改共享注册入口，不新增依赖，不提交 `data/**`、Parquet、JSONL、SQLite 或大型原始样本。

## 实际命令和结果

| 命令 | 环境/退出码 | 结果 |
|---|---|---|
| `git status --short --branch`、`git rev-parse HEAD` | Windows PowerShell；0 | `feat/retail-05f`；HEAD 为基线 `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；N0 编辑前工作区干净 |
| `node --version`、`npm --version`、`gh auth status` | WSL；分别 `v24.22.3`、`11.19.1`、0 | Node 24/npm 11 已安装；GitHub CLI 认证可用 |
| `npm run docs:check` | WSL Node 24；0 | 仓库 275 份 Markdown 通过 |
| `git diff --cached --check` | Windows Git；0 | 本轮两个新增文档的暂存差异检查通过；WSL Git 无法正确解析 Windows Worktree `.git` 指针，未用其误报作为通过依据 |
| 固定数据下载、解码、导入、预测测试 | NOT_RUN（退出码不适用） | 属于 N1+；本轮没有获取数据或运行算法 |

## 三层语义一致性

| 对齐层 | 实际检查 | 判定 |
|---|---|---|
| 总体计划 / PRD / 场景 | 公开历史值维持来源单位；仿真/派生/真实分层不混淆；本轮不扩大单店业务承诺、不主张价格因果 | PASS |
| Issue #23 / 原 Plan / 细化 Plan | 任务限定为需求估计、缺货候选、基线和时间评估；固定原 train/eval；未实施算法或下游工具 | PASS |
| N0 节点标准 | 基线、上游、来源、切分、文件 owner、依赖边界及命令已冻结；docs:check 与暂存差异检查实际退出码为 0 | PASS |

## 偏差、限制及决定

- 无已知范围偏差。数据验收摘要来自已合并 #21/#13 证据；当前 Worktree 尚未重取真实数据，因此不能声称 N1 数据 smoke 已通过。
- 真实标签字段是否足以支持小时可用性外推，若在固定来源文档/合同中不能确认则该候选保持 BLOCKED，不猜测 0/1 的语义。
- 本任务的测试覆盖 cohort 不确定为真实门店或代表性 SKU；仅供算法方法的可复核离线评估。
- N0 决定：本回执与细化计划已形成；执行文档检查和暂存差异检查均退出码 0。一次 WSL `git diff --check` 因 Windows Worktree `.git` 指针解析问题把仓库文件误报为 CRLF 尾随空格，不作为通过证据；已改用 Windows Git 检查本轮暂存差异。推送同一分支并同步 Issue/Project 为 IN_PROGRESS 后，停止等待主控核验；未获核验前不得进入 N1。
