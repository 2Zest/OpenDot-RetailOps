# RetailOps 项目结构与路径所有权

## 目的与范围

本设计按轻量 DDD 与六边形架构把 RetailOps 的未来业务代码与 OpenDot 既有实现分开，并规定 Harness 适配器、模块依赖、独立包边界和并行路径锁。它是 RETAIL-00D（GitHub Issue #15）的工程结构规范，不是业务功能实现，也没有创建示意目录、npm workspace、依赖配置或运行入口。领域模块按业务能力组织；Entity、Value Object、Aggregate、Repository、纯函数和状态 Guard 按需用于表达不变量，不强制 CQRS、Event Sourcing 或微服务。

## 当前仓库结构基线

本设计基于 `develop/retailops` merge commit `d3b402945ace1da4cd9e032690a394526079d09b`。N0 实际观察到：

- 根 Node 应用源码位于 `src/**`；根 `tsconfig.json` 的 `rootDir` 为 `./src`、`include` 为 `src/**/*`。根 `package.json` 直接固定 Pi Durable 依赖，未声明 npm workspaces。
- `apps/cloud-agent/**` 是独立 Cloudflare Worker 包，拥有自己的 `package.json`、锁文件、TypeScript、测试和 Wrangler 配置。
- `web/**` 和 `electron/**` 各有自己的构建边界；`shared/**` 是跨模块共享区。
- 仓库当前没有 `apps/retailops/**`、`packages/**`、RetailOps 运行代码或根 `AGENTS.md`。本任务仅新增工程规范文档。
- 已有 Pi 接入证据：`src/personal-agent/durable-runtime.ts` 中 `PiDurableRuntimeAdapter`（约第 110 行起）封装 Pi Durable；`apps/cloud-agent/src/harness.ts` 中 `openCloudHarness`（第 30 行起）在 Cloudflare 包内打开 Harness（`Harness.open` 约第 201 行）。这些是现有宿主实现，不是 RetailOps 业务代码。

## 目标物理结构

以下为未来由对应实现 Issue/Plan 按需创建的边界。目录未创建之前，不把它们当成现有模块或可直接导入的路径。

```text
apps/
  cloud-agent/                         # 既有 Cloudflare Runtime，保持独立
  retailops/                           # RetailOps 专属应用边界
    src/
      domain/                          # 按业务能力分组的纯领域模型、不变量和规则
        inventory/                     # 库存分类、守恒与状态约束
        expiry/                        # 临期批次和值域规则
        policy/                        # 可售、质量、折扣等纯政策规则
      application/
        use-cases/                     # Retail Task 用例
        agents/
          analysis/                    # 经营分析 Agent Loop/决策用例合同
          risk-review/                 # 独立风控语义审查合同
          prompts/                     # 有版本的提示词/结构化输出合同
        context/                       # System/Task/Working Context 组装策略
        algorithms/                    # 不变量以外的纯应用计算协调
        simulation/                    # 仿真用例和场景编排
        observability/
          trace/                       # Retail Task 至调用/审批/回执关联合同
          eval/                        # 最小 Agent 行为评测合同
        ports/                         # Agent、存储、时钟等端口合同
      adapters/
        harness/pi/                    # 唯一 Pi Harness 适配边界
        persistence/                   # 产品业务数据映射
        tools/                         # 经授权工具的产品侧适配
        simulation/                    # 需要外部端口时的仿真实现
        observability/                 # Trace/Eval 存储或导出实现
      composition/                     # 运行入口与依赖装配
    test/
      unit/
      contract/
      integration/                     # 仅运行门槛批准后增加
web/
  src/features/retailops/              # 仅授权的 RetailOps UI/客户端适配
docs/retailops/                        # 计划、工程规范、验收和调查证据
```

### 物理隔离规则

