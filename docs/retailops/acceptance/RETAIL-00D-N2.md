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
