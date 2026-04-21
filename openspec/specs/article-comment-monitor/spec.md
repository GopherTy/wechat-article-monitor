# article-comment-monitor Specification

## Purpose
TBD - created by archiving change refactor-article-monitor-split. Update Purpose after archive.
## Requirements
### Requirement: 评论监控任务的来源
系统 SHALL 支持两种来源的评论监控任务：来自公众号自动发现的 `auto` 任务，以及用户手动粘贴文章链接添加的 `manual` 任务；两者使用同一张表与同一套调度器，但来源字段必须显式记录。

#### Scenario: 手动添加文章
- **WHEN** 用户在监控页面粘贴一个公众号文章链接并点击添加
- **THEN** 系统下载该文章 HTML，解析出标题、公众号名、`fakeid`、`aid`、`comment_id`，在 `comment_monitor_task` 表创建一条记录，字段包括 `source = 'manual'`、`source_fakeid = undefined`、`status = 'tracking'`、`created_at = now`、`tracking_end_at = now + 1.5h`、`auto_track_enabled = true`，并立即同步一次评论

#### Scenario: 手动添加文章时 fakeid 缺失
- **WHEN** 用户提交的文章链接中 `__biz` 参数缺失（即 `parseArticleUrlMeta` 返回的 `fakeid === SINGLE_ARTICLE_FAKEID`）
- **THEN** 系统在初始化同步评论时调用 fakeid 修复链路，修复成功后回写到任务的 `fakeid` 字段；修复失败则该任务标记为 `error` 并提示用户

#### Scenario: 自动来源任务字段完整性
- **WHEN** 系统从公众号发现链路自动创建一条评论监控任务
- **THEN** 该任务的 `source = 'auto'` 且 `source_fakeid` 必须等于触发该任务的公众号 `fakeid`，UI 列表显示"自动 · 来源公众号名"

### Requirement: 周期性评论同步
系统 SHALL 以固定 1 分钟周期对所有 `status = 'tracking'` 且 `auto_track_enabled = true` 的评论监控任务执行一次评论拉取与累积合并。

#### Scenario: 累积新评论
- **WHEN** 一次同步成功返回评论列表
- **THEN** 系统将新评论按 `content_id` 去重合并到 `accumulated_comments`，更新 `last_sync_at = now`；UI 列表显示该任务的"上次刷新 HH:mm:ss · 累计 N 条"

#### Scenario: 暂停的任务被跳过
- **WHEN** 任务的 `auto_track_enabled = false`
- **THEN** 该任务在本轮被跳过，不更新 `last_sync_at`；UI 显示"已暂停"标记

#### Scenario: 同步失败
- **WHEN** 一次同步抛错
- **THEN** 任务保持 `tracking` 状态等待下一轮重试，UI 通过 toast 提示该任务的错误信息；若错误为登录过期，则全局停止评论监控调度器并提示用户重新登录

#### Scenario: 标签页隐藏时暂停
- **WHEN** 浏览器标签页被切换到隐藏状态
- **THEN** `CommentMonitorScheduler` 暂停定时器；恢复可见时立即执行一次同步并恢复 1 分钟周期

### Requirement: 1.5 小时生命周期与最终采集
系统 SHALL 为每条评论监控任务设定固定 1.5 小时的追踪生命周期，到期后自动执行一次最终采集并切换到 `done` 状态。

#### Scenario: 到达追踪结束时间
- **WHEN** 一次调度发现任务的 `now >= tracking_end_at` 且 `status = 'tracking'`
- **THEN** 系统将该任务状态切到 `final_collecting`，并在同一轮内（或下一轮）执行最终采集

#### Scenario: 最终采集完成
- **WHEN** 系统在 `final_collecting` 状态下完成评论拉取与文章 stats 拉取
- **THEN** 系统计算被盾评论 = 累积评论中 `content_id` 不在最终评论列表中的项；将 `final_comments`、`shielded_comments`、`stats` 写入任务并把 `status` 切到 `done`

#### Scenario: 最终采集失败
- **WHEN** 最终采集流程中某一步抛错
- **THEN** 任务状态切到 `error`，错误信息写入 `error_msg`；用户可手动点击重试将状态切回 `final_collecting`

#### Scenario: 完成后自动导出
- **WHEN** 一条任务进入 `done` 状态
- **THEN** 系统自动触发该任务的 Markdown 与 PDF 导出，导出失败仅记录日志且不影响任务完成态

### Requirement: 任务管理操作
系统 SHALL 为每条评论监控任务提供启停自动追踪、手动触发同步、手动导出、重试、删除等操作。

#### Scenario: 暂停 / 恢复自动追踪
- **WHEN** 用户在 `tracking` 状态任务上切换 `auto_track_enabled` 开关
- **THEN** 系统更新该字段；下一轮调度按新值决定是否拉取该任务的评论

#### Scenario: 手动触发同步
- **WHEN** 用户在 `tracking` 状态任务上点击"获取评论"
- **THEN** 系统立即对该任务执行一次同步，与定时调度共用同一份合并逻辑，结果反映到 `accumulated_comments` 与 `last_sync_at`

#### Scenario: 手动导出
- **WHEN** 用户对任意状态的任务点击 Markdown 或 PDF 导出
- **THEN** 系统基于该任务当前的累积/最终评论生成对应文件并触发浏览器下载

#### Scenario: 重试异常任务
- **WHEN** 用户在 `error` 状态任务上点击重试
- **THEN** 系统将状态切回 `final_collecting` 并清空 `error_msg`，等待下一轮 `CommentMonitorScheduler` 重新执行最终采集

#### Scenario: 删除任务
- **WHEN** 用户对任意状态任务点击删除
- **THEN** 系统从 `comment_monitor_task` 表删除该记录；不影响公众号 `discovered_count` 等历史统计