1. 新增的 RetailOps 后端、测试和适配器只进入 `apps/retailops/**`；前端仅进入 `web/src/features/retailops/**`。不得把领域模型散落进 `src/personal-agent/**`、`src/bot-groups/**`、`apps/cloud-agent/**` 或 Web 通用组件。
2. 本任务不创建 `apps/retailops/package.json`、锁文件、源码、迁移或空目录。首次需要构建/运行它的 Issue 必须在自己的 N0 冻结包管理策略、基线、依赖和测试命令；不得顺带修改根 package/lock 或 Cloudflare 包。
3. 不新增 `packages/` 或 npm workspace。若将来需要跨应用复用，先以单独 Issue 提出边界和依赖方案；未批准前保持 RetailOps 内部模块封装。
4. 主应用路由、Web 导航、Electron 菜单等集成点只由明确包含该入口的 Issue 负责；用一个窄的组合/注册接缝连接，不复制或重写宿主启动逻辑。
5. 数据库迁移、产品 API、真实 MCP 工具和业务 Agent 不属于 RETAIL-00D；目录图仅给后续任务提供放置边界。
6. `apps/retailops` 是独立 npm 包的候选边界，拥有自己的 `package.json`、专属 lockfile、TypeScript/build 配置和脚本入口；这些文件只在对应实现 Issue 的 N0 冻结后创建。本任务不创建其中任何源码/配置，也不增加 root workspace。
7. 根 `tsconfig.json` 保持当前 `include: src/**/*` 边界，不把 `apps/retailops/**` 纳入根编译。RetailOps 包在自己的 TypeScript 配置中分别定义 build、typecheck 和 test 命令；test discovery 由该包明确配置，只扫描 `test/unit/**`、`test/contract/**`，集成测试仅在相应安全门槛批准后纳入。具体脚本名称和测试 runner 由实现 Issue N0 按现有依赖冻结，不在本规范预选新框架。
8. 宿主接缝仅使用已记录的公共 API/公开包或在 `composition/` 注入的 Application ports。不得通过相对路径导入 `src/**` 或 `apps/cloud-agent/src/**`，不得复制 Pi/OpenDot Runtime；缺少公共接缝时由对应 Issue 提出明确变更提案。

## Harness 适配器边界

- `application/ports/` 定义产品用例所需的最小运行端口，例如“提交受限任务、接收观察/完成状态、取消/查询既有运行”；实际接口字段由后续负责的 Issue 冻结，本设计不新增 API 合同。
- `adapters/harness/pi/` 是唯一允许导入 `@earendil-works/pi-durable`、`@earendil-works/pi-ai` 或 Pi 原生 Harness 类型的 RetailOps 子树。适配器把产品端口映射到现有 OpenDot/Pi 能力，不实现零售政策或审批规则。
- 领域层只消费 RetailOps 自有、可序列化的值对象和结果；不接收 Pi 的 `Harness`、`Conversation`、`Submission`、Task、Checkpoint 或 SDK 错误对象。
- Durable 负责 Runtime task/checkpoint/recovery；RetailOps 持久层负责业务 Task、草案、审批和执行回执。两类记录通过稳定引用关联，不相互冒充权威来源。
- 如果未来需要 Cloudflare 部署，由相应的 Cloud Agent 运行验证 Issue 在 `apps/cloud-agent/**` 内实现受控适配，并通过版本化端口合同对齐；RetailOps 代码不得直接导入 `apps/cloud-agent/src/**`。
- 不另建执行循环、会话账本、恢复引擎或第二套 Agent Runtime。遇到现有 Harness 能力缺口时，先记录为具体依赖/变更提案，未经批准不复制底座实现。

## 轻量 DDD 与 Agent/业务模块职责

- **Domain（按业务能力）**：`domain/inventory/`、`domain/expiry/`、`domain/policy/` 等保存独立于模型、运行宿主和数据库的业务语义、不变量、状态 Guard 及确定性规则。可按复杂度选择 Entity、Value Object、Aggregate、Repository interface、纯函数；简单值类型不需机械套用战术模式。
- **纯领域校验依赖**：允许已批准且无宿主/网络副作用的校验库，例如 GitHub Issue #19 明确要求的 Zod schema。#19 的 N0 冻结实际依赖来源、版本、TypeScript 可见性及独立锁文件；本规范不修改根 package/lock，也不把领域层限制为标准库。
- **Analysis Agent**：`application/agents/analysis/` 定义经营分析 Agent 的用例及动态决策合同；通过端口访问已授权工具，观察与证据不足时可继续调查或拒绝。它不拥有库存事实或业务批准权，也不把固定顺序 workflow 称为动态 Agent。
- **独立 Risk Review**：`application/agents/risk-review/` 定义独立风控语义审查合同；只能审查绑定同一草案摘要的输入。LLM 风险分析不替代 `domain/**` 的确定性硬规则，两个边界均不得被绕过。
- **Context 与 Prompts**：`application/context/` 负责 system/task/working context 的裁剪、来源/时效标记和预算策略；`application/agents/prompts/` 保管有版本的提示词和结构化输出合同。Context/Memory 不成为库存、授权、政策或审批的权威记录。
- **Tools**：`application/ports/` 只声明产品用例所需的工具端口和请求/结果类型；`adapters/tools/` 承担注册、授权上下文传递、输入输出校验和副作用接缝。未知工具默认拒绝，Prompt 不能授予能力。
- **Algorithms 与 Simulation**：领域不变量和业务决策公式优先放入对应 `domain/<capability>/` 的纯规则；`application/algorithms/` 仅协调跨领域纯计算；`application/simulation/` 编排模拟用例。需要外部端口时实现放在 `adapters/simulation/`，不接真实 POS/支付/采购写接口。
- **Trace/Eval**：`application/observability/trace/`、`eval/` 定义关联关系、评测输入与结果合同；外部存储/导出放在 `adapters/observability/`。Trace/Eval 复用现有 Harness/宿主，不引入第二套 Runtime 或假造运行结果。
- 以上均是候选路径及职责，不表示已创建目录或授权实现；具体 Issue 仍须遵循自己的契约、依赖和安全门槛。

