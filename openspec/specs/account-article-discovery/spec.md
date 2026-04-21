# account-article-discovery Specification

## Purpose
TBD - created by archiving change refactor-article-monitor-split. Update Purpose after archive.
## Requirements
### Requirement: 公众号监控列表管理
系统 SHALL 允许用户维护一份"被监控公众号"列表，并提供添加、删除、单条启停操作；列表上限保持为 5 个公众号。

#### Scenario: 通过搜索添加公众号
- **WHEN** 用户在监控页面通过搜索弹窗选中一个公众号
- **THEN** 系统将该公众号写入 `watched_account` 表，初始化 `enabled = true`、`discovered_count = 0`、`last_check_time = 0`、`last_discovery_at = 0`，并在列表中立即可见

#### Scenario: 删除已监控的公众号
- **WHEN** 用户对某个已监控的公众号点击删除
- **THEN** 系统从 `watched_account` 表中移除该记录；该公众号下未结束的"自动来源"评论监控任务保持不变（不级联删除）

#### Scenario: 暂停某个公众号的发现
- **WHEN** 用户在公众号项上关闭 enabled 开关
- **THEN** 该公众号在下一轮 `AccountDiscoveryPoller` 检查时被跳过；UI 列表上保留该条目并显示为已暂停

#### Scenario: 达到列表上限
- **WHEN** 当前已监控公众号数量为 5，用户尝试再添加一个
- **THEN** 系统拒绝添加并通过 toast 提示"最多监控 5 个公众号"

### Requirement: 周期性公众号文章发现
系统 SHALL 以固定 5 分钟周期对所有 `enabled = true` 的公众号执行新文章发现，并以"文章发布时间在最近 1.5 小时内"为新文章判定窗口。

#### Scenario: 检查到符合发布时间窗口的新文章
- **WHEN** 一个公众号本轮 `getArticleList` 返回的某篇文章满足 `create_time * 1000 >= now - 1.5h` 且其 `aid` 未出现在该公众号既有的评论监控任务中
- **THEN** 系统将该文章视为"新文章"，emit `discovered` 事件并将其纳入本轮发现计数

#### Scenario: 文章超出 1.5h 发布窗口
- **WHEN** 某篇返回文章的 `create_time * 1000 < now - 1.5h`
- **THEN** 系统忽略该文章，即便其 `aid > last_known_aid` 也不算作新文章

#### Scenario: 首次添加公众号锚定历史
- **WHEN** 一个公众号首次被检查（`last_known_aid` 为空）
- **THEN** 系统将本轮返回列表中最大的 `aid` 写入 `last_known_aid` 用于后续兜底，但**仍按发布时间窗口**决定本轮发现的新文章；首轮可能正常发现 0~N 篇

#### Scenario: 标签页隐藏时暂停轮询
- **WHEN** 浏览器标签页被切换到隐藏状态
- **THEN** `AccountDiscoveryPoller` 暂停定时器；标签页恢复可见时立即执行一次轮询并恢复 5 分钟周期

### Requirement: 公众号检查结果反馈
系统 SHALL 在每次对某公众号执行检查后更新该公众号的反馈字段，并使其反映在监控列表 UI 上。

#### Scenario: 本次未检测到新文章
- **WHEN** 一轮检查执行完毕，未匹配到任何"新文章"
- **THEN** 系统将该公众号的 `last_check_time` 更新为当前时间，`check_count` 自增 1，`last_discovery_at` 保持不变；UI 列表显示"最后检查 HH:mm:ss · 未发现新文章"

#### Scenario: 本次检测到新文章
- **WHEN** 一轮检查中匹配到 N（N ≥ 1）篇新文章
- **THEN** 系统将 `last_check_time` 更新为当前时间，`check_count` 自增 1，`discovered_count` 累加 N，`last_discovery_at` 更新为当前时间；UI 列表显示"最后检查 HH:mm:ss · 本次发现 N 篇 · 累计 M 篇"

#### Scenario: 检查异常
- **WHEN** 一轮检查抛错（含登录过期、网络错误）
- **THEN** 系统仍更新 `last_check_time` 与 `check_count`，UI 上以警示色提示错误信息；登录过期时同步暂停发现轮询并通过 toast 通知用户

### Requirement: 公众号发现到新文章后自动入队评论监控
系统 SHALL 在公众号发现到新文章后，自动为每篇新文章在 `comment_monitor_task` 表创建一条 `source = 'auto'` 的评论监控任务。

#### Scenario: 自动入队成功
- **WHEN** `AccountDiscoveryPoller` 在某轮 emit `discovered` 事件携带 1 篇或多篇新文章
- **THEN** 系统对每篇文章创建 `comment_monitor_task`，字段包括 `source = 'auto'`、`source_fakeid = watch.fakeid`、`status = 'tracking'`、`tracking_end_at = created_at + 1.5h`、`auto_track_enabled = true`，并向用户 toast 提示"【公众号名】检测到新文章：文章标题"

#### Scenario: 自动入队时初始化评论失败
- **WHEN** 系统创建任务后立即执行的初始化 `syncMonitorTaskComments` 抛错
- **THEN** 任务记录仍然落库（`accumulated_comments = []`、`last_sync_at = 0`），任务状态保持 `tracking` 等待下一次调度重试；通过 toast 提示初始化失败原因，但不阻断发现链路

