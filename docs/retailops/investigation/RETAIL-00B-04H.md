# RETAIL-00B-04H Handoff 独立风控接口调查

**Issue：** [#11 RETAIL-00B-04H](https://github.com/2Zest/OpenDot-RetailOps/issues/11)
**基线：** e8db2b6b983e9cd2eeca79e596f81b2e5b93663a（origin/develop/retailops）
**分支：** docs/retail-00b-04h
**范围：** 只读源码调查与隔离 fixture 定向测试；未改业务源码、运行配置或依赖。总体计划 G0 已由用户批准并解除。DAG 中 #11 无上游硬依赖，下游为 RETAIL-00C 与 #18 RETAIL-00B-04V；本调查不满足下游真实运行验收门槛。

## 结论

现有源码提供后续可复用的委派骨架：Scheduler occurrence 持有 lease 与冻结 Goal 上下文，Goal Team 选择 Group 中获授权的 Bot，Handoff 为接收 Bot 建立独立 session。执行边界会复核 owner、当前成员 revision、grant、workspace、配置指纹、deadline、lease 与工具白名单。失败或结果不确定时不会依据模型陈述完成 Goal；恢复路径复用原 Handoff 和 native submission。

但当前路径没有专门的“独立风控 reviewer”身份、角色字段、评审决策或强制职责分离机制。Goal Team Bot 是获授权的执行接收者，不等同于独立风控角色。现有 Product Approval 仅用于 create_private_artifact，不能作为零售业务审批。建议后续设计区分分析者、风控审查者与执行者，并将审查决定绑定到不可变业务草案摘要、数据版本、政策/规则版本和工具范围，在业务写入前由服务端验证。此为调查建议，不是已实现能力。

**本地可行性：** 可用 Node Durable、host workspace 和显式批准的 local provider/grant 作为后续隔离候选；现有 HTTP fixture 已证明本地进程编排、授权与恢复测试路径可运行。含设备文件资源的 Goal Team 需要 cloud Durable grant，不能用它证明本地只读数据路径。此次未配置真实 provider、商超数据或写接口，也未进行 #18 独立运行验收。fixture 结果只证明 fixture 下行为，真实零售风控与 Runtime 仍未验证。

## 源码调查

所有源码引用固定在 e8db2b6b983e9cd2eeca79e596f81b2e5b93663a。

### N1：委派、lease、身份和恢复

- executeGoalRuntimeStep 检查冻结 Goal snapshot，再将带 Goal Team 的 Scheduler run 委派至 executeGoalTeamStep：[goal-runtime.ts:21–35](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-runtime.ts#L21-L35)。
- GoalTeamSchema 约束 1–2 个唯一 Bot member，绑定不可变；schema 没有 risk reviewer 字段：[goal-team-store.ts:25–40](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L25-L40)。chief 要求 Group owner、同一 owner 的 host workspace 与有效默认 profile：[goal-team-store.ts:173–196](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L173-L196)。
- admitGoalTeamStep 在事务中核验 running run 与 lease owner/token/expiry，选择仍有效授权的 Bot，冻结 Goal snapshot、grant ID/digest、deadline 和工具范围后建立单个 Handoff：[goal-team-store.ts:489–622](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L489-L622)。
- assertGoalTeamHandoff 复核精确 run/goal/session/owner、Scheduler 状态和 lease、isolated host task 与运行时记录；goalTeamSourceAllowed 失败关闭：[goal-team-store.ts:279–345](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L279-L345)。
- executeGoalTeamStep 等待时重验 claim 与 lease；failed、uncertain、cancelled 不完成 Goal；完成还要核对 artifact receipt 与 content digest：[goal-team-runtime.ts:27–112](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-runtime.ts#L27-L112)。verifiedGoalTeamResult 要求完成态结果消息匹配 handoff ID 和 digest：[goal-team-store.ts:418–446](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L418-L446)。

### N2：接收者工具范围与只读权限

- BotHandoffService 将 Handoff 作为关联/投影层，执行交由既有 Product Runtime/Pi Harness；provision 创建独立 Bot session，提示将 Group 消息视为不可信数据并仅用显式授权工具：[handoff-service.ts:64–66](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L64-L66)、[handoff-service.ts:78–162](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L78-L162)。
- assertBotHandoffAuthority 在执行边界复核 owner、目标成员及 revision、grant/profile/workspace、配置指纹/provider、digest、状态与 deadline，并拒绝不在有效能力列表中的工具：[handoff-store.ts:146–226](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L146-L226)。Goal Team 将当前授权能力冻结入 contract：[goal-team-store.ts:551–566](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L551-L566)。
- grant 枚举能力为 read_workspace_file、create_approved_artifact、inspect_text、read_device_file，最多两项：[handoff-store.ts:60–76](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L60-L76)。未发现零售交易/库存写能力；create_approved_artifact 本身是写效果，不能称为只读授权。
- assertBotHandoffSubmission 将 session input 绑定到原 request、payload、sender 与 queue 行为：[handoff-store.ts:962–988](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L962-L988)。prepareBotHandoffControl 限制 owner、expected_revision 与合法控制迁移：[handoff-store.ts:1563–1655](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-store.ts#L1563-L1655)。
- Product Approval 的 operation 和 SQLite constraint 均限于 create_private_artifact：[approval-store.ts:37–60](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L37-L60)、[approval-store.ts:67–89](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/approval-store.ts#L67-L89)。它不足以代表价格、库存或促销决策的独立业务审批。

**接口建议（待批准设计）：** reviewer 应与分析者和执行者身份不同，限只读能力，读取固定版本草案和证据，只能提交结构化 approve/reject/request-evidence 决定。决定绑定草案 ID/digest、数据版本、规则/政策版本、reviewer ID、能力范围、有效期和 request ID。执行服务在产生效果前验证角色分离、版本未变、批准未过期且仅消费一次。现有 Handoff 可提供独立 session、权限边界和恢复机制，但缺少 reviewer 角色、零售审查合同与执行时消费门禁，不能宣称已有该接口。

### N3：本地候选

- Handoff grant 支持 Node Durable；provision 检查 runtime kind、local/cloud 状态、配置指纹和 provider 是否匹配：[handoff-service.ts:78–96](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/bot-groups/handoff-service.ts#L78-L96)。
- Goal Team 要求 host workspace；声明 device resource 要求 cloud grant 与 read_device_file：[goal-team-store.ts:198–267](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/src/personal-agent/goal-team-store.ts#L198-L267)。后续本地候选应不含设备资源。
- 测试 helper 使用临时数据根、独立 HOME/端口、loopback fake provider 与 Node 子进程：[bot-handoff-http-fixture.ts:36–65](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/tests/helpers/bot-handoff-http-fixture.ts#L36-L65)、[bot-handoff-http-fixture.ts:115–215](https://github.com/2Zest/OpenDot-RetailOps/blob/e8db2b6b983e9cd2eeca79e596f81b2e5b93663a/tests/helpers/bot-handoff-http-fixture.ts#L115-L215)。这是本机隔离测试候选，不是实时模型、真实零售数据/写接口或 #18 运行验证。

## 验证结果

环境为 WSL2 Ubuntu 24.04.1、Node v24.22.3、npm 11.19.1。测试窗口前后 MemAvailable 约 12 GiB；根文件系统约从 944 GiB 降至 942 GiB 可用。

| 检查 | 命令与退出码 | 结果 |
|---|---|---|
| 安装 | npm ci / 0 | 803 packages；npm 报 48 项 audit advisory（2 low、20 moderate、23 high、3 critical），未执行 audit fix，未改 package/lock。 |
| T01/T02 定向测试 | 见下方命令 / 0 | 4 files、16 tests passed，73.35 秒。只作为隔离临时数据库/子进程/loopback fake model fixture 证据。 |
| 文档工程检查 | npm run docs:check / 1 | 基线已有失效链接：docs/retailops/RETAILOPS-ROADMAP.md:1 指向缺失的 planning/v0.2/RETAILOPS-MASTER-PLAN-V0.2.md。未混入本任务修复。 |
| 差异检查 | git diff --check / 0 | 无源码 diff；提交前复查文档。 |

    PATH=/home/szz_user/.nvm/versions/node/v24.22.3/bin:/usr/bin:/bin npm test -- --run tests/goal-team.test.ts tests/bot-handoff-security.test.ts tests/bot-handoff-controls.test.ts tests/bot-handoff-recovery.test.ts

## 边界与后续

- 没有云部署、真实模型或商超 API/数据运行，没有业务写动作，也没有 #18 运行验收。
- #18 仍须等待 DAG 的其他硬依赖（含 00F、00B-02V）和自身隔离运行授权；本报告不解锁它。
- docs:check 失败按基线问题记录，不标 PASS、不修复。
- npm audit 信息仅记录；不升级依赖或变更安全策略。
- 仅本报告与本 Issue 验收回执可修改；回滚为独立 revert 这两份文档。
