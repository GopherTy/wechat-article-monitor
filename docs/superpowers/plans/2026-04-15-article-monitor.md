# 公众号文章监控与被盾评论检测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自动监控公众号新文章，持续追踪评论变化，检测被盾评论并导出完整文章+评论的 Markdown/PDF。

**Architecture:** 客户端三模块调度器（ArticlePoller → CommentTracker → FinalCollector），通过 IndexedDB 中 monitor_task 的 status 字段驱动状态流转。浏览器标签页内运行，复用现有 API 调用链路和导出能力。

**Tech Stack:** Vue 3 Composition API, Dexie (IndexedDB), Nuxt UI (useToast), 现有 APIs (getArticleList, getComment), 现有 Exporter

---

## File Structure

| File | Responsibility |
|------|---------------|
| `store/v2/db.ts` | 修改：新增 version(4)，添加 monitor_watch 和 monitor_task 表 |
| `store/v2/monitor.ts` | 新建：两张表的 TypeScript 类型定义 + CRUD 操作 |
| `utils/monitor/ArticlePoller.ts` | 新建：每 5 分钟轮询文章列表，检测新文章 |
| `utils/monitor/CommentTracker.ts` | 新建：每 1 分钟拉取评论，按 content_id 去重累积 |
| `utils/monitor/FinalCollector.ts` | 新建：最终采集统计数据 + 评论 diff + 触发导出 |
| `utils/monitor/MonitorExporter.ts` | 新建：生成带被盾评论标记的 Markdown + PDF |
| `composables/useMonitor.ts` | 新建：组合式函数，初始化三模块，暴露状态和方法给 UI |
| `pages/dashboard/monitor.vue` | 新建：监控页面（监控列表 + 任务列表） |
| `components/dashboard/NavMenus.vue` | 修改：侧边栏新增"监控"入口 |

---

### Task 1: 数据模型 — IndexedDB 表定义与 CRUD

**Files:**
- Modify: `store/v2/db.ts`
- Create: `store/v2/monitor.ts`

- [ ] **Step 1: 在 db.ts 中定义新表的类型引用和 Dexie 表声明**

在 `store/v2/db.ts` 的 import 区域添加类型引入，在 Dexie 实例中添加表声明，新增 version(4)：

```typescript
// 新增 import
import type { MonitorWatch, MonitorTask } from './monitor';

// 在 Dexie 类型声明中添加（与 article, comment 等同级）
monitor_watch: EntityTable<MonitorWatch, 'fakeid'>;
monitor_task: EntityTable<MonitorTask, 'id'>;

// 在文件末尾 db.version(3) 之后添加
db.version(4).stores({
  monitor_watch: 'fakeid',
  monitor_task: '++id, fakeid, status, created_at',
});
```

- [ ] **Step 2: 创建 store/v2/monitor.ts，定义类型和 CRUD 操作**

```typescript
import type { Comment } from '~/types/comment';
import { db } from './db';

export interface MonitorWatch {
  fakeid: string;
  nickname: string;
  round_head_img: string;
  enabled: boolean;
  last_check_time: number;
  last_known_aid: string;
}

export interface MonitorTaskStats {
  read_num?: number;
  like_num?: number;
  old_like_num?: number;
}

export interface MonitorTask {
  id?: number;
  fakeid: string;
  nickname: string;
  article_url: string;
  article_title: string;
  article_aid: string;
  comment_id: string;
  status: 'tracking' | 'final_collecting' | 'exporting' | 'done' | 'error';
  created_at: number;
  tracking_end_at: number;
  accumulated_comments: Comment[];
  final_comments: Comment[];
  shielded_comments: Comment[];
  stats: MonitorTaskStats;
  error_msg: string;
}

// --- MonitorWatch CRUD ---

export async function getAllWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.toArray();
}

export async function getEnabledWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.filter(w => w.enabled).toArray();
}

export async function addWatch(watch: MonitorWatch): Promise<void> {
  await db.monitor_watch.put(watch);
}

export async function removeWatch(fakeid: string): Promise<void> {
  await db.monitor_watch.delete(fakeid);
}

export async function updateWatch(fakeid: string, changes: Partial<MonitorWatch>): Promise<void> {
  await db.monitor_watch.update(fakeid, changes);
}

// --- MonitorTask CRUD ---

export async function createTask(task: Omit<MonitorTask, 'id'>): Promise<number> {
  return db.monitor_task.add(task as MonitorTask) as Promise<number>;
}

export async function getTasksByStatus(status: MonitorTask['status']): Promise<MonitorTask[]> {
  return db.monitor_task.where('status').equals(status).toArray();
}

export async function getAllTasks(): Promise<MonitorTask[]> {
  return db.monitor_task.orderBy('created_at').reverse().toArray();
}

export async function updateTask(id: number, changes: Partial<MonitorTask>): Promise<void> {
  await db.monitor_task.update(id, changes);
}

export async function deleteTask(id: number): Promise<void> {
  await db.monitor_task.delete(id);
}
```

