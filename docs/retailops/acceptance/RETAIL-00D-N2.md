# RETAIL-00D N2 节点验收回执

## 目标

提供可复用的 Issue Plan、PR 交付回执和 Issue/PR/Projects 状态停止规则。

## 实际执行与证据

- 新增 `docs/retailops/engineering/ISSUE-PR-PROJECT-STATUS.md`：定义 BACKLOG、READY、IN_PROGRESS、REVIEW、BLOCKED、DONE 与 Issue 标签、PR 和 Projects Status 的对应关系；定义合并 SHA、关闭和下游解锁顺序；记录 gh CLI/Project 写入失败后的阻塞处理。
- 新增 `docs/retailops/engineering/templates/ISSUE-EXECUTION-PLAN.md`：固定基线、依赖、Worktree、逐路径 owner、节点、命令、交付和回滚字段。
- 新增 `docs/retailops/engineering/templates/PR-DELIVERY-RECEIPT.md`：固定 PR head/base、节点/测试证据和 Issue、PR、Projects 回读字段。
- 节点回执继续引用已批准的 `docs/retailops/initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md`，避免维护第二份不同步模板。

## 三层语义核对与结论

1. 总体计划：合并是 DONE 的必要条件；真实 Runtime 门槛仍独立。结果：PASS。
2. Issue/Plan：模板包含 N0、路径所有权、节点、回归和 PR 交付；工程规范覆盖状态一致性。结果：PASS。
3. N2 标准：可以执行、能记录偏差/阻塞、合并后可回读核验，未给 `gh` 或 Projects 写权限制造假成功。结果：PASS。

节点结论：PASS。

## 独立 Review 修订任务 A（2026-11-26）

- 修订 `ISSUE-EXECUTION-PLAN.md`：要求保留批准的 37 份原 Plan 与 DAG；每项授权任务在自己的 N0 依据实际源码、Issue/Plan 和已批准架构细化 Execution Plan；普通细化由主控核验，范围/依赖/验收/安全变化需另行批准并版本化。
- 补充独立包 manifest/lock/TypeScript owner、根 tsconfig 与宿主私有路径排除、公共 API/ports 接缝、build/typecheck/test、unit/contract/integration discovery 和依赖版本冻结字段。
- 补充 PR 交付模板中的用户审批待办字段；不重写、不逐份深审其它任务 Plan。

三层复核：总体计划要求保留 DAG 与审批门槛；Issue #15 只修工程规范；N2 模板验收可执行且不授权新增范围。结果：PASS。
