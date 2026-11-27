# RETAIL-01P（GitHub Issue #20）N5 节点回执：差异、文档与交付

- 节点目标：完成变更范围核对、文档/差异检查，提交独立 PR 并同步 Issue/Project 为 REVIEW。
- 基线/Worktree/分支：`8ca176ff3f9e5990b6c2487e41be2953e682c192` / `D:/workSpace/codeAgent/OpenDot-RetailOps-01p` / `feat/retail-01p`。
- 允许文件与实际文件：以 `docs/retailops/plans/RETAIL-01P-EXECUTION-PLAN.md` 的唯一 owner 表为准。实现限定在 apps/retailops 包，另有 #20 专属 Plan 和 N0–N5 回执。未修改根依赖、领域合同、宿主、Home DB、根迁移入口、Issue 原文或 #24 文件。
- 文档检查：WSL 直接运行 `npm run docs:check` 首次退出码 `1`，因 WSL 将 Windows `.git` worktree 指针错误解析为相对路径。设置 `GIT_DIR=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps.git/worktrees/OpenDot-RetailOps-01p`、`GIT_WORK_TREE=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-01p`、`GIT_OPTIONAL_LOCKS=0`、`core.autocrlf=true` 后重跑退出码 `0`，最新检查通过 261 份 Markdown。未更改 Git 配置或仓库脚本。
- `git diff --cached --check`：退出码 `0`。第一次在 WSL 不设置 `core.autocrlf=true` 的差异检查因基线 CRLF 文件报告了全仓库尾随字符，退出码 `1`；用与 docs 检查相同的 worktree 环境、`core.autocrlf=true` 重跑通过。未格式化或修改无关基线文件。
- 文件范围：提交文件共 24 个，全部属于 Plan 中列出的 #20 包内依赖、适配器、测试/合成 fixture 和独立 Plan/回执；`node_modules`、`dist`、临时数据库未提交。没有改根包、领域合同、宿主或 #24 路径。
- 提交与 PR：实现首个提交 `4630944e61b49ed5a8548713c5837d462e618d8b` 已推送；PR [#87](https://github.com/2Zest/OpenDot-RetailOps/pull/87) 目标 `develop/retailops`，OPEN、非 Draft、`mergeStateStatus=CLEAN`。追加本 N5 实际验收结果后推送回执更新，最新提交 SHA 由该推送及 PR HEAD 回读确定。
- 状态：Issue #20 保持 Open、REVIEW 标签、原 2Zest assignee；顶部状态包含 PR #87 与最新 HEAD。Project #2 状态为 Review。CLI 写入后通过 `gh issue view`、`gh pr view`、Project item-list 回读核验；不关闭 Issue、不标 DONE、不合并。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 独立持久化能力，不扩大业务范围 | 差异不包含业务服务、Agent、API、迁移 Home DB 或真实副作用 | PASS |
| Issue #20 / Plan | 独立分支/PR，展示 N0–N5 证据和实际检查结果 | 本次使用现有 `feat/retail-01p`，准备推送至 `develop/retailops` | PASS |
| N5 节点验收 | 文档/空白/文件范围检查通过，Issue/PR/Project 回读为 REVIEW | docs:check 261 Markdown 通过；diff check 0；24 文件均在授权范围；PR #87 Open/CLEAN，Issue Open/REVIEW，Project Review | PASS |

- 决定：N5 PASS；PR #87 等待独立 Review。该 PASS 只代表本 Issue 的实现和交付验收完成，不代表 Issue DONE 或代码已合并。
- 日期：2026-11-27（Asia/Shanghai）。

## 独立 Review REQUEST_CHANGES 最终复验记录（2026-11-27）

- 本轮修改范围（均为 #20 唯一 owner 路径）：apps/retailops/src/adapters/persistence/sqlite/{database,draft-repository,evidence-repository,migration-runner,operation-repository,policy-repository}.ts、migrations/0001_initial.ts；回归文件 apps/retailops/test/unit/persistence/sqlite/{migration-runner,repositories}.test.ts 及明确标注的合成旧库 fixture。Acceptance N1–N5 仅追加本轮事实；未改领域合同、根依赖、宿主、Home DB、根迁移入口或 #24 路径。临时 dist smoke 文件已删除，node_modules、dist、DB 未进入差异。
- 验收结果：WSL Node 24 下 npm run build 退出码 0；npm run typecheck 退出码 0；npm test 退出码 0，7 files / 55 tests passed；定向 repositories/migration 测试退出码 0，24/24；dist migration smoke 退出码 0；精确命令、初始失败及修复见 N1/N4。
- 依赖告警：本轮 npm audit --json 报 1 high、2 moderate、0 critical。Zod 4.4.3 为 production 直接依赖，GHSA-mrhx-c7xc-m3w5（过大数组导致内存耗尽；无 HTTP/API 入口，但外部数据可达性未验证）。Vitest 4.1.8 与其间接 @vitest/mocker 4.1.8 为 development 依赖，涉及 GHSA-82fw-gwwq-j7x9（未认证 mocker WebSocket 路径文件读取）和 GHSA-qxg6-89mg-rqv8（未认证 mock 注册代码注入）；需相关服务暴露/可达，当前是否暴露未验证。manifest/lock 对比 origin/develop/retailops 证明三者为既有基线；本轮不执行 audit fix、不更换版本。详细包路径和边界见 N4。
- 本轮新增回执落盘后，npm run docs:check 与 git diff --check 将以 WSL worktree 的 GIT_DIR=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps.git/worktrees/OpenDot-RetailOps-01p、GIT_WORK_TREE=/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-01p、GIT_OPTIONAL_LOCKS=0、core.autocrlf=true 复跑，结果追加如下。

- 文档检查最终结果：在上述 WSL worktree 环境执行 npm run docs:check，退出码 0，261 个仓库 Markdown 文件通过。
- 差异检查最终结果：在相同环境执行 git diff --check，退出码 0，无空白错误。Git 输出 LF 将由 core.autocrlf 转为 CRLF 的提示；未格式化或修改其他基线文件。
- N5 范围/语义结论：PASS（Review 修订范围仍限 #20）。N1–N5 回执追加真实复验结果；Issue #20 与 Project #2 保持 REVIEW，PR #87 开放、不合并。
