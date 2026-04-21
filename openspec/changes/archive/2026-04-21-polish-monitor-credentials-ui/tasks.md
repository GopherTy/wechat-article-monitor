## 1. 评论快速预览组件

- [x] 1.1 新建 `components/dashboard/CommentPreviewPopover.vue`：props 仅 `comments: Comment[]`；按 `create_time` desc 全量展示；模板渲染 `nickname`（粗体）、完整 content（`whitespace-pre-wrap break-words`）、`dayjs(create_time*1000).fromNow()`、`like_num > 0` 时显示 `♡ N`；空数据展示"暂无评论"
- [x] 1.2 在 `CommentPreviewPopover.vue` setup 内一次性 `dayjs.extend(relativeTime); dayjs.locale('zh-cn')`；通过 `import('dayjs/plugin/relativeTime')` + `import('dayjs/locale/zh-cn')` 静态导入
- [x] 1.3 浮层根容器固定 `max-h-[60vh] overflow-y-auto`、`min-w-[320px] max-w-[480px]`，每条评论用 `border-b last:border-b-0` 分隔，配合 dark mode 类

## 2. monitor.vue 接入浮层

- [x] 2.1 在 `pages/dashboard/monitor.vue` 第 422-425 行 `template v-else 累积 N 条` 处包裹 `UPopover`：`mode="hover"`、`:open-delay="100"`、`:close-delay="200"`、`:popper="{ placement: 'top' }"`
- [x] 2.2 触发器 slot 保留原 `<span>累积 N 条</span>`；评论数为 0 时不渲染 `UPopover`（直接渲染 span），避免空浮层闪现
- [x] 2.3 浮层 panel slot 渲染 `<CommentPreviewPopover :comments="task.accumulated_comments" />`
- [ ] 2.4 验证 hover 移动到右侧操作按钮组（Markdown/PDF/重试/删除/暂停）时浮层在 200ms 内消失，按钮可正常点击

## 3. Credential 进度条组件

- [x] 3.1 新建 `components/global/CredentialExpiryBar.vue`：props `timestamp: number`；setup 内 `const now = ref(Date.now())`，`onMounted` 起 `setInterval(() => { now.value = Date.now() }, 1000)`，`onUnmounted` 清理
- [x] 3.2 在组件内引入 `import { CREDENTIAL_LIVE_MINUTES } from '~/config'`，computed `ttl = CREDENTIAL_LIVE_MINUTES * 60 * 1000`、`elapsed = now - timestamp`、`remaining = max(0, ttl - elapsed)`、`ratio = remaining / ttl`
- [x] 3.3 实现 `colorClass` computed：`ratio > 0.5 → green`、`(0.2, 0.5] → amber`、`(0, 0.2] → rose`、`≤ 0 → gray`；映射到 `UProgress :color="colorClass"`
- [x] 3.4 实现 `remainingText` computed：`ratio <= 0` 返回 `已过期`；否则 `剩余 X 分 Y 秒`（X = floor(remaining/60000)，Y = floor((remaining%60000)/1000)，前导 0）
- [x] 3.5 模板布局：`<UProgress :value="(elapsed / ttl) * 100" :color="colorClass" :max="100" size="xs" />` + 同行右侧小号 `<span class="text-xs">{{ remainingText }}</span>`

## 4. CredentialsDialog 接入

- [x] 4.1 在 `components/global/CredentialsDialog.vue` 每张 credential 卡片底部（第 70 行 `</UButton>` 和 `</div>` 闭合之前）追加 `<CredentialExpiryBar :timestamp="credential.timestamp" class="mt-3" />`
- [ ] 4.2 验证打开弹窗 30 秒内进度条与文案逐秒变化；关闭弹窗后无 console warning（确认 unmount 清理）
- [ ] 4.3 在浏览器手动验证跨过期边界：取一条 `timestamp` 调到 `Date.now() - 25*60*1000 + 30*1000` 的 credential，等 30 秒观察进度条由红→灰、文案由"剩余 X 秒"→"已过期"，且同卡片 badge 同步切换

## 5. 收尾验证

- [ ] 5.1 浏览器手动验证评论浮层：累积评论 N=0 / N=3 / N=20 三种场景，分别确认不弹/全显示 3 条/全显示 20 条且超出区域内部滚动
- [ ] 5.2 浏览器手动验证长内容：构造一条 content 长度 > 200 字符的评论，确认完整展示且自然换行，无字符截断
- [ ] 5.3 浏览器手动验证浮层不遮挡：hover 评论数后立即移到删除按钮，确认浮层消失且删除按钮可点击
- [x] 5.4 运行 `yarn format` 通过 Biome 检查；解决新文件的 lint warning
