# RETAIL-00C N0 节点验收回执

## 节点目标

核验 GitHub Issue #14（RETAIL-00C）的授权、状态、集成基线、五项上游、输入材料、独立 Worktree、资源环境及可修改文件范围，并细化 N1–N6 执行计划。

## 实际执行

- 仓库：`2Zest/OpenDot-RetailOps`；目标分支：`develop/retailops`。
- 集成基线及当前分支起点：`591ced31c0557cbb14d7b4dc6197da52923e55b6`。执行 `git fetch origin develop/retailops docs/retail-00c` 后，`origin/develop/retailops` 与 Worktree HEAD 相同；`git merge-base --is-ancestor origin/develop/retailops HEAD` 退出码为 0。
- Worktree：`D:/workSpace/codeAgent/OpenDot-RetailOps-00c`；分支：`docs/retail-00c`，跟踪 `origin/docs/retail-00c`；初始工作树干净。独立 bare clone 位于 `D:/workSpace/codeAgent/OpenDot-RetailOps.git`。
- GitHub Issue #14（RETAIL-00C）：Open、分配给 `2Zest`、`IN_PROGRESS`；Project 状态 `In Progress`。本轮授权为 Issue 认领与执行授权。
- 总体计划审批记录：`docs/retailops/acceptance/RETAILOPS-V0.2-APPROVAL.md`；总体计划标记 APPROVED、G0 已解除。

## 五项上游实际合并核验

| RETAIL 编号 | Issue / PR | 实际合并 SHA | 当前基线祖先 |
|---|---:|---|---|
| RETAIL-00B-02 | GitHub Issue #9 / PR #74 | `0ce19d390a99aa3e14307b84094aba4aeeb74a59` | 是 |
| RETAIL-00B-03 | GitHub Issue #10 / PR #77 | `4bda549e7bcf250fe555d9e89e49ad59d5396d71` | 是 |
| RETAIL-00B-04H | GitHub Issue #11 / PR #78 | `60590b3a03fe79476b7ee9851669c19e1c1ca929` | 是 |
| RETAIL-00E-01 | GitHub Issue #12 / PR #75 | `3469160b93b966e38757e48bbb3c0239362c16d3` | 是 |
| RETAIL-00E-02 | GitHub Issue #13 / PR #79 | `6a2ddc363f82ae9f9e66e296d2644efafb48565e` | 是 |

GitHub 当前记录中五项上游均已关闭并标记 DONE。RETAIL-00F（GitHub Issue #7）仍为 Open/BLOCKED；N0 未触碰其状态或安全门槛。

## 已核读输入

- `docs/retailops/initial-plan-v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`；`docs/retailops/initial-plan-v0.2/RETAILOPS-SCENARIO-V0.2.md`；`docs/retailops/initial-plan-v0.2/dependency-graph.json`；`docs/retailops/initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md`。
- `docs/retailops/initial-plan-v0.2/issues/RETAIL-00C.md`；`docs/retailops/initial-plan-v0.2/plans/RETAIL-00C-PLAN.md`；`docs/retailops/acceptance/RETAILOPS-V0.2-APPROVAL.md`。
- 五项已合并调查：`docs/retailops/investigation/RETAIL-00B-02.md`、`docs/retailops/investigation/RETAIL-00B-03.md`、`docs/retailops/investigation/RETAIL-00B-04H.md`、`docs/retailops/investigation/RETAIL-00E-01.md`、`docs/retailops/investigation/RETAIL-00E-02.md`。
- 既有 `docs/retailops/RETAILOPS-ARCHITECTURE.md` 与 `docs/retailops/RETAILOPS-ROADMAP.md`。旧 V0.1 架构与路线图只保留为历史，不覆盖架构旧文档，不删除路线图原文。
- DAG：RETAIL-00C 上游为 00B-02、00B-03、00B-04H、00E-01、00E-02；下游为 RETAIL-00D（GitHub Issue #15）、RETAIL-01（GitHub Issue #19）、RETAIL-05P（GitHub Issue #24）。本任务不执行或解锁下游。

## 环境与资源

