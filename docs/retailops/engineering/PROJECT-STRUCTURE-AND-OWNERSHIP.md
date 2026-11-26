# RetailOps 项目结构与路径所有权

## 目的与范围

本设计把 RetailOps 的未来业务代码与 OpenDot 既有实现分开，并规定 Harness 适配器、模块依赖和并行路径锁。它是 RETAIL-00D（GitHub Issue #15）的工程结构规范，不是业务功能实现，也没有创建示意目录、npm workspace、依赖配置或运行入口。

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
      domain/                          # 领域类型、不变量、纯规则
      application/
        use-cases/                     # Retail Task 用例
        ports/                         # Agent、存储、时钟等端口合同
      adapters/
        harness/pi/                    # 唯一 Pi Harness 适配边界
        persistence/                   # 产品业务数据映射
        tools/                         # 经授权工具的产品侧适配
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

## Harness 适配器边界

- `application/ports/` 定义产品用例所需的最小运行端口，例如“提交受限任务、接收观察/完成状态、取消/查询既有运行”；实际接口字段由后续负责的 Issue 冻结，本设计不新增 API 合同。
- `adapters/harness/pi/` 是唯一允许导入 `@earendil-works/pi-durable`、`@earendil-works/pi-ai` 或 Pi 原生 Harness 类型的 RetailOps 子树。适配器把产品端口映射到现有 OpenDot/Pi 能力，不实现零售政策或审批规则。
- 领域层只消费 RetailOps 自有、可序列化的值对象和结果；不接收 Pi 的 `Harness`、`Conversation`、`Submission`、Task、Checkpoint 或 SDK 错误对象。
- Durable 负责 Runtime task/checkpoint/recovery；RetailOps 持久层负责业务 Task、草案、审批和执行回执。两类记录通过稳定引用关联，不相互冒充权威来源。
- 如果未来需要 Cloudflare 部署，由相应的 Cloud Agent 运行验证 Issue 在 `apps/cloud-agent/**` 内实现受控适配，并通过版本化端口合同对齐；RetailOps 代码不得直接导入 `apps/cloud-agent/src/**`。
- 不另建执行循环、会话账本、恢复引擎或第二套 Agent Runtime。遇到现有 Harness 能力缺口时，先记录为具体依赖/变更提案，未经批准不复制底座实现。

## 模块依赖方向

```text
web/API 或宿主入口 ──> application ──> domain
composition ──> application + adapters
adapters ──> application ports + domain contracts + 外部 SDK
```

- `domain` 仅依赖标准库及同层纯模块；禁止引用存储、网络、UI、模型 SDK、Pi Harness、MCP 或环境变量。
- `application` 编排领域能力，通过端口请求存储、Runtime 和时间/ID 能力；不直接实例化数据库、Pi Harness 或 Cloudflare Worker。
- `adapters` 实现端口，负责格式转换、错误分类、授权上下文传递和外部调用；不能改变领域不变量或绕过独立风控/业务审批。
- `composition` 装配适配器。Web 与产品 API 通过应用入口交互，不跨层读写 DB 或调用 Harness。
- 禁止循环依赖、跨 app 源文件相对导入和未声明的运行时依赖。每个新增包、Provider、Runtime、数据库或工具依赖都必须由对应 Issue/Plan 说明理由、版本、风险和验证，不在本任务添加。

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
