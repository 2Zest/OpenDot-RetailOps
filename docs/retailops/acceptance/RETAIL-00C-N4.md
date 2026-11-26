# RETAIL-00C N4–N6 节点验收回执

> 本文件在 N4 原始验收记录后持续追加批准、N5 检查及 N6 交付证据。前文审批前的 `PENDING_USER_APPROVAL`、未执行检查和未建 PR 描述为当时快照；当前阶段状态以本文末尾的追加回执为准。

## 节点目标

将 N0–N3 形成的 PRD/领域架构/ADR/需求追溯/参数决策及路线图提交给业务负责人审批，并固定可审阅候选版本与 SHA-256。

## 实际动作与文件

- 新增/更新 `docs/retailops/acceptance/RETAIL-00C-APPROVAL-PACKET.md`，包含建议架构基线、逐项待决策问题、Git Blob 内容 SHA-256、Review 意见处理矩阵及审批后继续/退回规则。
- 第一轮独立 Review 的 REQUEST CHANGES 已逐项修订，覆盖 RETAIL-06/07/08/09/11/12/15/19、Context/Memory/RAG 边界、分析/风控/硬规则状态机、互斥库存分区、Eval/Trace、D01–D16 分类及正确审批包路径。
- N4 回执用于记录暂停点；本回执及审批包不包含在 SHA 清单中，以避免自引用。
- 当前 N0、N1、N2、N3 回执结论均为 PASS；业务批准尚未收到，因此 N4 状态为 **PENDING_USER_APPROVAL**，不标 PASS 或 DONE。
- 当前 GitHub Issue #14（RETAIL-00C）应保持 Open / IN_PROGRESS / Assigned 2Zest / Project In Progress；RETAIL-00F（GitHub Issue #7）仍 Open/BLOCKED。

## 测试、执行与限制

- N0–N4 无产品代码、API、数据库、配置或 Agent 工具改动；无真实模型、Runtime、仿真写效果或下游任务。
- 按 N0 冻结门槛，未运行 `npm run docs:check`、`git diff --check`、类型检查、fixture 或运行测试。N0 初检发现 WSL Node 缺失；本轮已按授权从 Node.js 官方包恢复并校验 WSL Node v24.22.3/npm 11.19.1，路径为 Linux 原生。工具基线已满足，但 N5 仍须等用户批准；上述检查均未执行，不得表示为通过。
- N5/N6 未启动。按用户追加授权，N0–N4 文档候选将仅提交/推送至既有任务分支供独立 Review；不创建 PR、不合并。审批包之后如修改任何哈希清单中的候选文件，需重新计算哈希并重新审批。

## 独立架构 Review 修订结论

| 要求 | 文档处理 | 本节点状态 |
|---|---|---|
| RETAIL-06 真实模型、动态规划、场景工具轨迹差异、证据不足拒绝 | PRD/架构/ADR/追溯矩阵提升原有契约；预算、停止、失败、结构化结果及最小行为指标明确 | 文档已修订；真实运行和评测未执行 |
| Context/Memory 与证据引用 | 明确四层职责、结果裁剪/摘要、时效/来源、Token 与权威数据边界 | 已修订；未添加 RAG 系统 |
| Multi-Agent、安全生命周期及库存口径 | 保留分析与独立风控；分开 LLM 语义风险与确定性规则；增加拒绝/撤销/取消/超时/失效/UNCERTAIN 约束；库存互斥分类守恒 | 已修订；未修改业务代码或下游验收 |
| Eval/Trace 与 RETAIL-19 边界 | 候选指标/阈值不伪造；逐对象 Trace 关系明确；完整对照仍由 RETAIL-19 执行 | 已修订；无实测结果声明 |
| 需求逐项追溯及变更分类 | 对 RETAIL-06/07/08/09/11/12/15/19 按 E/A/C 逐项映射 | 已修订；Issue、Plan、验收标准及 DAG 未改 |
| D01–D16、审批材料路径/哈希、Node 基线 | 原分类保留；原则待用户决定、具体参数延期至对应下游任务冻结；包路径为 `docs/retailops/acceptance/RETAIL-00C-APPROVAL-PACKET.md`；哈希绑定 Git Blob 原始内容；Windows Node 26 与 WSL Node 24.22.3 环境差异已记录 | 已修订；WSL Node 24 工具基线已恢复；N5 仍等待用户批准 |

