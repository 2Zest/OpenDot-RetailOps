# Issue、PR 与 GitHub Projects 状态一致性

## 一致性字段

每个正式任务的当前状态必须同时体现在：

1. GitHub Issue 标签与 Issue 描述顶部的“当前执行状态”区块。
2. 对应 PR 状态、目标分支和最新 HEAD（进入 REVIEW 后必须有开放 PR）。
3. RetailOps V0.2 GitHub Project 的 Status 字段。
4. 验收回执中的状态、证据和关联 SHA。

历史执行记录保留为历史，不覆盖或删除。描述顶部只有一个“当前”状态区块；新状态变化时更新该区块并追加带日期的审计条目，避免旧快照被误读为现在状态。

## 状态映射

| 工作流状态 | Issue | PR | Projects Status | 进入条件 |
|---|---|---|---|---|
| `BACKLOG` | Open，标签 `BACKLOG`，未分配 | 无执行 PR | Backlog | 依赖或授权尚未到位 |
| `READY` | Open，标签 `READY`，未自动认领/分配 | 无执行 PR | Ready | G0/上游及任务所需证据已满足；未认领 |
| `IN_PROGRESS` | Open，标签 `IN_PROGRESS`，仅在用户授权后分配 | 实施中，可尚未创建 | In Progress | 已明确授权认领并启动独立任务 |
| `REVIEW` | Open，标签 `REVIEW` | PR Open，目标 `develop/retailops`，HEAD 已验证 | Review | 规定节点和定向检查完成，独立 Review 等待中 |
| `BLOCKED` | Open，标签 `BLOCKED`，正文记录阻塞、影响和解法 | 若有阶段 PR，保持开放并注明阶段性 | Blocked | 依赖、环境或验收失败；不伪造完成 |
| `DONE` | Closed，标签 `DONE`，记录 merge SHA | 实际已合并 | Done | 审查和验收通过且 PR 实际合并；仅关闭 PR 或提交候选不算 |

PR 是实现/文档审查对象，不替代 Issue 工作状态。PR 关闭但未合并时不能把 Issue 标 DONE；被审查的阶段性 PR 合并也不能越过仍未完成的 Issue 节点或下游安全门槛。

## 状态更新顺序

### READY / IN_PROGRESS

- 先读取 DAG、全部硬依赖和实际合并/验收记录。状态标签不由创建 Issue、进入项目或分支存在自动推导。
- 依赖满足后标 READY，项目状态同步 Ready；不自动分配。
- 用户授权认领后再分配执行人，将 Issue 与项目都转成 In Progress，并记录 Worktree、分支和基线 SHA。

### REVIEW

- 节点与测试证据完成后，先推送独立分支并创建/更新目标为 `develop/retailops` 的 PR。
- 确认 PR URL、head/base SHA、Open 状态和检查结果后，再把 Issue 标签/当前状态区块及 Projects 一起更新为 REVIEW。
- PR 或项目写入失败时，真实 Issue/PR 状态照实记录，不声称三方一致；修复漂移后再继续依赖调度。

### DONE

- 从 GitHub 实际读取 PR 的 `merged` 状态和 `merge_commit_sha`，不能从评论、Review 通过或本地分支猜测。
- 验收通过后，将 merge SHA 写入 Issue 当前状态区块和回执；Issue 设置 Closed + `DONE`，Projects 设置 Done。
- 对 Issue、PR、Project 分别回读一次，核对 URL、编号、状态和 SHA；仅全部一致后才释放 DAG 下游。

### BLOCKED / 状态漂移

- Issue 标签、Issue 正文和 Projects 不一致时，记录各自实际值、错误码/权限限制、负责修复动作与重新核验结果。不要通过编辑正文假装 API 状态已改变。
- 若 `gh auth status` 失败，先停止 Projects 写操作；不得在日志或 Issue 中粘贴 Token。允许继续使用已授权连接完成其支持的 Issue/PR 操作，但 Projects 未同步必须保持明确未完成状态。
- 若不能恢复 Projects 写权限，保留 Issue 真实状态并标记“Project sync blocked”；不解锁任何依赖该任务状态的下游。由有权限者完成后再回读核验。
- 一项任务阻塞不自动阻塞其无依赖的其他任务；同一任务状态漂移会阻断它自己的下游。

## GitHub CLI 与回读检查

优先使用已登录的 GitHub CLI；所有写命令前检查当前账号和目标 Project：

```sh
gh auth status
gh issue view <issue-number> --repo 2Zest/OpenDot-RetailOps
gh pr view <pr-number> --repo 2Zest/OpenDot-RetailOps
gh project list --owner 2Zest
gh project field-list <project-number> --owner 2Zest --format json
gh project item-list <project-number> --owner 2Zest --format json
```

Project V2 状态写入前，从 field/item 输出中读取真实 Project、item、Status field 和选项 ID；不要猜数字 ID：

```sh
gh project item-edit --project-id <project-id> --id <item-id> \
  --field-id <status-field-id> --single-select-option-id <option-id>
```

写入后重新读取 Issue、PR、Project item；若 CLI 不具备访问权限或功能，使用具备授权的 GitHub 项目界面/管理员完成 Project 字段更新。不得把只读 GitHub 连接的成功响应当成 Project 写入成功。

## 本任务核验记录

状态回读历史见 `../acceptance/RETAIL-00D-N0.md`、`RETAIL-00D-N5.md`。早期 Project scope 不足和写入失败的记录保留；本轮修订开始时曾将 Issue/Project 同步为 IN_PROGRESS，交付时回读为 #14 Done、#15 Review、#7 Blocked。Issue #15 等待 PR #84 独立 Review；本规范不替代每个任务的实时状态核验。
