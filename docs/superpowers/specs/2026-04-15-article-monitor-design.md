# 公众号文章监控与被盾评论检测

## 概述

在 wechat-article-exporter 中新增定时监控能力：自动检测关注的公众号是否发布新文章，发现后立即拉取内容，持续 2 小时追踪评论变化，最终通过 diff 找出被删除/屏蔽的评论，生成带被盾评论标记的 Markdown + PDF 导出。

## 核心目标

解决公众号评论大量被盾（删除/屏蔽）的问题。通过持续采集评论快照，捕捉被审核删除的评论内容，完整保留文章发布后的评论全貌。

## 约束条件

- 运行在浏览器客户端（开着网页即监控，关掉即停止）
- 监控公众号数量 ≤5 个
- 每 5 分钟检查一次新文章
- 依赖现有的微信公众平台后台登录态（MP session）拉取文章列表
- 依赖现有的 reader credential（mitmproxy 抓取）拉取评论。评论接口需要 `__biz`、`pass_ticket`、`key`、`uin` 四个字段，来自 `localStorage` 中的 `credentials`。这些凭证有效期约 25-30 分钟，远短于 2 小时追踪窗口。CommentTracker 需要每隔 25 分钟通过 toast 提醒用户在手机微信中打开任意一篇被监控公众号的文章，mitmproxy 会自动抓取新的 credential。如果 credential 过期且未刷新，CommentTracker 记录错误但不中断任务，等新 credential 到达后自动恢复追踪

## 数据模型

### `monitor_watch` — 监控列表

存储用户要监控的公众号。

| 字段 | 类型 | 说明 |
|------|------|------|
| `fakeid`（主键） | string | 公众号 ID |
| `nickname` | string | 公众号名称 |
| `round_head_img` | string | 头像 |
| `enabled` | boolean | 是否启用监控 |
| `last_check_time` | number | 上次检查时间戳 |
| `last_known_aid` | string | 上次已知最新文章的 aid |

### `monitor_task` — 监控任务

每检测到一篇新文章，创建一条任务记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id`（主键，自增） | number | 任务 ID |
| `fakeid` | string | 公众号 ID |
| `nickname` | string | 公众号名称 |
| `article_url` | string | 文章链接 |
| `article_title` | string | 文章标题 |
| `article_aid` | string | 文章 aid |
| `comment_id` | string | 文章的 comment_id |
| `status` | string | `tracking` / `final_collecting` / `exporting` / `done` / `error` |
| `created_at` | number | 任务创建时间 |
| `tracking_end_at` | number | 评论追踪结束时间（created_at + 2h） |
| `accumulated_comments` | Comment[] | 2 小时内累积的所有去重评论 |
| `final_comments` | Comment[] | 2 小时后拉取的最终评论 |
| `shielded_comments` | Comment[] | diff 出的被盾评论 |
| `stats` | object | 阅读量、点赞数等统计数据 |
| `error_msg` | string | 错误信息 |

在 Dexie 中新增 `version(4)`，添加以上两张表。

## 核心调度架构

系统由三个独立模块组成，通过 `monitor_task` 的 `status` 字段驱动流转。

### ArticlePoller — 文章轮询器

- 驱动方式：`setInterval(5 * 60 * 1000)`
- 每次执行：遍历 `monitor_watch` 中 `enabled=true` 的公众号，调用 `getArticleList(account, 0)` 获取第一页
- 新文章判定：返回的文章中，所有 `aid` 大于 `last_known_aid` 的视为新文章
- 发现新文章后：
  1. 创建 `monitor_task` 记录，状态为 `tracking`
  2. 立即拉取文章 HTML 内容（复用现有 Downloader 单篇下载能力）
  3. 通过 `useToast()` 弹出站内通知
  4. 更新 `last_known_aid`
- 页面可见性处理：监听 `visibilitychange` 事件，页面隐藏时暂停 ArticlePoller 轮询，恢复时立即执行一次并重新开始计时。CommentTracker 和 FinalCollector 不暂停（避免遗漏评论快照），但浏览器可能会节流后台定时器，这是可接受的降级

### CommentTracker — 评论追踪器

- 驱动方式：`setInterval(60 * 1000)`
- 每次执行：扫描所有 `status === 'tracking'` 的任务
- 对每个任务调用 `getComment(comment_id)`，将 `elected_comment` 按 `content_id` 去重合并到 `accumulated_comments`
- 当 `Date.now() >= tracking_end_at` 时，将状态流转为 `final_collecting`
- Credential 刷新提醒：每隔 25 分钟通过 `useToast()` 弹出提醒"请在手机微信中打开一篇被监控公众号的文章以刷新凭证"。如果当前 credential 已过期（调用评论接口失败或 credential 的 `timestamp` 超过 25 分钟），在任务卡片上显示"凭证已过期"警告，但不中断任务。新 credential 被 mitmproxy 抓取后通过 WebSocket 推送至客户端，CommentTracker 自动恢复追踪

### FinalCollector — 最终采集器

- 驱动方式：`setInterval(60 * 1000)`
- 扫描 `status === 'final_collecting'` 的任务，执行：
  1. 调用 `getArticleList` 获取文章最新的 `read_num`、`like_num` 等统计字段
  2. 最后一次调用 `getComment` 获取最终评论，存入 `final_comments`
  3. Diff 找出被盾评论：`accumulated_comments` 中存在但 `final_comments` 中不存在的（按 `content_id` 匹配）
  4. 调用 MonitorExporter 生成 Markdown + PDF
  5. 状态流转为 `done`

### 状态流转

```
[ArticlePoller 每5分钟]
    ↓ 发现新文章
