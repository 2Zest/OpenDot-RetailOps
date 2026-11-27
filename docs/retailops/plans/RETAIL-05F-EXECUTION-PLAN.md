# RETAIL-05F（GitHub Issue #23）执行细化计划

状态：N0 初始化已完成，等待主控核验；未进入 N1。保留原始 `RETAIL-05F-PLAN.md` 与 DAG，本文件只细化本次认领的 N0 和后续执行边界。

## 1. 基线、依赖与输入证据

- 仓库：`2Zest/OpenDot-RetailOps`；分支：`feat/retail-05f`；Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-05f`。
- N0 基线：`develop/retailops` / `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`。任务分支当前仍基于该 SHA；工作区初始干净。
- 硬依赖 RETAIL-02（GitHub Issue #21）：PR #89 实际合并，merge SHA `d5deb5b5f385aebe843bbfbcc97073dbfc967ec7`；v0.3.0 历史数据合同、109/109 测试及 N0–N5 验收记录在 `docs/retailops/acceptance/RETAIL-02.md`。
- 数据调查 RETAIL-00E-02（GitHub Issue #13）：固定 FreshRetailNet-50K revision `c374e85975c82816c495acfa904cc55ab14a47d3`，许可 CC BY 4.0。`store_id=0` 有 74 个编码 SKU，各自覆盖原 train 90 天和原 eval 7 天；共同窗口为 2024-03-28 至 2024-07-02。此编码门店不代表现实门店，SKU 覆盖不构成 V0 经营仿真范围。
- 原始 Parquet LFS SHA-256：train `6706832db892bbae4969c19d87e07975d2543d2ba7d7d4756360654785de5a3d`；eval `1b118840664280c6b88bffc84c80ee1f54c05d911e354b7599e5da10995e960e`。
- #21 已验收筛选快照 JSONL SHA-256：train `4b1f0c5922d54b991eca9cef3b7a5cb98f1878097cd320fbe6f2af44b6a5e005`（6,660 行）；eval `0934c95835208fdd32938ba3e4b69b7c4389d6eca5f4560e0b648866c3bb47d2`（518 行）。快照为 store 0 的全部 74 SKU，不提交到 Git。原始来源和 manifest 由 #21 固定来源获取/导入脚本验证；评估工具还须校验 revision、split、摘要、行数、自然键、SKU/日期覆盖，失败时拒绝运行。
- 代码输入：`freshRetailNetRecordSchema`、`FreshRetailNetSourceRow`、`freshRetailNetRevision` 和公开历史查询端口；合同版本 0.3.0。公开 `sale_amount`/`hours_sale` 是来源归一化观测，不转换成实际件数、库存、售价、金额、成本或利润。
- 其他基线材料：已批准 PRD/Architecture/ADR，RETAIL-05F Issue 契约及原 Plan，RETAIL-00E-02 调查与验收，RETAIL-02 正式合同与回执，`DECISIONS-PENDING.md`、工程目录所有权规范及 `AGENTS.md`。

## 2. N0 冻结的评估切分与语义

以每个 store 0 SKU 的有序来源序列独立评估，不把不同 SKU 拼成一个经营实体：

| 用途 | 来源日期 | 天数 | 用途边界 |
|---|---|---:|---|
| 基线训练 | 原 train 的前 76 天，2024-03-28 至 2024-06-11 | 76/SKU | 拟合基线/缺货候选；输入只包含预测截点之前的历史字段 |
| 候选验证 | 原 train 的后 14 天，2024-06-12 至 2024-06-25 | 14/SKU | 比较候选及固定选择规则；验证标签不得进入对应预测输入 |
| 最终测试 | 原 eval 原始 split，2024-06-26 至 2024-07-02 | 7/SKU | 选定候选后以完整 90 天原 train 重估并评估；不根据 test 调参或选择模型 |

不随机切分、不跨原始 split 调换样本；日期逐 SKU 连续性和 train/validation/test 边界须由脚本实测。测试集的目标销量、缺货标签及同日字段只能用于评估或结果分层，不能成为该日预测特征。折扣、天气、促销等字段仅在确有来源时点证据证明预测截点可用后方可作为输入；本轮最小预测合同不依赖这些未来协变量。

基线定义为“训练窗口全部有效历史 `sale_amount` 的算术均值”这一可解释朴素基线；用源浮点值计算/呈现，不将结果转成业务金额或物理数量。缺货候选先作为研究对照，不产生生产默认值：

1. **未修正观测基线**：保留全部有效历史 `sale_amount`，仅作为对照。
2. **无缺货日筛选候选**：只用来源标签 `stock_hour6_22_cnt === 0` 的历史观测估计均值；缺少足够可用历史则返回不可计算，不填造目标值。该方法不恢复缺失销售，也不代表无偏需求。
3. **小时可用性外推候选（条件性）**：可用小时的小时归一化销量率外推到目标小时数；只有在 `hours_stock_status` 中 0/1 与可售/缺货的映射及适用时间窗有固定来源依据、并通过覆盖边界检查后才可进入候选比较。若语义不能确认，该候选标为 NOT_RUN/BLOCKED，不猜映射、不产出修正值。该候选只是一项归一化观察假设，不是因果需求或价格弹性估计。

任何窗口长度、最少有效历史、缺货覆盖下限、候选选择规则等尚未批准值均作为显式候选参数；N0 不给生产默认值。不得将模拟、派生或归一化预测写为 PUBLIC_HISTORICAL。

## 3. 指标、缺失和安全边界

- MAE：在有效预测/目标成对样本上计算 `mean(abs(actual - forecast))`，单位仍为提供方归一化销量；结果同时报告有效样本数和日期覆盖。
- WAPE：`sum(abs(actual - forecast)) / sum(abs(actual))`。当分母为零或没有有效配对时返回结构化 `UNDEFINED`/`INSUFFICIENT_DATA` 及原因，不加 epsilon、不替换成 0、不静默排除整个序列。总体及逐 SKU 结果必须披露分母为零的序列数。
- 缺失值、非法值、重复自然键、日期间断、短序列分别报告。不能默默填补目标数据；不足以运行基线时返回不可计算状态。确需跳过某序列时，报告 SKU 数、行数和理由，且不把缺测解释为零销量。
- 输出为带 `DERIVED` 来源、固定算法/公式版本、数据 revision、split、窗口及样本摘要的估计/指标。不得宣称真实销量单位、真实门店代表性、库存事实、价格因果、经营 uplift 或 RETAIL-12/19 业务 KPI。
- 算法可计算不代表业务批准、定价候选、写入授权或真实 Agent/Runtime 验收。

## 4. 文件所有权与禁止修改项

N0 本轮实际可写范围仅为下表前两项。N0 主控核验通过后，N1+ 仍只可在已冻结的预测路径内实现：

| 路径 | 操作 | 唯一 owner | 冲突/边界 |
|---|---|---|---|
| `docs/retailops/plans/RETAIL-05F-EXECUTION-PLAN.md` | N0 新增；后续仅由 #23 追加节点结果 | #23 | 不改原始 Plan、PRD、Architecture、ADR、DAG |
| `docs/retailops/acceptance/RETAIL-05F-N0.md` | N0 新增；之后由 #23 追加回执 | #23 | 使用既有节点模板语义，不覆盖历史证据 |
| `apps/retailops/src/domain/history/demand-estimation.ts` | N1+ 新增纯算法及输出 schema | #23 | 只依赖领域历史记录合同和纯领域值；不依赖 DB、Runtime、模型或应用宿主 |
| `apps/retailops/test/unit/domain/history/demand-estimation.test.ts` | N1+ 新增纯函数负向/边界/确定性测试 | #23 | 与 #22 的 `domain/simulation/**` 及其测试路径隔离 |
| `scripts/retail-05f/evaluate-fixed-snapshot.mjs` | N1+ 新增离线真实样本评估脚本 | #23 | 只读 #21 生成的被忽略快照；不修改 #21 的获取、导入脚本，不提交数据/DB |
| `docs/retailops/acceptance/RETAIL-05F.md` | N1+ 新增完整节点与误差报告 | #23 | 只记录经实际运行得到的指标；样本/fixture 结果明确标级别 |
| `apps/retailops/src/domain/history/**` 除上述新文件 | 只读 | 已合并 #21 合同 | 不改来源合同、manifest、导入及持久层 |
| `apps/retailops/src/application/**`、`apps/retailops/src/adapters/**`、`apps/retailops/src/domain/decision/**` | 只读 | #26/#22/既有合同 owner | 不改 application 算法入口、持久化、仿真、折扣业务 |
| `apps/retailops/package.json`、包锁、根 manifest/lock/tsconfig、迁移入口及 `apps/retailops/domain/index.ts` | 只读 | 共享/其他任务 owner | 不新增依赖、不占 migration lock、不改公共注册入口 |
| `data/**`、临时数据库、原始/下载 JSONL、Parquet | 仓库外/忽略目录，只读或临时生成 | 本地任务执行环境 | 必须 `git status` 确认未跟踪数据不进入提交；不覆盖现有数据目录 |

禁止：SQLite migration/repository、仿真器、价格建议或执行、预测 Agent Tool/MCP、模型训练/依赖、第二 Runtime、业务默认参数、宿主注册或根配置变更。若必须更改冻结路径/共享文件或增加依赖，先停止并提交冲突/变更请求。

## 5. 后续节点与验收门槛

| 节点 | 操作 | 验收标准 |
|---|---|---|
| N0 | 固定源合同、时间窗、所有权、命令及环境；本轮仅输出计划和回执 | 依赖证据真实；三个层次语义一致；精确可写文件与禁止项清晰；主控核验前不得进入 N1 |
| N1 | 实现来源单位保真的输出合同和朴素均值基线；用公开样本和确定性 fixture 验证 | 输出版本、窗口、来源 revision/split、样本数完整；短/缺失/非法输入明确拒绝或报告；不伪造单位 |
| N2 | 实现有缺货标记的候选估计 | 先确认原始标签含义；各候选单独标识假设/版本；不得自动选为生产默认、不声称无偏或因果恢复 |
| N3 | 实现按上述固定顺序的 76/14/7 时间评估及 MAE/WAPE 报告 | 逐 SKU 无未来泄漏；test 不参与选择；零分母、空配对、短序列处理可复现；固定来源哈希/覆盖核对 |
| N4 | 完成单元边界、T01/T02、固定快照离线抽查和完整包回归 | 保留所有既有测试；build/typecheck/test/docs:check/diff check 均记录退出码；实际样本与 manifest/hash 匹配；失败不降级 |
| N5 | 提交独立 PR 至 `develop/retailops` 并同步 REVIEW | 报告和回执、错误/未验证项、文件范围、HEAD/PR 均可复核；不合并、不 DONE |

N0 主控核验通过后才进入 N1；若字段语义、固定快照或必须参数不满足，则仅暂停依赖该证据的候选路径，其余在既定范围内继续。

## 6. 命令与环境

- N0：`git status --short --branch`、`git rev-parse HEAD`；WSL `node --version`、`npm --version`、`gh auth status`（仅读），实际结果记入 N0 回执。
- 实现定向测试：在仓库根运行 `npm test -- test/unit/domain/history/demand-estimation.test.ts`（工作目录 `apps/retailops`）；构建：`npm run build`；类型检查：`npm run typecheck`；完整测试：`npm test`（同为 `apps/retailops`）。
- 固定快照生成按 #21 已提交命令：`python3 scripts/retail-02/fetch-fixed-snapshot.py --output-dir data/retail-02`，并在获批的仓库外临时 DuckDB 解码环境按其脚本参数完成 Parquet 解码。此为可能产生网络/大文件的 N1 数据准备步骤，需执行前确认资源与目录空闲；不得复用/覆盖非空目录。若数据已存在，先校验并复用，不重下。
- 离线导入 smoke：`node scripts/retail-02/import-fixed-snapshot.mjs --snapshot-dir data/retail-02`；评估命令由新增 `scripts/retail-05f/evaluate-fixed-snapshot.mjs` 固定为同一快照目录。
- 仓库文档与差异：仓库根 `npm run docs:check`、`git diff --check`；所有命令退出码、WSL Node/npm 版本和真实样本结果写回执行回执。
- 不安装依赖；不启动真实模型、Runtime、Agent、MCP 或业务副作用。测试数据只从固定来源生成或使用显式小型合成 fixture；不把 fixture 结果称作真实数据评估。