## 三层语义检查

1. 总体计划/场景：方案仍是单店单 SKU/单临期批次优先；V1 扩展有前提；来源和运行证据分层；RETAIL-00F（GitHub Issue #7）与真实验证门槛保留。**PASS**。
2. Issue/Plan：补充内容追溯到既有 RETAIL-06/07/08/09/11/12/15/19；未改变其他 Issue、Plan 或 DAG；下游实施未提前执行。**PASS**。
3. N4 节点标准：审批材料、决定问题及文件 SHA 已列明；用户尚未确认，故节点业务批准未完成。**PENDING_USER_APPROVAL**。

## 结论及暂停

审批包已准备。主控在此停止，等待用户逐项审阅并明确接受、修改、推迟或拒绝的架构决策。没有用户批准，不执行 N5。

## 第二轮 Review 后的最终审批候选

> 以下记录的是用户批准前、候选提交 `072ca30982792072bf6641eac916cbb05a5fb062` 的审批快照。其待批准状态已被文末批准记录覆盖；候选当时的哈希核验结果保留为审批证据。

- 任务编号统一规则：`RETAIL-XX` 表示 DAG 内部任务 ID；GitHub 号用 `GitHub Issue #N` 表示，并在需求追溯矩阵中提供交叉映射，不再用 `#06`、`#19` 指代内部任务。
- 零容忍门槛：任意硬规则违规、未授权写入、审批绕过或重复业务副作用均使安全验收失败并阻断任务；不得通过平均分、效果收益或可调阈值放宽。它们不再作为可权衡的普通 Eval 指标。
- D01–D16 保留既有分类；待用户批准原则，具体参数按对应下游任务明确延期冻结，本节点不填写默认值。
- WSL Node v24.22.3/npm 11.19.1 已恢复并核验；`node`、`npm` 位于 Linux 用户路径并最终解析到官方 Linux x64 安装目录。官方归档 SHA-256=`4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb`，SHASUM 校验通过。环境满足 N5 工具基线，但审批未收到，N5/N6 未开始，所有检查仍未运行。
- 最终候选提交及哈希见本回执对应的审批包；状态保持 **PENDING_USER_APPROVAL**。

## N4 用户批准及正式冻结记录（2026-11-26）

- 用户明确批准对象：`072ca30982792072bf6641eac916cbb05a5fb062`。批准内容为该候选审批包列出的八项业务与架构原则，未要求重定范围或修改 DAG。
- 已接受的原则：①以 AI 应用/Agent 应用工程能力为项目目标，零售仅为受限业务场景；②保留 Agent Harness、真实模型驱动的动态 Tool Calling Loop、Observation 和证据缺口/停止规则；③Context/Memory 分层且不替代权威业务数据，不新增独立 RAG；④经营分析与独立风控、业务审批及执行职责分离，硬规则确定性 fail-closed；⑤库存物理量、不可售、可售和预占量按互斥分类守恒；⑥保留 Trace 与 Eval，区分 Agent 行为评测和业务对照；⑦硬规则违规、未授权写入、审批绕过和重复业务副作用为零容忍门槛；⑧复用 OpenDot/Pi Runtime，Durable、MCP、Handoff 和安全验证仍受原 Issue/DAG 门槛控制。
- D01–D16 的所有具体参数均按现有责任划分延期至对应下游 Issue/Plan 指定节点冻结；不在 RETAIL-00C 填写门店、SKU、单位、阈值、预算、Provider、Schema 等默认值。
- **N4：PASS。** 用户审批已记录；正式 PRD、领域架构及 ADR 的原则状态已冻结为 APPROVED/ACCEPTED，未宣称相关能力已实现或完成 Runtime 验收。
- 原候选审批包的 11 个 Git Blob 内容 SHA-256 已再次从 `072ca30982792072bf6641eac916cbb05a5fb062` 读取并核验：11 行、0 个不匹配；核验退出码 0。该候选哈希结果是批准时证据；最终 PR 提交中的哈希另由审批包清单更新。
- WSL 环境再次确认：Ubuntu，Node `v24.22.3`、npm `11.19.1`，Node/npm 命令来自 `/home/szz_user/.local/bin/`。N5 检查须在该 WSL Linux 环境执行。

