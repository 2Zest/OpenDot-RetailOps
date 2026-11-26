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

节点结论：PASS。首次 N4 验收时 Project 写入权限 BLOCKED，失败证据保留于 N0/N5；后续状态同步回执见 N5。

## 独立 Review 修订任务 A 的 N4 复验（2026-11-26）

- 执行基线：原 PR #84 HEAD `52f16ef26fb224adbaf78603d72c5ee92d389331`；总体计划、批准 PRD/Architecture/ADR、原 Issue Plan 和 DAG 保持只读。
- 文档检查：WSL Node `v24.22.3` / npm `11.19.1`，`npm run docs:check` 退出码 0；检查 251 份 Markdown。
- 差异检查：`git diff --check d3b402945ace1da4cd9e032690a394526079d09b` 退出码 0；无空白错误，仅有 Windows 工作树的 LF/CRLF 转换提示。
- staged 差异检查：`git diff --cached --check d3b402945ace1da4cd9e032690a394526079d09b` 退出码 0；无空白错误。
- DAG/映射脚本退出码 0：确认批准状态、37 个唯一 RETAIL ID、37 个唯一 GitHub Issue Number、Issue URL/编号映射、所有硬依赖及下游链接映射，并以 Kahn 算法确认无环。实际脚本：

```js
import fs from 'node:fs';
const g=JSON.parse(fs.readFileSync('/mnt/d/workSpace/codeAgent/OpenDot-RetailOps-00d/docs/retailops/initial-plan-v0.2/dependency-graph.json','utf8'));
const ns=g.nodes, byId=new Map(ns.map(n=>[n.id,n]));
if(g.status!=='APPROVED'||ns.length!==37||byId.size!==37) throw Error('DAG status/node ID count mismatch');
const nums=ns.map(n=>n.github_issue_number);
if(nums.some(n=>!Number.isInteger(n))||new Set(nums).size!==37) throw Error('GitHub issue number mapping is missing or duplicated');
for(const n of ns){
  if(!n.github_issue_url.endsWith('/issues/'+n.github_issue_number)) throw Error('issue URL/number mismatch: '+n.id);
  const deps=n.depends_on??[], links=n.depends_on_issue_links??[];
  if(deps.length!==links.length) throw Error('dependency link count mismatch: '+n.id);
  for(const d of deps){const target=byId.get(d), link=links.find(x=>x.id===d); if(!target||!link||link.number!==target.github_issue_number||!link.url.endsWith('/issues/'+target.github_issue_number)) throw Error('dependency mapping mismatch: '+n.id+' -> '+d);}
  for(const link of n.blocks_issue_links??[]){const target=byId.get(link.id); if(!target||link.number!==target.github_issue_number||!link.url.endsWith('/issues/'+target.github_issue_number)) throw Error('downstream mapping mismatch: '+n.id+' -> '+link.id);}
}
if(byId.get('RETAIL-00D')?.github_issue_number!==15||byId.get('RETAIL-00C')?.github_issue_number!==14) throw Error('RETAIL-00C/00D mapping mismatch');
const indegree=new Map(ns.map(n=>[n.id,0]));
for(const n of ns) for(const d of n.depends_on??[]){if(!byId.has(d))throw Error('unknown dependency '+d); indegree.set(n.id,indegree.get(n.id)+1);}
const q=[...indegree].filter(([,d])=>d===0).map(([id])=>id); let done=0;
while(q.length){const id=q.shift();done++;for(const n of ns)if((n.depends_on??[]).includes(id)){const d=indegree.get(n.id)-1;indegree.set(n.id,d);if(d===0)q.push(n.id);}}
if(done!==ns.length) throw Error('DAG cycle');
console.log('PASS: approved DAG; 37 unique IDs and GitHub issue mappings; dependency/downstream links consistent; acyclic');
```

- 文件范围：修订限于 N0 冻结路径；无源码、包/锁文件、根/应用配置、37 份原 Plan、DAG、PRD/ADR 或其他 Issue 文件变更。最终 `git diff --name-only` 清单附于 N5。

三层复核：已批准架构原则保持不变；Issue #15/Plan 范围未扩展；Review A 的工程规范要求与回归标准逐项覆盖。结果：PASS。
