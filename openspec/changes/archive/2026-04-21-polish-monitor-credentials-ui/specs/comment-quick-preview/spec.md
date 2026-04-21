## ADDED Requirements

### Requirement: 累积评论 hover 浮层入口

文章评论监控列表中显示 `累积 N 条` 的元素 SHALL 在用户鼠标悬停时触发评论详情浮层；浮层 MUST 仅在任务的 `auto_track_enabled !== false` 且 `accumulated_comments.length > 0` 时可触发。

#### Scenario: 自动追踪暂停时不触发浮层
- **WHEN** 任务 `auto_track_enabled === false`
- **THEN** 列表项展示"自动抓取已暂停"文案而非评论数，且不渲染 hover 触发器

#### Scenario: 评论为空时不触发浮层
- **WHEN** 任务 `auto_track_enabled !== false` 且 `accumulated_comments.length === 0`
- **THEN** 累积数显示为 `累积 0 条`，鼠标悬停不弹出浮层

#### Scenario: 有评论时悬停展示浮层
- **WHEN** 用户鼠标悬停在 `累积 N 条`（N > 0）上
- **THEN** 系统在数字上方/下方弹出评论预览浮层，鼠标移出后浮层消失

### Requirement: 浮层评论列表渲染

评论预览浮层 SHALL 按 `create_time` 倒序展示 `accumulated_comments` 全部评论（不截断条数、不截断单条内容）；每条 MUST 展示昵称、完整内容、相对发布时间（如 `5 分钟前` / `刚刚` / `2 小时前`）、点赞数（>0 时显示）。条数较多时通过浮层内部纵向滚动承载。

#### Scenario: 全量倒序展示
- **WHEN** 任务累积评论 N ≥ 1
- **THEN** 浮层展示全部 N 条，按 `create_time` 倒序排列，无"还有更多"截断提示

#### Scenario: 长内容完整展示
- **WHEN** 单条评论 `content.length` 较大
- **THEN** 浮层中该条内容完整渲染，不做字符截断；通过 `whitespace-pre-wrap break-words` 自然换行

#### Scenario: 浮层数据实时反映 store
- **WHEN** 调度器在 hover 中将新评论合并入 `accumulated_comments`
- **THEN** 浮层内容随之响应式刷新，无需关闭重开

### Requirement: 浮层视觉与交互稳定性

浮层 SHALL 不阻挡用户对周边操作按钮（Markdown / PDF / 重试 / 删除 / 暂停）的点击；浮层最大高度 MUST 限制为视口高度的 60%，超出滚动；浮层 MUST 在 hover 离开 200ms 后关闭以避免抖动。

#### Scenario: 浮层不遮挡操作按钮
- **WHEN** 用户从累积数移动鼠标到右侧操作按钮
- **THEN** 浮层在 200ms 内消失，按钮可正常 hover/点击

#### Scenario: 长列表内部滚动
- **WHEN** 浮层内评论高度 > 视口 60%
- **THEN** 浮层固定最大高度，内部出现纵向滚动条
