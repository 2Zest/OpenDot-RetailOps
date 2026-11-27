# RETAIL-01P（GitHub Issue #20）N2 节点回执：表结构与约束

- 节点目标：按 v0.3.0 合同建立六类实体、迁移表、关系表及必要主键/外键/唯一约束/索引。
- 基线/Worktree/分支：`8ca176ff3f9e5990b6c2487e41be2953e682c192` / `D:/workSpace/codeAgent/OpenDot-RetailOps-01p` / `feat/retail-01p`。
- 实际文件：仅 `apps/retailops/src/adapters/persistence/sqlite/migrations/0001_initial.ts`（唯一 owner #20）；相关迁移测试在 `apps/retailops/test/unit/persistence/sqlite/migration-runner.test.ts`。
- 实际动作：建立 Evidence、Product、Policy、Batch、Draft、Operation 表，关系表保存有序引用；表含 `contract_version='0.3.0'` 检查约束、主外键、唯一键及查询索引。Draft/Operation 的循环引用通过事务期延迟外键完成；产品证据按 position 主键保存，允许合同数组中重复引用且保留次序。未新增业务字段或推导业务阈值。
- 证据：`npm test -- test/unit/persistence/sqlite test/contract/persistence/sqlite` 退出码 `0`；4 个文件、15 项通过。测试验证 FK、重复主键约束、迁移版号和 synthetic legacy fixture 升级/失败回滚。

| 对齐层 | 预期语义 | 实际事实及证据 | 判定 |
|---|---|---|---|
| PRD / 总体计划 | 存储可追溯业务事实，字段不丢失合同来源/版本 | 六实体以合同 payload 加规范化查询列保存；证据引用独立关系表 | PASS |
| Issue #20 / Plan | 合同字段、精确版本、外键/唯一约束和合成旧库升级 | v0.3.0 约束及 fixture 测试通过；没有 Home DB 迁移 | PASS |
| N2 节点验收 | 主外键、唯一性、合同版本与迁移可验证 | 定向测试实际验证主键、FK 失败、schema version、重复迁移和旧 fixture 升级 | PASS |

- 未验证：后续 N3/N4 将完成所有 Repository 往返、损坏数据与事务边界覆盖，并执行完整包测试。
- 决定：N2 PASS，继续 N3。日期：2026-11-27（Asia/Shanghai）。