[创建 task: status=tracking]
    ↓
[CommentTracker 每1分钟] ← 持续2小时
    ↓ 2小时到期
[status=final_collecting]
    ↓
[FinalCollector]
    ↓ 拉统计 + 最终评论 + diff + 导出
[status=done]
```

三个模块互不依赖，只通过 status 字段协调。页面刷新后从 IndexedDB 恢复任务状态，继续执行未完成的任务。

## 被盾评论检测

### Diff 算法

```typescript
const shielded = accumulatedComments.filter(
  ac => !finalComments.some(fc => fc.content_id === ac.content_id)
);
```

按 `content_id`（微信评论唯一标识）匹配。2 小时内见过但最终不存在的即为被盾评论。

## 导出格式

### Markdown 结构

```markdown
# 文章标题

> 来源：公众号名称 | 发布时间：2026-04-15 20:00
> 阅读：12345 | 点赞：678 | 在看：234

（文章正文内容）

---

## 评论区

### ⚠️ 被盾评论（共 N 条）

| 昵称 | 评论内容 | 点赞数 |
|------|---------|--------|
| 张三 | 评论内容... | 42 |

### 精选评论（共 M 条）

1. **李四** (👍 128)：评论内容...
   - 作者回复：回复内容...
2. ...
```

### PDF

从 Markdown 转 PDF，复用现有 Exporter 的 PDF 导出能力。

## UI 设计

### 新增页面：`pages/dashboard/monitor.vue`

与现有 dashboard 子页面同级，侧边栏新增"监控"入口。

**上半部分——监控列表**

卡片列表展示正在监控的公众号（≤5个）：
- 公众号头像 + 名称
- 启用/禁用开关
- 上次检查时间
- 添加/移除按钮（添加时复用 `getAccountList` 搜索）

**下半部分——任务列表**

每行一条监控任务：
- 文章标题 + 公众号名称
- 状态标签：追踪中 / 最终采集中 / 导出中 / 已完成 / 异常
- 追踪中显示进度：已追踪 45/120 分钟，已累积 32 条评论
- 已完成显示结果：被盾 3 条 / 总计 28 条，可下载 Markdown/PDF
- 异常显示错误信息和重试按钮

**站内通知**

使用 Nuxt UI 的 `useToast()` 弹出通知："【公众号名称】发布了新文章：文章标题"。

## 文件结构

```
composables/
  useMonitor.ts              # 主入口，初始化三个模块，暴露状态和操作方法

utils/monitor/
  ArticlePoller.ts           # 文章轮询器
  CommentTracker.ts          # 评论追踪器
  FinalCollector.ts          # 最终采集 + diff + 导出
  MonitorExporter.ts         # 封装 Exporter，处理被盾评论注入

store/v2/
  monitor.ts                 # monitor_watch + monitor_task 的 CRUD 操作
  db.ts                      # 新增 version(4)，加两张表

pages/dashboard/
  monitor.vue                # 监控页面
```

### 对现有文件的改动

- `store/v2/db.ts`：新增 `version(4)`，添加 `monitor_watch` 和 `monitor_task` 表
- 侧边栏组件：新增"监控"入口链接指向 `/dashboard/monitor`
- 不改动现有核心逻辑