### N4 三层语义检查

1. 总体计划/场景：批准没有改变单店单 SKU/单临期批次 V0、V1 分阶段扩展、来源分层、AI/Agent 工程主线或 #7 真实验证门槛。**PASS**。
2. Issue/Plan：按 RETAIL-00C 原 Plan 记录审批及 N5/N6 授权；未修改其他 Issue、Plan、验收标准或 DAG。**PASS**。
3. N4 节点标准：候选 SHA、用户批准、八项原则、D01–D16 延期、原候选哈希及 WSL Node 24 已记录。**PASS**。

## N5 定向检查及语义验收

状态：**PASS**。检查在 WSL Ubuntu 24.04、Node `v24.22.3`、npm `11.19.1`、Linux x64 环境执行。WSL Git 读取 Windows Worktree 元数据中的 `D:/...` 路径会失败；为 N5 命令临时设置 Linux `GIT_DIR`、`GIT_WORK_TREE` 并设置 `core.autocrlf=true` 后复测通过，未改 Git 配置或 Worktree 元数据。首次失败保留为环境偏差证据，不计作通过。全程仅检查文档；未启动真实模型/Runtime，未运行下游 Issue。

### 实际命令与结果

| 检查 | 命令/执行方式 | 结果 |
|---|---|---|
| WSL Node 基线 | `node -p 'JSON.stringify({version:process.version,platform:process.platform,arch:process.arch,execPath:process.execPath})'`; `npm --version`; `command -v node`; `command -v npm`; `readlink -f /home/szz_user/.local/bin/node`; `readlink -f /home/szz_user/.local/bin/npm` | Node `v24.22.3`、npm `11.19.1`、`linux/x64`；命令位于 `/home/szz_user/.local/bin/`，最终解析至 `/home/szz_user/.local/share/node-v24.22.3-linux-x64/`；退出码 0 |
| Markdown 文档一致性 | WSL 环境设置 `GIT_DIR=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps.git/worktrees/OpenDot-RetailOps-00c`、`GIT_WORK_TREE=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-00c`、`core.autocrlf=true` 后运行 `npm run docs:check` | `Documentation consistency check passed (240 repository Markdown files).`；退出码 0 |
| 差异/空白检查 | WSL Git 映射环境运行 `git diff --cached --check 591ced31c0557cbb14d7b4dc6197da52923e55b6`；另以 Windows Git 对实际工作树运行 `git diff --check 591ced31c0557cbb14d7b4dc6197da52923e55b6` | 两项退出码均为 0，无空白错误。Windows Git 对 N0–N3 回执和追溯矩阵给出 5 条 LF/CRLF 转换提示；这是既有跨平台行尾差异，不是检查失败 |
| 原候选哈希复核 | Node 脚本从 `git show 072ca30982792072bf6641eac916cbb05a5fb062:<path>` 读取审批包列出的 11 个 Blob 内容并计算 SHA-256 | 11 项、0 mismatch；退出码 0。复核的是用户实际批准的原候选版本 |
| 最终审批包哈希清单 | Node 脚本从 Git 暂存索引 Blob 逐项计算审批包列出的 11 项 SHA-256 | 11 项、0 mismatch；退出码 0。该清单对应 N6 PR 候选中冻结文件的实际 Git Blob 内容 |
| 内部任务编号映射 | WSL Node 内联脚本解析批准 DAG 的 `nodes[].id/github_issue_number` 与追溯矩阵 37 行 | DAG 节点 37、映射行 37、ID/Issue 均唯一、映射不匹配 0；退出码 0 |
| #7 安全状态 | GitHub Issue #7 只读核验 | Open，标签 `BLOCKED`；未更新、未解锁 |

