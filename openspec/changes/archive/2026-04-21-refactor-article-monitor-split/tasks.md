## 1. 数据层与 Schema 迁移

- [x] 1.1 在 `store/v2/` 新建 `watchedAccount.ts`，定义 `WatchedAccount` 类型（在原 `MonitorWatch` 字段基础上增加 `last_discovery_at: number`、`discovered_count: number`），并实现 `getAllWatchedAccounts`、`getEnabledWatchedAccounts`、`addWatchedAccount`、`removeWatchedAccount`、`updateWatchedAccount` 等 CRUD 函数
- [x] 1.2 在 `store/v2/` 新建 `commentMonitorTask.ts`，定义 `CommentMonitorTask` 类型（在原 `MonitorTask` 字段基础上增加 `source: 'auto' | 'manual'`、`source_fakeid?: string`、`last_sync_at: number`），并实现 `createCommentMonitorTask`、`getAllCommentMonitorTasks`、`getCommentMonitorTasksByStatus`、`updateCommentMonitorTask`、`deleteCommentMonitorTask` 等 CRUD 函数
- [x] 1.3 在 `store/v2/db.ts` 注册两张新表 `watched_account: 'fakeid'`、`comment_monitor_task: '++id, fakeid, status, source, created_at'`，并升级 Dexie 到 `version(5)`
- [x] 1.4 在 `store/v2/db.ts` 的 `version(5)` 钩子中实现 `upgrade(tx)` 一次性迁移：把 `monitor_watch` 全部记录补默认值（`last_discovery_at = 0`、`discovered_count = 0`）写入 `watched_account`；把 `monitor_task` 全部记录补默认值（`source = 'auto'`、`source_fakeid = task.fakeid`、`last_sync_at = task.created_at`）写入 `comment_monitor_task`；迁移代码包 try/catch + console.error 兜底
- [x] 1.5 在 `store/v2/monitor.ts` 文件顶部加 `@deprecated` JSDoc 注释，并在所有导出函数标记 deprecated；不删除文件以便回退查询

## 2. 调度器拆分与重写

- [x] 2.1 新建 `utils/monitor/AccountDiscoveryPoller.ts`，复用原 `ArticlePoller` 的 visibility 与 5min 轮询骨架，**移除**任务创建逻辑；事件改为 `discovered(watch, articles)`、`watch-checked(fakeid, foundCount)`、`error(fakeid, error)`、`poll-complete()`
- [x] 2.2 在 `AccountDiscoveryPoller.checkAccount` 中实现"近 1.5h 发布时间窗口"过滤：常量 `DISCOVERY_WINDOW_MS = 1.5 * 60 * 60 * 1000`；新文章 = `getArticleList` 返回中满足 `create_time * 1000 >= now - DISCOVERY_WINDOW_MS` 且 `aid` 不在该公众号已有 `comment_monitor_task` 中的项；首次添加（`last_known_aid` 为空）时仍按窗口判定，但更新 `last_known_aid` 为列表中最大 aid
- [x] 2.3 在 `AccountDiscoveryPoller.checkAccount` 末尾按是否检测到新文章分两路更新 `watched_account`：未检测到只更新 `last_check_time + check_count`；检测到则同时更新 `last_discovery_at + discovered_count`
- [x] 2.4 新建 `utils/monitor/CommentMonitorScheduler.ts`，合并原 `CommentTracker` + `FinalCollector` 的职责：60s 周期 + visibility 暂停；按任务 `status` 分支：`tracking` 走累积同步（写 `last_sync_at`、合并 `accumulated_comments`），`final_collecting` 走最终采集（写 `final_comments`、`shielded_comments`、`stats`、自动导出 MD/PDF）；事件 `task-synced(taskId, totalCount)`、`task-finalized(task)`、`task-error(taskId, error)`、`credential-expiring()`
- [x] 2.5 在 `CommentMonitorScheduler` 内部实现 `tracking` → `final_collecting` 切换：判定条件 `now >= task.tracking_end_at`，切换后允许在同一轮立即触发最终采集（提前 emit `tracking-complete` 事件，便于 UI 刷新）
- [x] 2.6 删除（或在 `utils/monitor/` 内重命名为 `*.deprecated.ts`）`ArticlePoller.ts`、`CommentTracker.ts`、`FinalCollector.ts`，确保仅 `useMonitor.ts` 旧 facade 引用它们；新代码全部走新调度器

## 3. Composable 与接力链路

