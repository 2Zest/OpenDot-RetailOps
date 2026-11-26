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

节点结论：PASS。N0 时的 Projects 状态漂移见 N0；后续完成的看板回读见 N5。该文档节点不授权释放依赖尚未满足的下游。

## 独立 Review 修订任务 A（2026-11-26）

- 将目标结构定稿为轻量 DDD + 六边形架构，保留 `apps/retailops/**` 独立物理边界；领域模块按业务能力组织，Entity/Value Object/Aggregate/Repository/纯函数/状态 Guard 按需选择，不强制 CQRS、Event Sourcing 或微服务。
- 明确 Analysis Agent、独立 Risk Review、Context/Prompts、工具、算法、仿真、Trace/Eval 的候选路径与边界；Domain 与模型、宿主、数据库隔离，LLM 语义审查不替代确定性硬规则。
- 解决 Domain 仅标准库与 GitHub Issue #19 的 Zod schema 要求冲突：允许已批准的纯领域校验依赖；#19 N0 冻结版本、包可见性和独立锁文件。
- 明确 `apps/retailops` 的独立 package/lock/build/typecheck/test/test-discovery 设计，根 `tsconfig.json` 不覆盖该目录；宿主通过公共 API 或 Application ports 注入，禁止跨 app 导入宿主私有源码及复制 Runtime。未创建源码、包或配置。

三层复核：总体已批准 PRD/ADR 边界、Issue #15/Plan 与 N1 路径所有权目标、独立 Review A 的逐项验收均一致；结果 PASS。上述目录均为候选设计，不表示实现授权。