## 模块依赖方向

```text
web/API 或宿主入口 ──> application ──> domain
composition ──> application + adapters
adapters ──> application ports + domain contracts + 外部 SDK
```

- `domain` 仅依赖标准库、同层纯模块及已批准的纯领域校验依赖（如 Issue #19 的 Zod）；禁止引用存储、网络、UI、模型 SDK、Pi Harness、MCP、宿主私有模块或环境变量。
- `application` 编排领域能力，通过端口请求存储、Runtime 和时间/ID 能力；不直接实例化数据库、Pi Harness 或 Cloudflare Worker。
- `adapters` 实现端口，负责格式转换、错误分类、授权上下文传递和外部调用；不能改变领域不变量或绕过独立风控/业务审批。
- `composition` 装配适配器。Web 与产品 API 通过应用入口交互，不跨层读写 DB 或调用 Harness。
- 禁止循环依赖、跨 app 源文件相对导入和未声明的运行时依赖。每个新增包、Provider、Runtime、数据库或工具依赖都必须由对应 Issue/Plan 说明理由、版本、风险和验证，不在本任务添加。
- 根 `tsconfig.json` 不覆盖 `apps/retailops/**`；RetailOps 包独立拥有 manifest/锁文件、build/typecheck/test scripts 和 test discovery。是否能从宿主公开 API 导入、使用何种端口注入、具体 runner/脚本须由对应实现 Issue N0 核实；禁止跨包导入宿主私有源码。

## 路径所有权和并行锁

| 路径 | 现有/目标用途 | 默认所有者与锁 |
|---|---|---|
| `apps/retailops/**` | 未来 RetailOps 后端、领域与 Harness 适配器 | RetailOps 当前 Issue；N0 列出精确路径后单任务独占 |
| `apps/retailops/test/**` | 未来单元/合同测试 | 对应实现 Issue；测试只覆盖其合同 |
| `web/src/features/retailops/**` | 未来 RetailOps 前端特性 | 明确授权的 Web Issue；不与后端任务并行改同一文件 |
| `docs/retailops/**` | 计划、规范、节点回执、证据 | 对应文档 Issue；共享总体计划/DAG 只读，除非独立变更授权 |
| `src/**`、`apps/cloud-agent/**` | OpenDot 既有宿主实现 | 既有模块负责人；RetailOps 默认只读 |
| `shared/**`、路由/服务注册、数据库迁移 | 跨模块共享接口 | 主控指定唯一 owner，冲突时串行；必须在 Plan 说明依赖与兼容检查 |
| 根 `package.json`、`package-lock.json`、`tsconfig.json` | 全仓构建与依赖边界 | 全局共享锁；任何修改先协调并执行根回归 |
| `apps/cloud-agent/package.json`、锁文件、Wrangler 配置 | Cloudflare 包及部署边界 | Cloud Agent 任务 owner；RetailOps 不顺带修改 |
| `electron/**`、`container/**` | 桌面/容器运行边界 | 各自任务 owner；未授权只读 |

每个 Issue 的 N0 文件清单必须逐路径记录：意图、owner、是否共享、允许操作（新增/修改/只读）、冲突处理人和验证项。未列路径视为只读。两个活跃任务拥有重叠可写路径时，先串行排程，不依赖事后合并解决。

## N0–N5 验收用法

实施任务先读取本文件及对应 Issue/Plan，并用 [`ISSUE-EXECUTION-PLAN.md`](templates/ISSUE-EXECUTION-PLAN.md) 固定实际路径；节点回执继续使用总体计划的 [`NODE-RECEIPT-TEMPLATE.md`](../initial-plan-v0.2/NODE-RECEIPT-TEMPLATE.md)。交付和状态回读使用 [`PR-DELIVERY-RECEIPT.md`](templates/PR-DELIVERY-RECEIPT.md) 与 [`ISSUE-PR-PROJECT-STATUS.md`](ISSUE-PR-PROJECT-STATUS.md)。
