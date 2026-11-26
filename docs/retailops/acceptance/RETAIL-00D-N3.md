# RETAIL-00D N3 节点验收回执

## 目标

用正常、偏差和阻塞场景 dry-run 检查工程规范能否阻止错误解锁与状态漂移。

## 实际 dry-run

1. **正常**：上游均有验收合并 SHA → Issue/Projects READY → 用户授权后 IN_PROGRESS → 节点和测试通过、独立 PR 打开 → REVIEW → 实际 merge SHA 回读 → Issue Closed/DONE 与 Projects Done 回读 → 才放行下游。结果：流程允许逐步推进。
2. **偏差**：N0 发现实现拟修改未列明的 `src/index.ts` 或根 package/lock。结果：按文件清单拒绝跨界写入，先停当前节点，协调共享 owner 并追加经授权的 Plan 路径；不得在代码已提交后补授权。
3. **阻塞**：`gh auth status` 失败且 Projects Status 仍显示旧值。结果：准确记录 CLI 错误和各系统真实状态；可继续 GitHub MCP 支持的 Issue 更新，但不能声称 Project 同步，也不得解锁受该状态依赖的下游。
4. **未合并 PR**：PR 已 Review 通过但 `merged=false`。结果：Issue 仍为 REVIEW/Open、Projects 仍 Review；不得记录 DONE、关闭 Issue 或解锁依赖项。
5. **安全阻塞**：#7 Open/BLOCKED。结果：不启动 #8、#16、#17、#18 或任何需要隔离运行环境的真实 Runtime 验收；#15 的纯文档工程规范与此无依赖，可继续。

## 三层语义核对与结论

1. 总体计划：未越过依赖、安全和合并门槛。结果：PASS。
2. Issue/Plan：场景覆盖节点模板、偏差停止、回归交付和状态同步。结果：PASS。
3. N3 标准：正常、越界、CLI/Project 阻塞、未合并和 #7 安全门槛均有明确预期与停止动作。结果：PASS。

节点结论：PASS。该 dry-run 是流程桌面推演，不是 Runtime 或产品行为测试。
