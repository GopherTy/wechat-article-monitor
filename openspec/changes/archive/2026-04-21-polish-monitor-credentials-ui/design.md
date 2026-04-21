## Context

`refactor-article-monitor-split` 已经完成监控页与调度链路的拆分，但页面上有两处 UX 信息密度不足：

1. **累积评论数只露出数字**：`pages/dashboard/monitor.vue` 第 424 行 `累积 {{ task.accumulated_comments.length }} 条`，用户必须导出才能看到内容。`task.accumulated_comments` 类型为 `Comment[]`（见 `types/comment.d.ts`），含 `nickname`、`content`、`create_time`、`like_num` 等可直接展示的字段。
2. **Credential 只有有效/过期二态**：`components/global/CredentialsDialog.vue` 第 58 行依赖 `credential.valid` 显示 badge；valid 由 `utils/credentials.ts:getCurrentCredentials` 基于 `now < timestamp + CREDENTIAL_LIVE_MINUTES * 60 * 1000` 计算，TTL = 25 分钟。但 `credential.timestamp` 在 store 中可用，可推算出剩余进度。

两项均为只读 UI 增强：不动调度、不动 store schema、不动 API。可作为独立小型 change 与 `refactor-article-monitor-split` 并行推进或顺序合入。

## Goals / Non-Goals

**Goals:**
- 用户在不离开监控页的前提下，鼠标悬停即可查看每个任务最近若干条评论
- 用户在 CredentialsDialog 中能直观看到每条 credential 还能存活多久（剩余分秒 + 进度条颜色分级）
- 复用现有 Nuxt UI 组件（`UPopover`、`UProgress`），不引入新依赖
- 进度条/倒计时在打开期间自更新，关闭后无背景 tick 泄漏

**Non-Goals:**
- 不实现评论回复展开（`replies` 字段保持仅在导出时使用）
- 不实现"点击评论跳转到原文锚点"等高级交互
- 不修改 Credential 的 TTL 或自动刷新机制
- 不在 monitor.vue 顶部的 Credential 状态条上加进度条（仅在 CredentialsDialog 内）

## Decisions

### 决策 1：用 `UPopover` 而非 `UTooltip` 承载评论预览

**选择**：`UPopover` + 触发模式 `hover` + `:open-delay="100" :close-delay="200"`。

**理由**：
- `UTooltip` 仅适合短文本，无法稳定承载多行结构化内容（昵称粗体、内容段落、时间戳右对齐）
- `UPopover` 默认支持 floating-ui 自动避让，避免在表格底部被遮挡
- 关闭延迟 200ms 防止用户在数字与浮层之间移动时浮层闪烁

**备选**：自写 `v-if + onmouseenter/leave` ——能实现但复用价值低，floating-ui 排版能力不复用浪费。

### 决策 2：评论全量展示，不截断条数与单条内容

**理由**：
- 浮层定位为"实时检查工具"，用户需要看到所有评论以做内容审查/被盾判断；任何截断都会迫使用户额外导出
- 浮层最大高度限制为视口 60%，超出走内部纵向滚动；不引入"还有 X 条"提示，避免埋藏数据
- 单条内容用 `whitespace-pre-wrap break-words` 自然换行，长评论靠列高承载即可

**备选**：保留 maxItems=8 + 80 字符截断 —— 浮层确实更紧凑，但与"做检查"用途冲突，丢弃

### 决策 3：浮层组件抽成 `CommentPreviewPopover.vue` 而非内联

**理由**：
- 模板里 `monitor.vue` 已经接近 600 行；评论项渲染（昵称/内容/时间/点赞）含 4-5 个 span，内联会让任务行可读性下降
- 单独组件易于以后复用到 `single.vue`（单文章详情）等场景
- props：`comments: Comment[]`、`maxItems = 8`、`maxContentLength = 80`；纯展示组件，无副作用

### 决策 4：进度条单独抽成 `CredentialExpiryBar.vue` + 内部 1s tick

**理由**：
- 把 setInterval 闭在子组件，避免污染 `CredentialsDialog`
- 同一弹窗多张卡片各自起一个 1s interval 可接受（上限 N=可见 credential 数，量级 < 10）；如果未来卡片很多再优化为单源 tick
- props：`timestamp: number`；内部用 `useIntervalFn`（VueUse 已是间接依赖）或纯 `setInterval` + `onUnmounted` 清理

**备选 A**：在 `CredentialsDialog` 顶层一个 tick 驱动所有进度条 —— 优化过早，且子组件解耦更可测
**备选 B**：用 CSS animation 让进度条平滑过渡 —— 实现成本高，且需要服务端时间偏差校准；放弃

### 决策 5：颜色分级阈值（剩余比例）

| 区间 | 颜色 | UProgress color |
|---|---|---|
| (0.5, 1.0] | 绿 | `green` |
| (0.2, 0.5] | 黄 | `amber` |
| (0, 0.2] | 红 | `rose` |
| ≤ 0 | 灰 | `gray` |

**理由**：与现有项目内 `getDownloadStatusColor` 等地方阈值习惯一致；25min TTL 下 5min 内必红，对应"该刷新了"的紧迫感。

### 决策 6：相对时间格式化复用 dayjs

**选择**：`monitor.vue` 已 `import dayjs from 'dayjs'`；新增 `dayjs/plugin/relativeTime` + `'dayjs/locale/zh-cn'`，在浮层组件 setup 内一次性 `dayjs.extend(relativeTime); dayjs.locale('zh-cn')`。

**理由**：
- dayjs relativeTime 中文输出符合需求（`5 分钟前`、`刚刚`、`2 小时前`）
- 已是项目依赖，无新增包

**备选**：自写 formatter ——边界处理（"刚刚" / "X 分钟前" / "X 小时前" / "昨天"）需要细致测试，不如复用成熟实现

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **多个 Credential 卡片各自起 setInterval 内存泄漏** | `onUnmounted` 显式 `clearInterval`；组件销毁即停 |
| **Popover hover 在触屏设备无效** | 移动端本就不是主要场景；可后续追加点击触发，本次不处理 |
| **`accumulated_comments` 在响应式数组很长时浮层渲染卡顿** | 模板用 `v-for` + `slice(0, 8)`，仅渲染 8 条；不存在 N 全量遍历 |
| **dayjs relativeTime 插件首次 extend 影响其他组件** | 在 `composables/useDayjs.ts` 或浮层组件内部惰性 extend 一次；幂等无副作用 |
| **进度条 1s tick 与 `getCurrentCredentials` 实时计算 valid 不同步**（极小窗口可能 badge 与进度条状态不一致） | 进度条计算采用与 `getCurrentCredentials` 完全相同的 `now < timestamp + ttl` 公式，同源即可避免 |
| **浮层遮挡导致用户误点删除按钮** | spec 要求 close-delay 200ms + popover 不覆盖按钮区域；通过 floating-ui 默认避让保证 |

## Migration Plan

无数据迁移、无配置变更。部署后用户刷新即可获得新 UI。回退仅需 revert 该 change 的 commit。
