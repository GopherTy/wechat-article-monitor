## Why

文章监控页（`pages/dashboard/monitor.vue`）目前对两类信息只露出原始数字：

- **累积评论数**：只显示 `累积 N 条`，要看具体评论必须导出 Markdown / PDF；高频用户在追踪过程中需要快速判断"这 N 条都是什么内容"以决定是否提前手动同步或废弃任务。
- **Credential 有效期**：Credentials 弹窗只用 `有效 / 已过期` 二值标记，但 credential TTL 仅 25 分钟（`CREDENTIAL_LIVE_MINUTES`），用户无法预判某条 credential 还能撑多久，常出现"刚选中就失效"。

这两项都是低风险、纯前端读取/展示的 UX 抛光，没有数据/调度链路改动，但能显著降低用户操作中断成本。

## What Changes

- **新增"评论快速预览"**：在 `monitor.vue` 文章评论监控列表里，hover `累积 N 条` 文本时弹出 popover，展示该任务 `accumulated_comments` 中按时间倒序的最近若干条（昵称 / 内容截断 / 发布时间 / 点赞数），超出部分用"还有 X 条"提示。仅在任务自动追踪未暂停且评论数 > 0 时启用。
- **新增 Credential 到期进度条**：在 `components/global/CredentialsDialog.vue` 的每张 credential 卡片底部，加一根进度条 + 倒计时文案（`剩余 X 分 Y 秒` 或 `已过期`），按剩余比例切换颜色（绿 / 黄 / 红 / 灰）。组件内部以 1s 节流自更新，不依赖外部刷新。

## Capabilities

### New Capabilities
- `comment-quick-preview`: 文章评论监控列表中的累积评论 hover 浮层展示能力
- `credentials-expiry-display`: Credentials 卡片的 TTL 倒计时与到期进度可视化能力

### Modified Capabilities
（无）

## Impact

- **受影响代码**：
  - `pages/dashboard/monitor.vue`：包裹 `累积 N 条` 为 `UPopover` 触发器，新增预览组件
  - 新增 `components/dashboard/CommentPreviewPopover.vue`（评论列表展示）
  - `components/global/CredentialsDialog.vue`：每张卡片底部追加进度条 + 倒计时
  - 新增 `components/global/CredentialExpiryBar.vue`（进度条 + 1s tick）
- **数据**：纯读取 `task.accumulated_comments` 与 `credential.timestamp`，不写库、不改 schema、不改调度
- **依赖**：复用现有 Nuxt UI 组件（`UPopover`、`UProgress`），不引入新依赖
- **风险**：极低；如需回退仅删除新增组件并恢复模板包裹即可