- [ ] **Step 3: 验证数据库升级不会丢失现有数据**

在浏览器控制台打开应用，检查 IndexedDB 中 `exporter.wxdown.online` 数据库已升级到 version 4，新表 `monitor_watch` 和 `monitor_task` 已创建，现有表数据完好。

- [ ] **Step 4: Commit**

```bash
git add store/v2/db.ts store/v2/monitor.ts
git commit -m "feat(monitor): add IndexedDB tables for monitor_watch and monitor_task"
```

---

### Task 2: ArticlePoller — 文章轮询器

**Files:**
- Create: `utils/monitor/ArticlePoller.ts`

- [ ] **Step 1: 实现 ArticlePoller 类**

```typescript
import { getArticleList } from '~/apis';
import type { AppMsgEx } from '~/types/types';
import {
  getEnabledWatches,
  updateWatch,
  createTask,
  type MonitorWatch,
  type MonitorTask,
} from '~/store/v2/monitor';

export interface ArticlePollerEvents {
  'new-article': (task: MonitorTask) => void;
  'error': (fakeid: string, error: Error) => void;
  'poll-complete': () => void;
}

export class ArticlePoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private listeners: Partial<{ [K in keyof ArticlePollerEvents]: ArticlePollerEvents[K][] }> = {};
  private polling = false;

  constructor(intervalMs = 5 * 60 * 1000) {
    this.intervalMs = intervalMs;
  }

  on<K extends keyof ArticlePollerEvents>(event: K, fn: ArticlePollerEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(fn);
  }

  private emit<K extends keyof ArticlePollerEvents>(event: K, ...args: Parameters<ArticlePollerEvents[K]>) {
    for (const fn of this.listeners[event] ?? []) {
      (fn as (...a: any[]) => void)(...args);
    }
  }

  start() {
    if (this.intervalId) return;
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.intervalMs);

    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility = () => {
    if (document.hidden) {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    } else {
      this.poll();
      this.intervalId = setInterval(() => this.poll(), this.intervalMs);
    }
  };

  async poll() {
    if (this.polling) return;
    this.polling = true;

    try {
      const watches = await getEnabledWatches();
      for (const watch of watches) {
        await this.checkAccount(watch);
      }
    } finally {
      this.polling = false;
      this.emit('poll-complete');
    }
  }

  private async checkAccount(watch: MonitorWatch) {
    try {
      const account = {
        fakeid: watch.fakeid,
        nickname: watch.nickname,
        round_head_img: watch.round_head_img,
      };
      const [articles] = await getArticleList(account as any, 0);

      if (articles.length === 0) return;

      const newArticles = watch.last_known_aid
        ? articles.filter(a => a.aid > watch.last_known_aid)
        : [];

      // 首次添加监控时只记录最新 aid，不触发任务
      if (!watch.last_known_aid) {
        await updateWatch(watch.fakeid, {
          last_known_aid: articles[0].aid,
          last_check_time: Date.now(),
        });
        return;
      }

      for (const article of newArticles) {
        const now = Date.now();
        const task: Omit<MonitorTask, 'id'> = {
          fakeid: watch.fakeid,
          nickname: watch.nickname,
          article_url: article.link,
          article_title: article.title,
          article_aid: article.aid,
          comment_id: '',
          status: 'tracking',
          created_at: now,
          tracking_end_at: now + 2 * 60 * 60 * 1000,
          accumulated_comments: [],
          final_comments: [],
          shielded_comments: [],
          stats: {},
          error_msg: '',
        };
        const id = await createTask(task);
        this.emit('new-article', { ...task, id });
      }

      await updateWatch(watch.fakeid, {
        last_known_aid: articles[0].aid,
        last_check_time: Date.now(),
      });
    } catch (err) {
      this.emit('error', watch.fakeid, err as Error);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/monitor/ArticlePoller.ts
git commit -m "feat(monitor): implement ArticlePoller for periodic article checking"
```

