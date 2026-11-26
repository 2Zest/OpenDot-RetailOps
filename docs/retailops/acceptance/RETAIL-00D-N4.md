# RETAIL-00D N4 节点验收回执

## 目标

按 Issue/Plan 执行文档一致性、差异空白和 DAG 无环检查，并核实交付只包含冻结的文档路径。

## 实际命令与结果

执行环境：WSL Ubuntu，Node `v24.22.3`、npm `11.19.1`，Worktree `D:/workSpace/codeAgent/OpenDot-RetailOps-00d`。仓库依赖和业务 Runtime 未安装/启动。

| 检查 | 实际命令 | 退出码 | 结果 |
|---|---|---:|---|
| T01 文档一致性 | WSL Node 24/npm 11：`npm run docs:check` | 0 | 通过；检查 250 份 Markdown |
| T02 staged 差异空白 | `git diff --cached --check d3b402945ace1da4cd9e032690a394526079d09b` | 0 | 通过；无空白错误 |
| T02 工作树差异空白 | `git diff --check d3b402945ace1da4cd9e032690a394526079d09b` | 0 | 通过；仅有 LF/CRLF 提示，无空白错误 |
| T03 DAG | WSL Node：`node --input-type=module -e '<下方实际脚本>'` | 0 | 通过；37 个节点均可拓扑排序，无未知依赖或环 |

实际执行的 DAG 校验脚本：

```js
import fs from 'node:fs';
const g=JSON.parse(fs.readFileSync('docs/retailops/initial-plan-v0.2/dependency-graph.json','utf8'));
const ids=new Set(g.nodes.map(n=>n.id));
const indegree=new Map([...ids].map(id=>[id,0]));
for(const n of g.nodes) for(const d of n.depends_on??[]) {
  if(!ids.has(d)) throw Error('unknown dependency '+d);
  indegree.set(n.id,indegree.get(n.id)+1);
}
const q=[...indegree].filter(([,d])=>d===0).map(([id])=>id);
let done=0;
while(q.length) {
  const id=q.shift(); done++;
  for(const n of g.nodes) if((n.depends_on??[]).includes(id)) {
    const d=indegree.get(n.id)-1; indegree.set(n.id,d); if(d===0) q.push(n.id);
  }
}
if(done!==ids.size) throw Error('cycle detected');
console.log('DAG ACYCLIC:',done,'nodes');
```

T02 三类人工流程 dry-run 的实际场景和结果记录在 `RETAIL-00D-N3.md`。未运行产品源码测试、真实 Harness、模型、数据库或业务副作用检查，因为本任务没有实现代码。

## 文件差异与范围

- 计划内新增路径：根 `AGENTS.md`、两份工程规范、两份模板、N0–N5 验收回执。
- 未修改源码、测试、依赖、配置、迁移、API、工具注册、DAG、总体计划或其它 Issue/Plan。
- staged diff 与工作树 diff 空白检查覆盖基线 `d3b402945ace1da4cd9e032690a394526079d09b` 至本次冻结文档变更。

## 三层语义核对与结论

1. 总体计划/架构：只定义工程和集成边界；未实施 RetailOps 能力，未绕过 #7 Runtime 门槛。结果：PASS。
2. Issue #15/Plan：T01 文档检查、T02 dry-run、T03 DAG 检查和文件范围与原目标一致。结果：PASS。
3. N4 验收标准：实际命令、退出码和节点数量可复核；文件仅在冻结路径内。结果：PASS。

节点结论：PASS。Project 写入权限仍 BLOCKED，状态漂移证据保留于 N0；Issue/PR 状态写入不代替 Project 字段同步。
