# RETAIL-00 — OpenDot 源码基线调查

调查日期：2026-11-25；仓库：https://github.com/2Zest/OpenDot-RetailOps

固定基线：`main` / `0db0ba1bbf658d217f248bf29b5715bcbf09ccac`（2026-11-08，Initial open-source release）。HEAD 无父提交；递归 Git Tree 2,518 条，未截断。main 未启用分支保护。本次仅通过 GitHub API 静态调查，未拉取依赖、启动环境或运行测试，未修改远端。

## 证据等级

S：已读取关键源码并确认具体机制；T：目录或测试文件存在，未完整检查；D：仅文档记录；P：拟新增。S 不等同于运行验收。

## 工程基座

Node >=22.19（CI 24）、TypeScript、Hono、better-sqlite3、Zod、Pi Coding Agent 0.84.2、Pi Durable/Pi AI/Pi MCP 1.3.0；React 19/Vite/Zustand/Tailwind、Electron、Vitest/Playwright、Langfuse/OpenTelemetry。保留现有技术栈，不引入新的通用 Agent 框架或数据库。源码基准链接：https://github.com/2Zest/OpenDot-RetailOps/tree/0db0ba1bbf658d217f248bf29b5715bcbf09ccac

## 复用能力矩阵

| 能力 | 证据 | 已核实机制 / 待验证项 | 候选扩展 |
|---|---|---|---|
| Pi Runtime | S `container/agent-runner/src/runtime/pi/pi-runtime.ts` | PiRuntimeAdapter、Session、资源加载、压缩开关；与 Durable 不混同 | 保留 |
| Durable | S `src/personal-agent/durable-runtime.ts` | 官方 Harness/SQLite、会话授权回调、请求载荷绑定；启用路径需实测 | 优先复用 |
| Product Runtime | S `src/personal-agent/product-runtime.ts` | ProductRuntimeService，authorize/submit/reconcile；具体会话接入须本地跟踪 | 领域入口适配 |
| Goal/Scheduler | S `src/personal-agent/goal-runtime.ts`、`src/task-scheduler.ts` | 冻结快照、goal-run 请求 ID、lease 检查、完成审批产物证据 | 经营监测调度，不替代领域状态 |
| Team | S `src/personal-agent/goal-team-runtime.ts` L29-114 | Handoff 委派、暂停恢复、失败/不确定不视为完成、读取产物证据 | 经营分析与独立风控协议 |
| 私有产物审批 | S `src/personal-agent/approval-store.ts` | operation 仅 create_private_artifact，数据库 CHECK 同样限制 | 用于报告产物，不充当调价审批 |
| MCP 审批 | S `src/personal-agent/mcp-approval-store.ts` L346-490、L520-542；`durable-mcp-tools.ts` | 参数规范化摘要、来源与权限检查、请求去重、恢复 uncertain；当前自动只读特殊逻辑面向 Computer Use | 领域工具显式分类、审批绑定业务意图、执行前复核 |
| Browser | S `src/personal-agent/browser-target-policy.ts` | Origin/Session/Tab/Revision、30 秒凭证、64KiB 文本、资源锁；支持 click/fill | 零售只读工具、HTTPS 白名单、结构化提取、注入防御 |
| Context | S `container/agent-runner/src/context-budget.ts`、`src/personal-agent/ephemeral-device-images.ts` | Token 预算评估；临时设备图单条≤4MiB、最多4条、历史不再注入 | 巡店上传归档及预算，独立于截图机制 |
| Memory | S `src/personal-agent/personal-memory-store.ts` | active、授权 revision、有效期、读取快照；当前政策不能由记忆权威决定 | 版本化政策、旧授权/旧审批失效 |
| Trace | S `src/personal-agent/host-observability.ts`、`mcp-approval-store.ts` | Langfuse/OTel、MCP 回执观测 | 关联领域 trace，保持脱敏 |
| Cloud/PWA | S 部分 `src/routes/cloud-runtime.ts`；T `apps/cloud-agent/`、`web/` | 路由和工程存在；未验证真实云端、移动弱网、跨端接续 | 后续实测，不能仅凭目录宣称已实现 |
| Eval | D `docs/personal-agent/evaluation.md`；T tests/ | 原项目分层测试与历史记录；非本次执行证据 | 行业数据集、负向测试、真实模型评估 |

## 关键风险与限制

1. Git Tree 未发现名称含 retail/merchandising/replenishment 等路径；不证明内容完全不存在，Codex 应全文核对。
2. 原作者历史 Issue/PR 不可从当前无父提交的 HEAD 直接追溯，未另行查证。
3. `.github/workflows/ci.yml` 只有 workflow_dispatch，注释称 2026-10-25 暂停自动 CI。建议恢复前核实额度；没有本次绿灯证据。
4. 尚未完整读完所有数据库迁移、HTTP ACL、前端审批路由、云端 admission、工具注册和部署路径。
5. 通用审批幂等不是外部系统 exactly-once 保证。领域操作 ID、外部幂等键、回执查询、uncertain 冻结必须另验。

## 本地基线验收计划（待执行）

记录 git rev-parse HEAD、git status --short、node -v、npm -v、实际操作系统和 Docker 可用性。CI 基线 Node 24；遵循各工程 lockfile：

```sh
npm ci
npm --prefix web ci
npm --prefix container/agent-runner ci
npm --prefix apps/cloud-agent ci
make sync-types
make typecheck
npm test -- --run
npm run build:all
npm --prefix apps/cloud-agent run build
npm run self-test:agent-runner
npm run demo:durable-runtime
npm --prefix web run test:e2e
npm run test:cloud-authority
```

Playwright 浏览器、Docker、真实模型凭证等按仓库说明配置；凭证不写入记录。不得为通过测试而改锁文件/删断言。区分本机、容器、workerd、fixture、真实模型与实际手机证据。失败记录命令、退出码、原因、复现和后续 Issue；历史测试报告不能替代当前测试。

候选回归文件（已确认路径存在，未执行）：`tests/pi-durable-runtime.test.ts`、`tests/goal-durable-store.test.ts`、`tests/goal-team.test.ts`、`tests/mcp-approval.test.ts`、`tests/mcp-approval-process-recovery.test.ts`、`tests/browser-target-policy.test.ts`、`tests/personal-memory.test.ts`、`tests/host-observability.test.ts`、`tests/product-runtime-http.test.ts`。

完成状态：静态基线调查已产出；本地可运行基线和详细扩展点核实仍待完成。没有创建 GitHub Issue/PR 或修改仓库。