---

### Task 3: CommentTracker — 评论追踪器

**Files:**
- Create: `utils/monitor/CommentTracker.ts`

- [ ] **Step 1: 实现 CommentTracker 类**

```typescript
import { getComment } from '~/apis';
import type { Comment } from '~/types/comment';
import { getTasksByStatus, updateTask, type MonitorTask } from '~/store/v2/monitor';

const CREDENTIAL_REFRESH_INTERVAL_MS = 25 * 60 * 1000;

export interface CommentTrackerEvents {
  'comments-updated': (taskId: number, totalCount: number) => void;
  'credential-expiring': () => void;
  'tracking-complete': (taskId: number) => void;
  'error': (taskId: number, error: Error) => void;
}

export class CommentTracker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private credentialReminderId: ReturnType<typeof setInterval> | null = null;
  private listeners: Partial<{ [K in keyof CommentTrackerEvents]: CommentTrackerEvents[K][] }> = {};
  private tracking = false;

  on<K extends keyof CommentTrackerEvents>(event: K, fn: CommentTrackerEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(fn);
  }

  private emit<K extends keyof CommentTrackerEvents>(event: K, ...args: Parameters<CommentTrackerEvents[K]>) {
    for (const fn of this.listeners[event] ?? []) {
      (fn as (...a: any[]) => void)(...args);
    }
  }

  start() {
    if (this.intervalId) return;
    this.track();
    this.intervalId = setInterval(() => this.track(), 60 * 1000);
    this.credentialReminderId = setInterval(() => {
      this.emit('credential-expiring');
    }, CREDENTIAL_REFRESH_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.credentialReminderId) {
      clearInterval(this.credentialReminderId);
      this.credentialReminderId = null;
    }
  }

  private async track() {
    if (this.tracking) return;
    this.tracking = true;

    try {
      const tasks = await getTasksByStatus('tracking');
      for (const task of tasks) {
        if (Date.now() >= task.tracking_end_at) {
          await updateTask(task.id!, { status: 'final_collecting' });
          this.emit('tracking-complete', task.id!);
          continue;
        }
        await this.fetchAndMergeComments(task);
      }
    } finally {
      this.tracking = false;
    }
  }

  private async fetchAndMergeComments(task: MonitorTask) {
    try {
      if (!task.comment_id) return;

      const response = await getComment(task.comment_id);
      if (!response) return;

      const newComments = response.elected_comment ?? [];
      const existing = task.accumulated_comments ?? [];
      const existingIds = new Set(existing.map(c => c.content_id));

      const merged = [...existing];
      for (const comment of newComments) {
        if (!existingIds.has(comment.content_id)) {
          merged.push(comment);
          existingIds.add(comment.content_id);
        }
      }

      await updateTask(task.id!, { accumulated_comments: merged });
      this.emit('comments-updated', task.id!, merged.length);
    } catch (err) {
      this.emit('error', task.id!, err as Error);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/monitor/CommentTracker.ts
git commit -m "feat(monitor): implement CommentTracker with credential refresh reminder"
```

---

### Task 4: FinalCollector — 最终采集与被盾检测

**Files:**
- Create: `utils/monitor/FinalCollector.ts`

- [ ] **Step 1: 实现 FinalCollector 类**

