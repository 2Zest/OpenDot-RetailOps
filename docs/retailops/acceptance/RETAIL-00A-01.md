# RETAIL-00A-01 执行验收回执

状态：三个脚本权限位已修复；全量 `make typecheck` 的 TypeScript 阶段通过，最终被仓库文档一致性检查阻塞。本回执不代表 Issue 完成或下游已解锁。

## N0 环境与范围预检

- Issue #6 `RETAIL-00A-01`：执行前为 Open、READY、未分配；[Issue #6](https://github.com/2Zest/OpenDot-RetailOps/issues/6)。
- 总体计划 APPROVED；批准记录：2026-11-25，计划 commit `08679239c1e9959f465e74f1b191085ce86c2c4b`，G0 已解除。DAG 无硬上游依赖；下游 `RETAIL-01P`（Issue #20）仍须按计划门槛复核。
- 基线 HEAD：`e8db2b6b983e9cd2eeca79e596f81b2e5b93663a`（PR #72 合并后的 `develop/retailops`）。
- Worktree：`/home/szz_user/projects/OpenDot-RetailOps-RETAIL-00A-01`；分支 `codex/retail-00a-01-permissions`。
- Ubuntu 24.04.1 / WSL2，Node `v24.22.3`，npm `11.19.1`，GNU Make 4.3。全量检查开始/结束时可用内存约 12 GiB（均高于 4 GiB 门槛）。
- 原 Worktree 无未提交文件。根、web、agent-runner 的锁文件依赖原本缺失；依次运行 `npm ci`，退出码均为 0，安装 803、683、242 packages；未改锁文件。npm 提示现有依赖漏洞及 install-script 审查告警，未运行 audit fix 或放宽脚本审批。
- 唯一允许的源码差异为三项脚本的 executable bit；额外交付物为本回执。

| 对齐层 | N0 预期与实证 | 判定 |
|---|---|---|
| 总体计划 | G0 已批准，按 DAG 执行且不扩展业务 | PASS |
| Issue / Plan | 独立 WSL worktree；只修脚本权限；对应契约、Plan 已读取 | PASS |
| 节点标准 | HEAD、依赖、环境和允许路径已固定 | PASS |

## N1 Makefile 调用链及原始 mode

`git ls-tree HEAD` 显示 `scripts/sync-stream-event.sh`、`scripts/check-stream-event-sync.sh`、`scripts/check-agent-runner-prompts.sh` 均为 `100644`。Makefile 的 `typecheck` 依赖 `sync-types`，后者执行 `./scripts/sync-stream-event.sh`；typecheck recipe 直接执行另外两个脚本。`make -n typecheck` 确认了该调用链。sync 前核对 canonical source 与所有目标副本：stream-event、image-detector、channel-prefixes 的 SHA-256 均一致。

| 对齐层 | N1 预期与实证 | 判定 |
|---|---|---|
| 总体计划 | 消除 Linux 脚本执行权限阻塞，不改业务 | PASS |
| Issue / Plan | 核对直接执行脚本与 Git mode | PASS |
| 节点标准 | Git tree、Makefile 和 dry-run 复现可审查 | PASS |

## N2 权限位修复

唯一源码改动：

- `scripts/sync-stream-event.sh`：`100644` → `100755`
- `scripts/check-stream-event-sync.sh`：`100644` → `100755`
- `scripts/check-agent-runner-prompts.sh`：`100644` → `100755`

运行 `sync-stream-event.sh` 后，所有共享类型副本仍与来源一致；`git diff --summary` 只显示上述三个 mode change，无正文、Makefile、断言或其他源码改动。

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `./scripts/sync-stream-event.sh` | 0 | 完成，无共享文件内容变化 |
| `./scripts/check-stream-event-sync.sh` | 0 | 所有共享类型副本同步 |
| `./scripts/check-agent-runner-prompts.sh` | 0 | 13 个 prompt 引用均解析 |
| `git diff --check` | 0 | 通过 |

| 对齐层 | N2 预期与实证 | 判定 |
|---|---|---|
| 总体计划 | 仅修复权限基线，无业务变更 | PASS |
| Issue / Plan | 仅修改核实后的必要 executable bit | PASS |
| 节点标准 | diff 仅 mode，三个脚本可直接执行 | PASS |

## N3 原类型检查链路

按要求真实执行 `make typecheck`。后端 TypeScript、personal-agent TypeScript、Web TypeScript、Web E2E TypeScript、Agent Runner TypeScript 均通过；权限脚本检查也通过。最终 `npm run docs:check` 失败：

```text
Documentation consistency check failed:
- docs/retailops/RETAILOPS-ROADMAP.md:1 references missing planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md
make: *** [Makefile:153: typecheck] Error 1
```

GNU Make 因 recipe 失败返回 2。该失败是 ROADMAP 文档链接缺少目标，不是 TypeScript 错误，也非本权限改动引起。按范围限制未修改文档、Makefile 或检查器。完整输出保存在 WSL 临时文件 `/tmp/retail-00a-01-make-typecheck.log`，未加入 Git。检查前后可用内存约 12 GiB。

| 对齐层 | N3 预期与实证 | 判定 |
|---|---|---|
| 总体计划 | 修复权限问题，原有其他失败如实保留 | BLOCKED：docs:check 的既有链接错误 |
| Issue / Plan | 原 Permission denied 消失，后续失败单独报告、不扩修 | 部分满足；范围外 docs:check 失败，BLOCKED |
| 节点标准 | 执行完整原命令并记录结果 | BLOCKED：TypeScript 阶段通过但整条命令返回 2 |

## 交付状态

- 权限修复及三项对应脚本检查通过；未宣称全量类型检查绿灯。
- 未通过项：`docs/retailops/RETAILOPS-ROADMAP.md:1` 引用缺失的 `planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md`。
- 全量单元测试、独立 PR Review、合并均未执行。
- Issue 保持 Open；此 PR 创建不解锁下游 `RETAIL-01P`。
- PR 目标为 `develop/retailops`，保持开放等待 Review 和用户确认。回滚方式为 revert 本 PR，恢复原始 Git mode。