- WSL2：Ubuntu 24.04.1 LTS；空闲内存约 12 GiB；根文件系统剩余空间约 941 GiB。
- 本轮再次核验：Windows `node --version`=`v26.13.0`、`npm --version`=`11.20.0`。`wsl -d Ubuntu -- bash -lc 'node --version; npm --version'` 中 Node 返回 `command not found`；`command -v npm` 指向 `/mnt/c/Users/Administrator/AppData/Local/fnm_multishells/.../npm`，即 Windows interop 路径，不是 WSL Node 环境。
- 环境恢复（2026-11-26）：从 [Node.js 官方 v24.22.3 发布页](https://nodejs.org/en/download/archive/v24.22.3) 下载 Linux x64 官方归档，`SHASUMS256.txt` 校验通过；归档 SHA-256=`4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb`。安装至 WSL 用户目录 `/home/szz_user/.local/share/node-v24.22.3-linux-x64`，通过用户级 `~/.local/bin` 和既有 `~/.profile` PATH 使用；没有覆盖既有 Node 链接或系统运行时。
- 恢复后验证：WSL `node --version`=`v24.22.3`，`npm --version`=`11.19.1`；`command -v node`=`/home/szz_user/.local/bin/node`，`command -v npm`=`/home/szz_user/.local/bin/npm`，两者最终均解析到 Linux 安装目录；`node -p 'process.platform+"/"+process.arch'`=`linux/x64`。N5 环境前置现已满足，但仍须等待用户批准 N4 后方可执行检查。
- 本阶段只编辑文档，无 Docker 构建、大规模下载或高负载测试。N0–N4 不运行产品或 Agent Runtime。
- GitHub CLI `gh` 不可用；本轮已通过 GitHub 连接器完成远端状态核验和 Issue/Project 状态同步，不把 CLI 缺失表述为 GitHub 无法操作。

## 冻结文件范围

允许在本任务分支修改或新增以下 **13 个文档路径**：

1. `docs/retailops/initial-plan-v0.2/plans/RETAIL-00C-PLAN.md`
2. `docs/retailops/RETAILOPS-ROADMAP.md`（仅在文首增加当前 V0.2 路线图；既有 V0.1 历史说明及以下原文保留）
3. `docs/retailops/initial-plan-v0.2/RETAILOPS-PRD-V0.2.md`
4. `docs/retailops/initial-plan-v0.2/RETAILOPS-ARCHITECTURE-V0.2.md`
5. `docs/retailops/initial-plan-v0.2/RETAILOPS-ADR-V0.2.md`
6. `docs/retailops/initial-plan-v0.2/REQUIREMENTS-TRACEABILITY-V0.2.md`
7. `docs/retailops/initial-plan-v0.2/DECISIONS-PENDING.md`
8. `docs/retailops/acceptance/RETAIL-00C-N0.md`
9. `docs/retailops/acceptance/RETAIL-00C-N1.md`
10. `docs/retailops/acceptance/RETAIL-00C-N2.md`
11. `docs/retailops/acceptance/RETAIL-00C-N3.md`
12. `docs/retailops/acceptance/RETAIL-00C-N4.md`
13. `docs/retailops/acceptance/RETAIL-00C-APPROVAL-PACKET.md`

禁止修改源码、测试、配置、依赖、数据库迁移、API、MCP/Agent 工具、DAG、总体计划、旧版架构正文、其他 Issue/Plan/调查报告及其他任务文件。发现必须扩大路径或改变既有目标时，暂停并提交范围变更请求。

## 检查及暂停门槛

- N1–N3：文件范围审阅、来源/版本核对、需求追溯及三层语义检查；不启动真实 Runtime，不运行下游任务。
- N4：对审批材料涉及的文件记录 SHA-256，并列清业务决策问题；该节点后停止等待用户批准。
- 只有用户明确批准 N4 后才执行 N5：使用已恢复且核验的 WSL Node v24.22.3/npm 11.19.1，运行 `npm run docs:check`、`git diff --check` 和 Plan 中的定向回归审阅。环境恢复不等于 N4 批准；N5 前不得运行这些检查或宣称通过。
- N6：审批后进行最终范围/diff 核验并创建独立 PR，目标 `develop/retailops`；不自行合并。

## 三层语义一致性检查

1. 总体计划/场景：以单店商超经营决策为核心；V0 为单 SKU、单临期批次损耗治理闭环，V1 再逐步扩展多 SKU 与补货；真实、公开历史、派生、仿真数据分层；不越过安全与运行验证门槛。结果：PASS。
2. Issue/Plan：交付 PRD、领域架构、ADR、需求映射与路线图；依赖为五项已合并上游；N4 为人工审批暂停点。结果：PASS。
3. N0 标准：远端 HEAD、上游合并、任务授权、独立工作区、资源、文件范围和 N5 检查门槛均有实际记录；N5/N6 尚未启动。结果：PASS。

## 偏差、阻塞与结论

- 偏差：原 Plan 未给出明确文件路径及 Node 运行环境；已在本节点内将路径冻结为上述 13 个文档，记录 Windows/WSL 工具版本并将 N5 检查留待审批后执行。
- 阻塞：无。N4 后的人工业务架构审批是计划规定的暂停门槛，不是可自行绕过的阻塞。
- 结论：**PASS**。主控核验后的范围允许进入 N1–N3 文档工作；N4 必须停止。