```typescript
import { getArticleList, getComment } from '~/apis';
import type { Comment } from '~/types/comment';
import { getTasksByStatus, updateTask, type MonitorTask } from '~/store/v2/monitor';

export interface FinalCollectorEvents {
  'task-done': (task: MonitorTask) => void;
  'task-error': (taskId: number, error: Error) => void;
}

export class FinalCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Partial<{ [K in keyof FinalCollectorEvents]: FinalCollectorEvents[K][] }> = {};
  private collecting = false;

  on<K extends keyof FinalCollectorEvents>(event: K, fn: FinalCollectorEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(fn);
  }

  private emit<K extends keyof FinalCollectorEvents>(event: K, ...args: Parameters<FinalCollectorEvents[K]>) {
    for (const fn of this.listeners[event] ?? []) {
      (fn as (...a: any[]) => void)(...args);
    }
  }

  start() {
    if (this.intervalId) return;
    this.collect();
    this.intervalId = setInterval(() => this.collect(), 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async collect() {
    if (this.collecting) return;
    this.collecting = true;

    try {
      const tasks = await getTasksByStatus('final_collecting');
      for (const task of tasks) {
        await this.finalCollect(task);
      }
    } finally {
      this.collecting = false;
    }
  }

  private async finalCollect(task: MonitorTask) {
    try {
      await updateTask(task.id!, { status: 'exporting' });

      // 1. 拉取文章最新统计数据
      const stats = await this.fetchArticleStats(task);

      // 2. 最终评论拉取
      let finalComments: Comment[] = [];
      if (task.comment_id) {
        const response = await getComment(task.comment_id);
        if (response) {
          finalComments = response.elected_comment ?? [];
        }
      }

      // 3. Diff 找出被盾评论
      const shielded = (task.accumulated_comments ?? []).filter(
        ac => !finalComments.some(fc => fc.content_id === ac.content_id),
      );

      await updateTask(task.id!, {
        final_comments: finalComments,
        shielded_comments: shielded,
        stats: stats,
        status: 'done',
      });

      const updatedTask: MonitorTask = {
        ...task,
        final_comments: finalComments,
        shielded_comments: shielded,
        stats: stats,
        status: 'done',
      };
      this.emit('task-done', updatedTask);
    } catch (err) {
      await updateTask(task.id!, { status: 'error', error_msg: (err as Error).message });
      this.emit('task-error', task.id!, err as Error);
    }
  }

  private async fetchArticleStats(task: MonitorTask) {
    try {
      const account = { fakeid: task.fakeid, nickname: task.nickname, round_head_img: '' };
      const [articles] = await getArticleList(account as any, 0);
      const target = articles.find(a => a.aid === task.article_aid);
      if (target) {
        return {
          read_num: (target as any).read_num,
          like_num: (target as any).like_num,
          old_like_num: (target as any).old_like_num,
        };
      }
    } catch {
      // 统计数据非关键，失败不阻断流程
    }
    return {};
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/monitor/FinalCollector.ts
git commit -m "feat(monitor): implement FinalCollector with shielded comment diff"
```

---

### Task 5: MonitorExporter — 带被盾评论的导出

**Files:**
- Create: `utils/monitor/MonitorExporter.ts`

- [ ] **Step 1: 实现 MonitorExporter**

生成 Markdown 内容，包含文章元信息、被盾评论区和精选评论区。PDF 导出由调用方按需处理（可复用现有 Exporter 的 markdown→PDF 能力）。

