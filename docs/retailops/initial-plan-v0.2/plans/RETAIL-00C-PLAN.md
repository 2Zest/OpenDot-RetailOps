# RETAIL-00C 初始执行 Plan

契约：`docs/retailops/initial-plan-v0.2/issues/RETAIL-00C.md`；总体计划：`docs/retailops/initial-plan-v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`。状态：IN_PROGRESS；N0 主控核验通过。N1–N3 文档定稿；N4 等待用户业务架构审批；N5–N6 未授权启动。

## 启动门槛
- 上游：RETAIL-00B-02、RETAIL-00B-03、RETAIL-00B-04H、RETAIL-00E-01、RETAIL-00E-02。核验实际 PR/证据与当前集成 HEAD，发现不一致则暂停。
- 输入：本总体计划、场景草案、五项上游调查。
- 编号约定：`RETAIL-XX` 为 `dependency-graph.json` 的内部任务 ID；GitHub 编号只写作 `GitHub Issue #N`，不使用 `#06`、`#19` 等形式简称内部任务。完整交叉表见 `REQUIREMENTS-TRACEABILITY-V0.2.md`。
- 环境：总体计划审批记录已归档；GitHub Issue #14（RETAIL-00C）已授权认领；不得把静态调查或 fixture 结果作为 Runtime 验收。
- 运行环境：Windows 11 + WSL2 Ubuntu 24.04.1；WSL 可用内存约 12 GiB、根盘可用约 941 GiB。Windows Node v26.13.0/npm 11.20.0；WSL 初检时 Node 缺失且 npm 指向 Windows fnm interop。2026-11-26 已从 Node.js 官方发布归档恢复 WSL Linux x64 Node v24.22.3/npm 11.19.1，官方 SHASUM 校验通过；`command -v node/npm` 为 `/home/szz_user/.local/bin/...` 并最终解析至 Linux 安装目录。N0–N4 仍仅为文档工作；N5 必须等待用户明确批准。
- 基线：`develop/retailops` HEAD `591ced31c0557cbb14d7b4dc6197da52923e55b6`；五项上游合并 SHA 已在 N0 回执记录并均为当前基线祖先。
- 文件范围冻结为 N0 回执所列 13 个文档路径。禁止改动源码、测试、配置、依赖、迁移、API/MCP/Agent 工具、DAG、总体计划、旧架构文档及其他任务文件；历史路线图内容不得删除或重写。
- 检查命令仅在用户批准 N4 后，于 N5 使用已核验的 WSL Node v24.22.3/npm 11.19.1 执行：`npm run docs:check`、`git diff --check`，并执行 Plan 中列明的定向语义审阅。N0–N4 不运行这些检查或产品/Runtime 测试。
- N4 交付审批包后必须停止等待用户确认；N5–N6 仅在收到明确批准后继续。

## 节点计划与交付标准
| 节点 | 操作 | 必须满足的节点标准 | 证据 |
|---|---|---|---|
| N0 | GitHub、分支、Worktree、五项上游、输入、资源与范围预检 | 独立分支跟踪正确；Issue/Project 为 IN_PROGRESS；路径清单及检查门槛冻结 | `docs/retailops/acceptance/RETAIL-00C-N0.md` |
| N1 | 对比 V0.1 与 V0.2 并确定范围边界 | 路线图说明当前优先级；冲突处置明确；V0.1 历史保留 | `docs/retailops/acceptance/RETAIL-00C-N1.md`、更新路线图 |
| N2 | 定稿业务需求与领域模型 | 数据来源、单店/单 SKU/单批次、库存事件、决策与审批约束可追溯 | PRD、领域架构、追溯矩阵、`docs/retailops/acceptance/RETAIL-00C-N2.md` |
| N3 | 架构决策与验证门槛 | ADR 明确决策/待决策项；Runtime/数据/安全门槛不被静态证据替代 | ADR、待决策清单、`docs/retailops/acceptance/RETAIL-00C-N3.md` |
| N4 | 业务架构审批暂停点 | 版本与文件 SHA 冻结，审批问题明确；未获批准不执行 N5 | `docs/retailops/acceptance/RETAIL-00C-APPROVAL-PACKET.md`、`docs/retailops/acceptance/RETAIL-00C-N4.md` |
| N5 | 定向测试与回归 | Issue T01…及验收标准全部核对，失败归类，不降级断言 | 测试收据、失败与修正记录 |
| N6 | 交付与 Review | 输出齐全、范围无漂移、PR 关联 Issue；未合并不 DONE | PR、diff、验收矩阵 |

## 交付检查
PRD V0.2、领域架构、ADR、需求追溯矩阵、更新路线图及待决策参数清单。N4 仅提交审批，不代表批准；最终标准仍为用户批准。禁止旧比价/跨店任务混入；高级能力仍须真实运行验证。

每节点使用 `NODE-RECEIPT-TEMPLATE.md` 记录预期语义、实际事实、三方对齐、偏差及修正复测。PARTIAL/BLOCKED 节点不得标 PASS；若目标本身不可行，提 ADR/变更请求由用户批准后重新冻结计划，不自行改验收。
