## Context

文章监控页面（`pages/dashboard/monitor.vue`）当前由单一 composable `useMonitor.ts` 驱动，内部 new 出三个调度器并共用一张 `MonitorTask` 表：

- `ArticlePoller`（5min）扫公众号 → 用 `last_known_aid` 做增量发现 → 直接落 `MonitorTask` 进入 `tracking` 态。
- `CommentTracker`（60s）扫所有 `tracking` 态任务 → 累积评论 → 到 `tracking_end_at` 切 `final_collecting`。
- `FinalCollector`（60s）扫 `final_collecting` 态任务 → 拉最终评论 + stats → 对比累积差集得到被盾评论 → 自动导出 MD/PDF。

存在两个根本耦合：

1. **数据耦合**：自动发现的任务和手动添加的任务共用一张表，调度器只能用 `status` 做区分，`source`/生命周期/UI 视图都被迫共享。
2. **职责耦合**：`ArticlePoller.checkAccount` 在发现到新文章后直接 `createTask + syncMonitorTaskComments`，把"公众号侧的发现反馈"和"文章侧的评论抓取"绑死，无法独立调整发现窗口策略，公众号侧也拿不到"是否检测到新文章"等业务级反馈。

约束：

- 整个项目是 Nuxt 3 SPA + Dexie，存储侧没有迁移工具，需要走 Dexie `version().upgrade()` 自管。
- 微信公众平台 API 有调用频次限制，必须保留"5min × 60s"的现状节奏。
- 所有调度器都是浏览器单页内常驻，标签隐藏需暂停（`ArticlePoller` 已有，新调度器需保留同样语义）。

## Goals / Non-Goals

**Goals:**
- 把"公众号文章发现"与"文章评论监控"在数据模型、调度器、composable、UI 区块四层全部拆开，可单独启停、单独维护。
- 公众号侧引入"近 1.5h 发布时间窗口"过滤，并在公众号列表上给出"最后检查时间 / 本次是否发现新文章 / 累计发现数"三项反馈。
- 评论监控侧固定 1 分钟刷新 + 1.5h 生命周期，到点自动最终采集 + 自动导出 MD/PDF；列表展示"上次刷新时间 / 累计评论数 / 剩余时长 / 被盾数"。
- 保留"公众号发现的新文章自动入队评论监控"的接力链路，同时支持用户手动添加任意文章 URL。
- 提供从旧 `monitor_watch` / `monitor_task` 表的一次性数据迁移，迁移完成后旧表标记 deprecated 但暂不删除。

**Non-Goals:**
- 不重做评论抓取底层（`syncMonitorTaskComments`、`Downloader`）。
- 不重做导出器（`MonitorExporter`），仅适配新的任务类型。
- 不引入"用户自定义监控时长 / 周期"等可配置项，本期保持固定值。
- 不实现服务端持久化，沿用 Dexie + IndexedDB。
- 不做任务再触发（retry tracking）能力的扩展，沿用现有 `retryTask` 语义。

## Decisions

### Decision 1：数据层彻底拆表（two tables, no shared base）

新增两张 Dexie 表：
- `watched_account`：被监控的公众号。字段在 `MonitorWatch` 基础上加 `last_discovery_at`（最近一次"检测到新文章"的时间戳，用于在列表上区分"检查过 vs 检查到了"）、`discovered_count`（累计发现新文章数）。
- `comment_monitor_task`：单篇文章的评论监控任务。在 `MonitorTask` 基础上去掉对"自动 vs 手动"的隐式依赖，加 `source: 'auto' | 'manual'`、`source_fakeid?: string`（auto 来源时记录是哪个公众号触发的，方便回溯）、`last_sync_at: number`（最近一次 syncComments 的时间戳，UI 用来展示"上次刷新"）。
- 旧 `monitor_watch` / `monitor_task` 表在 Dexie schema 升级时保留 store，由 `version().upgrade()` 钩子把数据搬到新表，搬完后旧表的访问全部走 deprecated wrapper（仅供 fallback 调试用）。

**为什么不复用一张表加 `kind` 字段**：一张表会让 schema 同时表达两种实体（公众号 vs 文章任务），索引设计、查询接口都被迫变得宽泛；而我们的诉求恰恰是"两侧能完全独立演进"。两张表的代价是迁移多写一次，收益是 composable 与调度器都不用再写 `if (kind === ...)` 分支。

### Decision 2：调度器按能力对齐（一个 capability 一个调度器）

| 旧 | 新 | 说明 |
|---|---|---|
| `ArticlePoller` | `AccountDiscoveryPoller` | 5min 周期保留；引入 `DISCOVERY_WINDOW_MS = 1.5 * 60 * 60 * 1000` 过滤。新增 `discovered` 事件（参数：watch + 新文章列表）。**不再**直接 `createTask`，而是 emit 事件由 composable 决定是否入队评论监控。 |
| `CommentTracker` + `FinalCollector` | `CommentMonitorScheduler` | 合并为单调度器，60s 周期。内部按任务状态分发：`tracking` 走累积，`final_collecting` 走最终采集。事件粒度更细：`task-synced`（每次成功累积）、`task-finalized`（最终采集完成）、`task-error`。 |

**为什么合并 Tracker + FinalCollector**：两者共用同一张表的状态机切换，分两个调度器纯粹是历史包袱；合并后状态机推进在同一处，不会再出现"Tracker 切到 final_collecting 后必须等 FinalCollector 下一个 tick"的竞态窗口。