```typescript
import dayjs from 'dayjs';
import type { Comment } from '~/types/comment';
import type { MonitorTask } from '~/store/v2/monitor';

function formatComment(comment: Comment): string {
  const likes = comment.like_num > 0 ? ` (👍 ${comment.like_num})` : '';
  let text = `- **${comment.nick_name}**${likes}：${comment.content}`;

  if (comment.reply_new?.reply_list?.length > 0) {
    for (const reply of comment.reply_new.reply_list) {
      text += `\n  - **${reply.nick_name}** 回复：${reply.content}`;
    }
  }
  return text;
}

function formatShieldedComment(comment: Comment): string {
  const likes = comment.like_num > 0 ? `${comment.like_num}` : '0';
  const content = comment.content.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const nick = comment.nick_name.replace(/\|/g, '\\|');
  return `| ${nick} | ${content} | ${likes} |`;
}

export function generateMonitorMarkdown(task: MonitorTask): string {
  const lines: string[] = [];

  lines.push(`# ${task.article_title}`);
  lines.push('');

  const publishTime = dayjs(task.created_at).format('YYYY-MM-DD HH:mm');
  const statParts = [`来源：${task.nickname}`, `发布时间：${publishTime}`];
  if (task.stats.read_num != null) statParts.push(`阅读：${task.stats.read_num}`);
  if (task.stats.like_num != null) statParts.push(`点赞：${task.stats.like_num}`);
  lines.push(`> ${statParts.join(' | ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 被盾评论
  lines.push('## 评论区');
  lines.push('');

  const shielded = task.shielded_comments ?? [];
  if (shielded.length > 0) {
    lines.push(`### ⚠️ 被盾评论（共 ${shielded.length} 条）`);
    lines.push('');
    lines.push('| 昵称 | 评论内容 | 点赞数 |');
    lines.push('|------|---------|--------|');
    for (const c of shielded) {
      lines.push(formatShieldedComment(c));
    }
    lines.push('');
  } else {
    lines.push('*未检测到被盾评论*');
    lines.push('');
  }

  // 精选评论
  const finalComments = task.final_comments ?? [];
  lines.push(`### 精选评论（共 ${finalComments.length} 条）`);
  lines.push('');
  if (finalComments.length > 0) {
    for (const c of finalComments) {
      lines.push(formatComment(c));
    }
  } else {
    lines.push('*暂无评论*');
  }
  lines.push('');

  // 监控元信息
  lines.push('---');
  lines.push('');
  lines.push(`*监控时间：${dayjs(task.created_at).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(task.tracking_end_at).format('HH:mm')}*`);
  lines.push(`*累积捕获评论：${(task.accumulated_comments ?? []).length} 条，最终评论：${finalComments.length} 条，被盾：${shielded.length} 条*`);
  lines.push('');

  return lines.join('\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/monitor/MonitorExporter.ts
git commit -m "feat(monitor): implement MonitorExporter for markdown with shielded comments"
```

---

### Task 6: useMonitor — 组合式函数

**Files:**
- Create: `composables/useMonitor.ts`

- [ ] **Step 1: 实现 useMonitor composable**

整合三个模块，暴露响应式状态和操作方法给 UI 层。

```typescript
import toastFactory from '~/composables/toast';
import {
  type MonitorWatch,
  type MonitorTask,
  getAllWatches,
  getAllTasks,
  addWatch,
  removeWatch,
  updateWatch,
  deleteTask,
  updateTask,
} from '~/store/v2/monitor';
import { ArticlePoller } from '~/utils/monitor/ArticlePoller';
import { CommentTracker } from '~/utils/monitor/CommentTracker';
import { FinalCollector } from '~/utils/monitor/FinalCollector';
import { generateMonitorMarkdown } from '~/utils/monitor/MonitorExporter';

const MAX_WATCH_COUNT = 5;

let initialized = false;
let poller: ArticlePoller | null = null;
let tracker: CommentTracker | null = null;
let collector: FinalCollector | null = null;

const watches = ref<MonitorWatch[]>([]);
const tasks = ref<MonitorTask[]>([]);
const monitoring = ref(false);

export default function useMonitor() {
  const toast = toastFactory();

  async function refreshWatches() {
    watches.value = await getAllWatches();
  }

  async function refreshTasks() {
    tasks.value = await getAllTasks();
  }

  async function addWatchAccount(account: { fakeid: string; nickname: string; round_head_img: string }) {
    if (watches.value.length >= MAX_WATCH_COUNT) {
      toast.warning('监控上限', `最多监控 ${MAX_WATCH_COUNT} 个公众号`);
      return;
    }
    if (watches.value.some(w => w.fakeid === account.fakeid)) {
      toast.warning('重复添加', '该公众号已在监控列表中');
      return;
    }

    await addWatch({
      fakeid: account.fakeid,
      nickname: account.nickname,
      round_head_img: account.round_head_img,
      enabled: true,
      last_check_time: 0,
      last_known_aid: '',
    });
    await refreshWatches();
    toast.success('添加成功', `已添加监控：${account.nickname}`);
  }

  async function removeWatchAccount(fakeid: string) {
    await removeWatch(fakeid);
    await refreshWatches();
  }

  async function toggleWatch(fakeid: string, enabled: boolean) {
    await updateWatch(fakeid, { enabled });
    await refreshWatches();
  }

  function startMonitoring() {
    if (monitoring.value) return;

    poller = new ArticlePoller();
    tracker = new CommentTracker();
    collector = new FinalCollector();

    poller.on('new-article', async (task) => {
      toast.success('新文章', `【${task.nickname}】${task.article_title}`);
      await refreshTasks();
    });

    poller.on('error', (fakeid, error) => {
      console.error(`[Monitor] Poll error for ${fakeid}:`, error);
    });

    tracker.on('comments-updated', async (_taskId, totalCount) => {
      await refreshTasks();
    });

    tracker.on('credential-expiring', () => {
      toast.warning('凭证即将过期', '请在手机微信中打开一篇被监控公众号的文章以刷新凭证');
    });

    tracker.on('tracking-complete', async (taskId) => {
      await refreshTasks();
    });

    collector.on('task-done', async (task) => {
      const shieldedCount = task.shielded_comments?.length ?? 0;
      const desc = shieldedCount > 0
        ? `检测到 ${shieldedCount} 条被盾评论`
        : '未检测到被盾评论';
      toast.success('监控完成', `【${task.nickname}】${task.article_title} — ${desc}`);
      await refreshTasks();
    });

    collector.on('task-error', async (taskId, error) => {
      toast.error('采集失败', error.message);
      await refreshTasks();
    });

    poller.start();
    tracker.start();
    collector.start();
    monitoring.value = true;
  }

  function stopMonitoring() {
    poller?.stop();
    tracker?.stop();
    collector?.stop();
    poller = null;
    tracker = null;
    collector = null;
    monitoring.value = false;
  }

  async function retryTask(taskId: number) {
    await updateTask(taskId, {
      status: 'final_collecting',
      error_msg: '',
    });
    await refreshTasks();
  }

  async function removeTask(taskId: number) {
    await deleteTask(taskId);
    await refreshTasks();
  }

  function exportTaskMarkdown(task: MonitorTask): string {
    return generateMonitorMarkdown(task);
  }

  async function downloadTaskMarkdown(task: MonitorTask) {
    const md = generateMonitorMarkdown(task);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.article_title}-监控报告.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!initialized) {
    initialized = true;
    refreshWatches();
    refreshTasks();
  }

  return {
    watches,
    tasks,
    monitoring,
    addWatchAccount,
    removeWatchAccount,
    toggleWatch,
    startMonitoring,
    stopMonitoring,
    retryTask,
    removeTask,
    exportTaskMarkdown,
    downloadTaskMarkdown,
    refreshTasks,
    refreshWatches,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add composables/useMonitor.ts
git commit -m "feat(monitor): implement useMonitor composable as main entry point"
```

---

### Task 7: 侧边栏新增入口

**Files:**
- Modify: `components/dashboard/NavMenus.vue`

- [ ] **Step 1: 在导航菜单中添加"监控"入口**

在 `components/dashboard/NavMenus.vue` 的 `items` 数组中，在"合集下载"之后、"公共代理"之前插入一项：

```typescript
  { name: '合集下载', icon: 'i-lucide:library-big', href: '/dashboard/album' },
  { name: '文章监控', icon: 'i-lucide:radar', href: '/dashboard/monitor' },
  { name: '公共代理', icon: 'i-lucide:globe', href: '/dashboard/proxy' },
```

只需添加中间那一行即可。

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/NavMenus.vue
git commit -m "feat(monitor): add monitor nav entry to sidebar"
```

---

### Task 8: 监控页面 UI

**Files:**
- Create: `pages/dashboard/monitor.vue`

- [ ] **Step 1: 实现监控页面**

页面分两部分：上方是监控列表管理（添加/移除/开关公众号），下方是任务列表（状态、进度、操作）。

```vue
<script setup lang="ts">
import { getAccountList } from '~/apis';
import type { AccountInfo } from '~/types/types';
import useMonitor from '~/composables/useMonitor';
import type { MonitorTask } from '~/store/v2/monitor';
import dayjs from 'dayjs';

const {
  watches,
  tasks,
  monitoring,
  addWatchAccount,
  removeWatchAccount,
  toggleWatch,
  startMonitoring,
  stopMonitoring,
  retryTask,
  removeTask,
  downloadTaskMarkdown,
  refreshTasks,
} = useMonitor();

// 搜索添加公众号
const searchKeyword = ref('');
const searchResults = ref<AccountInfo[]>([]);
const searching = ref(false);
const showSearch = ref(false);

async function searchAccount() {
  if (!searchKeyword.value.trim()) return;
  searching.value = true;
  try {
    const [list] = await getAccountList(0, searchKeyword.value);
    searchResults.value = list;
  } catch (e) {
    console.error(e);
  } finally {
    searching.value = false;
  }
}

async function onAddAccount(account: AccountInfo) {
  await addWatchAccount({
    fakeid: account.fakeid,
    nickname: account.nickname,
    round_head_img: account.round_head_img,
  });
  showSearch.value = false;
  searchKeyword.value = '';
  searchResults.value = [];
}

function getStatusLabel(status: MonitorTask['status']) {
  const map: Record<string, { label: string; color: string }> = {
    tracking: { label: '追踪中', color: 'sky' },
    final_collecting: { label: '最终采集中', color: 'orange' },
    exporting: { label: '导出中', color: 'violet' },
    done: { label: '已完成', color: 'green' },
    error: { label: '异常', color: 'rose' },
  };
  return map[status] ?? { label: status, color: 'gray' };
}

function getTrackingProgress(task: MonitorTask) {
  const elapsed = Math.min(Date.now() - task.created_at, task.tracking_end_at - task.created_at);
  const total = task.tracking_end_at - task.created_at;
  return Math.round((elapsed / total) * 100);
}

function getTrackingTimeText(task: MonitorTask) {
  const elapsedMin = Math.round((Date.now() - task.created_at) / 60000);
  const totalMin = Math.round((task.tracking_end_at - task.created_at) / 60000);
  return `${Math.min(elapsedMin, totalMin)}/${totalMin} 分钟`;
}

// 自动刷新任务列表
let refreshInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  refreshInterval = setInterval(() => {
    if (monitoring.value) refreshTasks();
  }, 10000);
});
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<template>
  <div class="p-6 overflow-y-auto h-full">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- 标题 & 总控 -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">文章监控</h1>
        <UButton
          :color="monitoring ? 'rose' : 'primary'"
          @click="monitoring ? stopMonitoring() : startMonitoring()"
        >
          {{ monitoring ? '停止监控' : '开始监控' }}
        </UButton>
      </div>

      <!-- 监控列表 -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">监控列表（{{ watches.length }}/5）</h2>
          <UButton size="sm" variant="outline" @click="showSearch = true">
            <UIcon name="i-lucide:plus" class="mr-1" />添加公众号
          </UButton>
        </div>

        <div v-if="watches.length === 0" class="text-center py-8 text-gray-500">
          暂未添加监控公众号，点击上方按钮添加
        </div>

        <div v-else class="grid gap-3">
          <div
            v-for="w in watches"
            :key="w.fakeid"
            class="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <img :src="w.round_head_img" class="w-10 h-10 rounded-full" />
            <div class="flex-1">
              <p class="font-medium">{{ w.nickname }}</p>
              <p v-if="w.last_check_time" class="text-xs text-gray-500">
                上次检查：{{ dayjs(w.last_check_time).format('HH:mm:ss') }}
              </p>
            </div>
            <UToggle :model-value="w.enabled" @update:model-value="toggleWatch(w.fakeid, $event)" />
            <UButton size="xs" color="rose" variant="ghost" @click="removeWatchAccount(w.fakeid)">
              <UIcon name="i-lucide:trash-2" />
            </UButton>
          </div>
        </div>
      </section>

      <!-- 搜索添加弹窗 -->
      <UModal v-model="showSearch">
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">添加监控公众号</h3>
          <div class="flex gap-2">
            <UInput v-model="searchKeyword" placeholder="搜索公众号名称" class="flex-1" @keyup.enter="searchAccount" />
            <UButton :loading="searching" @click="searchAccount">搜索</UButton>
          </div>
          <div v-if="searchResults.length" class="space-y-2 max-h-80 overflow-y-auto">
            <div
              v-for="account in searchResults"
              :key="account.fakeid"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="onAddAccount(account)"
            >
              <img :src="account.round_head_img" class="w-8 h-8 rounded-full" />
              <div>
                <p class="font-medium text-sm">{{ account.nickname }}</p>
                <p class="text-xs text-gray-500">{{ account.signature }}</p>
              </div>
            </div>
          </div>
        </div>
      </UModal>

      <!-- 任务列表 -->
      <section>
        <h2 class="text-lg font-semibold mb-4">监控任务</h2>

        <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500">
          暂无监控任务，开始监控后检测到新文章会自动创建
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="p-4 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ task.article_title }}</p>
                <p class="text-sm text-gray-500">{{ task.nickname }} · {{ dayjs(task.created_at).format('MM-DD HH:mm') }}</p>
              </div>
              <UBadge :color="getStatusLabel(task.status).color" variant="subtle">
                {{ getStatusLabel(task.status).label }}
              </UBadge>
            </div>

            <!-- 追踪中：进度 -->
            <div v-if="task.status === 'tracking'" class="mt-3">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>已追踪 {{ getTrackingTimeText(task) }}</span>
                <span>累积 {{ (task.accumulated_comments ?? []).length }} 条评论</span>
              </div>
              <UProgress :value="getTrackingProgress(task)" size="sm" />
            </div>

            <!-- 已完成：结果 -->
            <div v-if="task.status === 'done'" class="mt-3 flex items-center justify-between">
              <div class="text-sm">
                <span v-if="(task.shielded_comments ?? []).length > 0" class="text-rose-500 font-medium">
                  被盾 {{ task.shielded_comments.length }} 条
                </span>
                <span v-else class="text-green-500">未检测到被盾评论</span>
                <span class="text-gray-500 ml-2">/ 总计 {{ (task.final_comments ?? []).length }} 条评论</span>
              </div>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" @click="downloadTaskMarkdown(task)">
                  <UIcon name="i-lucide:download" class="mr-1" />Markdown
                </UButton>
              </div>
            </div>

            <!-- 异常：错误信息 -->
            <div v-if="task.status === 'error'" class="mt-3 flex items-center justify-between">
              <p class="text-sm text-rose-500">{{ task.error_msg }}</p>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" @click="retryTask(task.id!)">重试</UButton>
                <UButton size="xs" color="rose" variant="ghost" @click="removeTask(task.id!)">删除</UButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 在浏览器中访问 `/dashboard/monitor`，验证页面渲染正常**

检查：侧边栏"文章监控"入口可点击，页面两个区域正常展示空状态。

- [ ] **Step 3: Commit**

```bash
git add pages/dashboard/monitor.vue
git commit -m "feat(monitor): implement monitor dashboard page with watch list and task list"
```

---

### Task 9: 集成验证

- [ ] **Step 1: 端到端功能验证**

1. 访问 `/dashboard/monitor`
2. 搜索并添加一个公众号到监控列表
3. 点击"开始监控"
4. 等待 5 分钟或手动调用 `poller.poll()`（在浏览器控制台）
5. 确认新文章检测、toast 通知、任务创建均正常
6. 确认评论追踪每分钟执行（查看控制台日志）
7. 确认 25 分钟后弹出 credential 刷新提醒

- [ ] **Step 2: 验证页面刷新后任务恢复**

1. 在追踪进行中刷新页面
2. 重新点击"开始监控"
3. 确认未完成的任务从 IndexedDB 恢复，继续追踪

- [ ] **Step 3: Commit 最终调整（如有）**

```bash
git add -A
git commit -m "feat(monitor): integration fixes and polish"
```
