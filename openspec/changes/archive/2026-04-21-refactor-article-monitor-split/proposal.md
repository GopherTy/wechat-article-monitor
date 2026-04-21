## Why

当前文章监控页面把"公众号发现新文章"和"文章评论持续追踪"两个职责糅在一套数据模型与一组调度器中：`MonitorWatch` 与 `MonitorTask` 共享生命周期，自动发现的文章和手动添加的文章混排在同一列表，文章发现侧没有"是否监测到新文章"的反馈，评论监控侧没有"剩余时长 / 上次刷新"的清晰指标。这种耦合让公众号侧无法独立发布时间窗口策略，也让用户无法快速判断每个能力的运行状态。

## What Changes

- **BREAKING**：拆分原 `monitor` 模块为两个独立 capability：`account-article-discovery`（公众号侧）与 `article-comment-monitor`（文章侧），每个 capability 拥有独立数据表、独立调度器、独立 UI 区块。
- 公众号发现侧：以"发布时间近 1.5 小时"为新文章过滤窗口（基于 `create_time`，而非沿用 `last_known_aid` 的纯增量比较），固定 5 分钟轮询；公众号列表展示"最后检查时间 + 本次是否检测到新文章 + 累计发现文章数"。
- 评论监控侧：每分钟刷一次，每条任务固定监控 1.5 小时（达到 `tracking_end_at` 后做一次最终采集，对比累积评论得到被盾评论），到点自动导出 Markdown + PDF；文章列表展示"上次刷新时间 + 累计评论数 + 剩余时长 + 被盾数"。
- 公众号发现到的新文章自动入队评论监控（保持与现状一致的"自动接力"链路），但两侧任务在数据与 UI 上彻底分离；任务带 `source: 'auto' | 'manual'` 字段以保留来源。
- 监控页面 UI 重构为两个清晰区块（公众号监控 / 文章评论监控），保留单一可用 Credential 面板，删除现有"自动 + 手动混排"的统一任务列表。
- 现有 `MonitorWatch` / `MonitorTask` 表执行一次性数据迁移到新表（`watched_account` / `comment_monitor_task`），旧表保留只读直至下一个版本删除。

## Capabilities

### New Capabilities
- `account-article-discovery`：公众号文章发现能力。维护被监控公众号列表，按固定周期检测每个公众号"近 1.5 小时内发布的新文章"，反馈检查结果到列表。
- `article-comment-monitor`：单篇文章评论持续监控能力。接收来自公众号发现或用户手动添加的文章，固定周期内持续累积评论，结束时识别被盾评论并自动导出报告。

### Modified Capabilities
<!-- 当前 openspec/specs/ 为空，无既有 capability 受影响。 -->

## Impact

- **代码**：
  - 新增 `store/v2/watchedAccount.ts`、`store/v2/commentMonitorTask.ts` 与对应 Dexie 迁移；`store/v2/monitor.ts` 标记 deprecated。
  - 新增 `utils/monitor/AccountDiscoveryPoller.ts`（取代 `ArticlePoller`，加入发布时间窗口过滤）与 `utils/monitor/CommentMonitorScheduler.ts`（合并 `CommentTracker` + `FinalCollector` 的职责，仅服务于 comment-monitor 任务）。
  - `composables/useMonitor.ts` 拆分为 `composables/useAccountDiscovery.ts` 与 `composables/useCommentMonitor.ts`。
  - `pages/dashboard/monitor.vue` 重构为双区块布局；保留 Credential 面板组件。
  - `utils/monitor/MonitorExporter.ts` 接口微调以接收新的 `CommentMonitorTask` 类型。
- **数据**：Dexie schema 升级一版，加入 `watched_account` 与 `comment_monitor_task` 两张新表；提供从旧表的一次性迁移函数。
- **依赖与 API**：无新外部依赖；继续复用 `apis/index.ts` 中的 `getArticleList` 与现有评论抓取链路。
- **UX**：监控页布局发生明显变化，但路由 `/dashboard/monitor` 不变。
