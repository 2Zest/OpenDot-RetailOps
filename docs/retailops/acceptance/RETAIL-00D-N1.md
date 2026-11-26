# RETAIL-00D N1 节点验收回执

## 目标

完成文件职责、物理目录、代码隔离、Harness 边界、模块依赖和并行路径锁设计。

## 实际执行与证据

- 新增 `AGENTS.md`，限定 RetailOps Issue 执行规则、代码隔离、安全边界和状态同步。
- 新增 `docs/retailops/engineering/PROJECT-STRUCTURE-AND-OWNERSHIP.md`，记录现有仓库结构证据、目标 `apps/retailops/**` 物理边界、Pi Harness 适配器、依赖方向和路径所有权表。
- 保持本任务为纯文档：未创建 `apps/retailops/**` 运行目录、package/workspace、业务代码、数据库/API/MCP 工具、迁移或新依赖。
- 依据来源：根 `tsconfig.json`、根 `package.json`、`apps/cloud-agent/package.json`、`src/personal-agent/durable-runtime.ts`、`apps/cloud-agent/src/harness.ts`；集成基线 `d3b402945ace1da4cd9e032690a394526079d09b`。

## 三层语义核对与结论

1. 总体计划/已批准架构：目录设计隔离业务代码并复用 OpenDot/Pi Harness，没有新增 Runtime 或安全绕行。结果：PASS。
2. Issue/Plan：满足 N1 路径所有权要求；未来目录是设计，不伪称已实现；未修改被保护的共享路径。结果：PASS。
3. N1 节点标准：逐路径标明目标、owner、只读/共享锁，模块依赖向内，冲突时串行。结果：PASS。

节点结论：PASS。Projects 状态漂移见 N0；不影响此文档节点，但不释放任何依赖该同步的下游。