首次 WSL `npm run docs:check` 使用默认 Worktree 环境时，脚本内部 `git ls-files` 因 Windows worktree 路径格式不能被 WSL Git 解析而失败（子进程退出码 128）；外层 PowerShell 包装还错误丢失了 Bash `$?`，该次调用无效。映射 Git 目录后的首次全工作树 WSL 差异扫描达到 30 秒工具等待上限，没有取得退出码，因此不计作通过；随后以 WSL Git 对已暂存的完整 PR 差异运行 `git diff --cached --check`，并以 Windows Git 对工作树运行 `git diff --check`，两者均退出 0。正式 `npm run docs:check` 在 WSL 显式映射 Git 目录后退出 0。以上恢复只作用于命令环境，没有改仓库元数据。

### T01/T02 与范围语义验收

- **T01 需求追溯：PASS。** `REQUIREMENTS-TRACEABILITY-V0.2.md` 的 37 个 RETAIL 内部任务 ID 与批准 DAG 的 GitHub Issue number 全量一致；例如 RETAIL-06 → GitHub Issue #27、RETAIL-19 → GitHub Issue #39、GitHub Issue #19 → RETAIL-01。没有重复内部 ID 或 GitHub Issue number。
- **T02 业务/安全边界：PASS。** PRD、Architecture、ADR 保留单店单 SKU/单批次 V0 与 V1 分阶段边界、数据来源分层、确定性硬规则优先、独立风控/业务审批/执行职责分离、草案摘要绑定与 uncertain 对账、库存互斥守恒及零容忍安全门槛。Memory 未替代权威数据；未新增 RAG、Agent、Runtime、DAG 边或下游验收范围。
- **参数检查：PASS。** D01–D16 的责任映射均保留；所有具体值仍标记为延期，无本任务补入的 SKU、单位、阈值、预算、Provider、Schema 或默认值。
- **运行门槛：PASS。** GitHub Issue #7 保持 Open/BLOCKED；没有运行 Agent Runtime、真实模型、Durable、MCP、Handoff、仿真副作用或任何下游验证。
- **文件范围：PASS。** 本轮只改 N0 冻结 13 个文档路径内的计划、路线图、PRD、Architecture、ADR、参数表、审批包及 N4–N6 回执；源码、测试、配置、依赖、DAG、总体计划及其他 Issue/Plan 未改。

### N5 三层语义检查

1. 总体计划/场景：单店单 SKU/单批次 V0、V1 扩展、来源层、AI/Agent 技术目标及安全门槛一致。**PASS**。
2. Issue/Plan：交付仍限 RETAIL-00C 文档定稿；N5/N6 按已批准 Plan 执行，未修改其它任务、Issue、Plan 或 DAG。**PASS**。
3. N5 节点标准：WSL Node 24 文档检查、差异检查、T01/T02、D01–D16、#7 状态和文件范围均有实际证据；两项规定检查退出码均为 0。**PASS**。

### 未验证事项

真实 Provider/模型行为、Agent Loop 运行、Durable 恢复、副作用对账、MCP 工具授权实际执行、Handoff 独立风控运行、仿真及业务效果均未在 RETAIL-00C 验证；分别保留原 Issue/DAG/安全门槛，不据文档检查结果声称已通过。

## N6 独立 PR 交付

状态：N5 已通过，正在执行 N6。将在最终范围与哈希核验后创建目标为 `develop/retailops`、关联 GitHub Issue #14 的独立 PR；保持开放，不合并。创建后追加 PR URL、最终 HEAD 和状态同步证据。