- [x] 3.1 新建 `composables/useAccountDiscovery.ts`，模块级单例：`watches: Ref<WatchedAccount[]>`、`enabledCount: ComputedRef<number>`、`discovering: Ref<boolean>`；导出 `addWatch`、`removeWatch`、`toggleWatch`、`startDiscovery`、`stopDiscovery`、`refreshWatches`；内部持有 `AccountDiscoveryPoller` 单例
- [x] 3.2 新建 `composables/useCommentMonitor.ts`，模块级单例：`tasks: Ref<CommentMonitorTask[]>`、`monitoring: Ref<boolean>`；导出 `addManualArticle`、`enqueueAuto`、`removeTask`、`retryTask`、`toggleAutoTrack`、`fetchTaskComments`、`exportMarkdown`、`exportPdf`、`startMonitor`、`stopMonitor`、`refreshTasks`；内部持有 `CommentMonitorScheduler` 单例
- [x] 3.3 在 `useAccountDiscovery` 中订阅 `AccountDiscoveryPoller.on('discovered', ...)`，回调里调用 `useCommentMonitor().enqueueAuto(article, watch)` 完成接力；`enqueueAuto` 内部创建 `source = 'auto'` 任务并立即跑一次 `syncMonitorTaskComments`，失败仅 toast 不阻断
- [x] 3.4 把 `composables/useMonitor.ts` 重写为 thin facade：内部调用 `useAccountDiscovery() + useCommentMonitor()`，仅导出聚合后的 `monitoring`（= `discovering || tasksMonitoring`）和 `credentials`，便于 `monitor.vue` 顶部状态条复用；删除原文件中的所有调度器初始化逻辑
- [x] 3.5 在两个 composable 的启动逻辑中加 idempotent 保护：`startXxx` 检测到已 running 直接 return；记录 dev-only `console.warn` 用于调试

## 4. UI 重构

- [x] 4.1 重构 `pages/dashboard/monitor.vue` 模板布局为：顶部状态条（聚合两个能力的状态） + 两个独立 section（公众号监控 / 文章评论监控） + Credential 面板；删除原"手动添加文章"独立 section（合并到文章评论监控 section 顶部）
- [x] 4.2 公众号监控 section：列表项展示头像 + 名称 + `enabled` 开关 + "最后检查 HH:mm:ss · 累计发现 N 篇" + "本次发现 M 篇 / 未发现新文章"标识 + 删除按钮；section 顶部按钮"添加公众号" + "启动/暂停发现"
- [x] 4.3 文章评论监控 section：顶部含"手动添加文章 URL"输入框 + "启动/暂停监控"按钮；列表项展示标题 + "auto/manual · 来源公众号名 · 上次刷新 HH:mm:ss · 剩余 NN min" + "累积 N 条 · 被盾 M 条" + 操作按钮组（Markdown/PDF/重试/删除/暂停自动追踪）；按 `status` 分支不同视图（tracking / final_collecting / done / error）
- [x] 4.4 把 `monitor.vue` 中所有 `useMonitor()` 调用拆分为 `useAccountDiscovery()` + `useCommentMonitor()`；保留 `useMonitor()` 仅用于顶部状态条聚合
- [x] 4.5 在 monitor.vue `onMounted` 中保留每 10s 一次的 `refreshTasks + refreshWatches` 兜底刷新，但仅在对应能力 monitoring/discovering 时执行

## 5. 适配与导出

- [x] 5.1 调整 `utils/monitor/MonitorExporter.ts` 的入参类型从 `MonitorTask` 改为 `CommentMonitorTask`；如字段访问对新增字段无依赖，保留实现不变；如有依赖则做向后兼容
- [x] 5.2 调整 `utils/monitor/task-sync.ts` 中 `syncMonitorTaskComments` 的入参/出参类型为 `CommentMonitorTask`；在合并 comments 后同时写入 `last_sync_at = Date.now()`
- [x] 5.3 全局搜索并替换所有对 `~/store/v2/monitor` 中 `MonitorTask` / `MonitorWatch` / `createTask` / `getAllTasks` 等的引用，迁移到新 store；旧 store 仅保留类型导出供 deprecated wrapper 使用

## 6. 收尾验证

- [ ] 6.1 在浏览器手动验证：清空 IndexedDB 后从零添加 1 个公众号 + 1 篇手动文章，观察两侧调度器周期是否正确（5min / 60s），公众号列表"最后检查时间"是否每 5min 更新，文章列表"上次刷新"是否每 60s 更新
- [ ] 6.2 在浏览器手动验证迁移路径：保留旧 `monitor_watch + monitor_task` 数据后升级到 `version(5)`，确认数据完整迁移到新表，UI 上原任务可见且字段无丢失
- [ ] 6.3 在浏览器手动验证 1.5h 生命周期边界：人工把任务的 `tracking_end_at` 改为 `Date.now() + 30000`，等 30s 后观察是否进入 `final_collecting` → `done` 并自动导出 MD/PDF
- [ ] 6.4 在浏览器手动验证发布时间窗口：人工构造一个 `create_time` 在 2 小时之前的"假新文章"（mock `getArticleList` 返回），确认 `AccountDiscoveryPoller` 不会将其计入新文章
- [x] 6.5 运行 `yarn format` 通过 Biome 检查；解决所有新文件的 lint warning