**发布时间窗口的具体语义**：`AccountDiscoveryPoller` 拉到 `getArticleList` 返回后，`new` 文章 = `create_time * 1000 >= now - DISCOVERY_WINDOW_MS` 的全部文章去重（按 `aid` 去重，且不在已知任务表中）。`last_known_aid` 仍然保留，用作"首次添加公众号时不立刻把历史文章全部当新文章"的兜底。

### Decision 3：Composable 一一对应 capability

- `composables/useAccountDiscovery.ts`：导出 `watches`、`enabledCount`、`addWatch`、`removeWatch`、`toggleWatch`、`startDiscovery`、`stopDiscovery`。
- `composables/useCommentMonitor.ts`：导出 `tasks`、`addManualArticle`、`removeTask`、`retryTask`、`toggleAutoTrack`、`exportMarkdown`、`exportPdf`、`startMonitor`、`stopMonitor`。
- `useMonitor.ts` 不再导出公开 API；保留为 thin facade（`useAccountDiscovery() + useCommentMonitor()` 的聚合）以便 `monitor.vue` 顶部状态条复用，**但**不再承担调度器生命周期管理。
- 接力链路：`useAccountDiscovery` 监听 `AccountDiscoveryPoller.on('discovered', ...)`，调用 `useCommentMonitor.enqueueAuto(article, watch)` 入队。两者通过模块级单例的 ref 共享状态，不引入 pinia/状态管理。

### Decision 4：UI 重构为双区块布局

`pages/dashboard/monitor.vue` 顶部状态条保留（同时显示两个能力的运行状态），下方主体改为两个并列 section：

```
┌─ 公众号监控 ────────────────────────────────┐
│ [+ 添加公众号]            [启动/暂停发现]    │
│ ┌──────────────────────────────────────┐ │
│ │ 头像 + 公众号名                        │ │
│ │ 最后检查 12:34:56 · 累计发现 3 篇       │ │
│ │ ✓ 本次发现 1 篇 / · 未发现新文章        │ │
│ └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘

┌─ 文章评论监控 ───────────────────────────────┐
│ [手动添加文章 URL]        [启动/暂停监控]    │
│ ┌──────────────────────────────────────┐ │
│ │ 文章标题                               │ │
│ │ 自动 / 手动 · 上次刷新 12:35 · 剩余 47min│ │
│ │ 累积 23 条 · 被盾 0 条                 │ │
│ │ [Markdown] [PDF] [删除]                │ │
│ └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘

┌─ 可用 Credential ─ (沿用) ────────────────┐
```

### Decision 5：迁移策略 — Dexie 单次 upgrade，旧表只读保留

- `store/v2/db.ts` 中的 Dexie 实例 `version(N+1)` 加新表，并在 `upgrade(tx)` 钩子中：
  1. 读 `monitor_watch` 全部记录 → 转换字段（补 `last_discovery_at = 0`、`discovered_count = 0`）→ `bulkPut` 到 `watched_account`。
  2. 读 `monitor_task` 全部记录 → 转换字段（`source = 'auto'`、`source_fakeid = task.fakeid`、`last_sync_at = task.created_at`）→ `bulkPut` 到 `comment_monitor_task`。
- 旧表 store 不删除，只保留只读 helper（`store/v2/monitor.ts` 标 `@deprecated`，仅用于排查问题）。下个版本再清理。
- 应用启动时如检测到 `comment_monitor_task` 为空且 `monitor_task` 非空，给一次性 toast 提示"已迁移 N 条任务到新表"。

## Risks / Trade-offs

- **[Risk] Dexie `upgrade` 失败导致用户丢任务** → Mitigation：迁移代码包 try/catch + 失败保留旧表数据 + 日志上报；写迁移单测（不在 OpenSpec 范围，但 tasks 中要求作者本地手动验证）。
- **[Risk] 拆 composable 后状态共享出问题（如重复启动调度器）** → Mitigation：调度器通过模块级单例 ref 暴露 `running` 状态，`startXxx` 内部 idempotent；新增 dev-only `console.warn` 兜底。
- **[Risk] "近 1.5h 发布"窗口与微信平台返回的 `create_time` 时区/精度不一致** → Mitigation：现有代码已统一用 `create_time * 1000`（秒级），保持一致；窗口边界不卡死（用 `>=` 而非 `>`）。
- **[Trade-off] 拆表导致多一次迁移代码与 schema 升级**：换来的是 composable / 调度器 / UI 三层全部解耦，长期维护性 win > 一次性迁移成本。
- **[Trade-off] 旧表暂不删除会占用 IndexedDB 空间**：单用户量级下可忽略，下版本统一清理。

## Migration Plan

1. **Phase 1（同一 PR 内）**：新表 schema + 数据迁移 + 双调度器上线，UI 直接切到新区块。旧 composable 保留为 thin facade 但内部不再 new 旧调度器。
2. **Phase 2（下个版本）**：删除旧表 store + 删除 `useMonitor.ts` facade + 清理 `MonitorWatch` / `MonitorTask` 类型导出。
3. **回滚**：若迁移阶段出现 IndexedDB 写入失败或评论调度异常，应用启动 fallback：检测到 schema 升级失败时 alert 用户，并保留旧调度器入口（隐藏在 dev flag 后）。本期不实现自动回滚 UI，由作者本地验证保证。
