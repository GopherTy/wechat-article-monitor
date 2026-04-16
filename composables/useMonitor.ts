import toastFactory from '~/composables/toast';
import {
  addWatch,
  createTask,
  deleteTask,
  getAllTasks,
  getAllWatches,
  type MonitorTask,
  type MonitorWatch,
  removeWatch,
  updateTask,
  updateWatch,
} from '~/store/v2/monitor';
import type { ParsedCredential } from '~/types/credential';
import { extractCommentId } from '~/utils/comment';
import { downloadArticleHTML } from '~/utils/index';
import { ArticlePoller } from '~/utils/monitor/ArticlePoller';
import { CommentTracker } from '~/utils/monitor/CommentTracker';
import { FinalCollector } from '~/utils/monitor/FinalCollector';
import { generateMonitorHtml, generateMonitorMarkdown } from '~/utils/monitor/MonitorExporter';
import { ensureMonitorTaskArticleStub, parseArticleUrlMeta, syncMonitorTaskComments } from '~/utils/monitor/task-sync';

const MAX_WATCH_COUNT = 5;
const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);

let poller: ArticlePoller | null = null;
let tracker: CommentTracker | null = null;
let collector: FinalCollector | null = null;
let articlePollingPausedByAuth = false;

const watches = ref<MonitorWatch[]>([]);
const tasks = ref<MonitorTask[]>([]);
const monitoring = ref(false);

export default function useMonitor() {
  const toast = toastFactory();

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getWatchName(fakeid: string) {
    return watches.value.find(watch => watch.fakeid === fakeid)?.nickname || fakeid;
  }

  function isCredentialExpiredError(error: Error) {
    return /未登录或登录已过期|session expired/i.test(error.message);
  }

  function stopMonitoringForExpiredCredential(message: string) {
    if (!monitoring.value) return;
    stopMonitoring();
    toast.warning('监控已停止', message);
  }

  function stopArticlePollingForExpiredSession() {
    if (articlePollingPausedByAuth) return;
    articlePollingPausedByAuth = true;
    poller?.stop();
    poller = null;
    toast.warning('新文章轮询已暂停', '公众号后台登录已过期，现有监控任务会继续追踪评论');
  }

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

    if (!monitoring.value) {
      startMonitoring();
    }
  }

  async function removeWatchAccount(fakeid: string) {
    await removeWatch(fakeid);
    await refreshWatches();

    if (watches.value.length === 0 && monitoring.value) {
      stopMonitoring();
    }
  }

  async function toggleWatch(fakeid: string, enabled: boolean) {
    await updateWatch(fakeid, { enabled });
    await refreshWatches();
  }

  function startMonitoring() {
    if (monitoring.value) return;
    articlePollingPausedByAuth = false;

    poller = new ArticlePoller();
    tracker = new CommentTracker();
    collector = new FinalCollector();

    poller.on('new-article', async task => {
      toast.success('新文章', `【${task.nickname}】${task.article_title}`);
      await refreshTasks();
    });

    poller.on('error', (fakeid, error) => {
      console.error(`[Monitor] Poll error for ${fakeid}:`, error);
      toast.error('监控失败', `【${getWatchName(fakeid)}】${error.message}`);
      if (isCredentialExpiredError(error)) {
        stopArticlePollingForExpiredSession();
      }
    });

    tracker.on('comments-updated', async () => {
      await refreshTasks();
    });

    tracker.on('error', async (taskId, error) => {
      const task = tasks.value.find(item => item.id === taskId);
      const taskName = task ? `【${task.article_title}】` : `任务 ${taskId}`;
      console.error(`[Monitor] Track error for ${taskId}:`, error);
      toast.error('评论追踪失败', `${taskName}${error.message}`);
      if (isCredentialExpiredError(error)) {
        stopMonitoringForExpiredCredential('检测到登录已过期，请重新扫码登录后再开始监控');
      }
      await refreshTasks();
    });

    tracker.on('credential-expiring', () => {
      toast.warning('凭证即将过期', '请在手机微信中打开一篇被监控公众号的文章以刷新凭证');
    });

    tracker.on('tracking-complete', async () => {
      await refreshTasks();
    });

    collector.on('task-done', async task => {
      const shieldedCount = task.shielded_comments?.length ?? 0;
      const desc = shieldedCount > 0 ? `检测到 ${shieldedCount} 条被盾评论` : '未检测到被盾评论';
      toast.success('监控完成', `【${task.nickname}】${task.article_title} — ${desc}`);
      await refreshTasks();

      try {
        await downloadTaskMarkdown(task);
      } catch {
        console.error(`[Monitor] 自动导出 Markdown 失败: ${task.article_title}`);
      }
      try {
        await downloadTaskPdf(task);
      } catch {
        console.error(`[Monitor] 自动导出 PDF 失败: ${task.article_title}`);
      }
    });

    collector.on('task-error', async (_taskId, error) => {
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
    articlePollingPausedByAuth = false;
    monitoring.value = false;
  }

  async function retryTask(taskId: number) {
    await updateTask(taskId, {
      status: 'final_collecting',
      error_msg: '',
    });
    await refreshTasks();
  }

  async function toggleTaskAutoTrack(taskId: number, enabled: boolean) {
    await updateTask(taskId, { auto_track_enabled: enabled });
    await refreshTasks();
  }

  async function removeTask(taskId: number) {
    await deleteTask(taskId);
    await refreshTasks();
  }

  async function downloadTaskMarkdown(task: MonitorTask) {
    try {
      const md = await generateMonitorMarkdown(task);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      downloadBlob(`${task.article_title}-监控报告.md`, blob);
      toast.success('Markdown 导出完成', `【${task.article_title}】已导出`);
    } catch (error) {
      toast.error('Markdown 导出失败', (error as Error).message);
      throw error;
    }
  }

  async function downloadTaskPdf(task: MonitorTask) {
    try {
      const html = await generateMonitorHtml(task);
      const response = await fetch('/api/web/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      });
      if (!response.ok) {
        throw new Error(`PDF 生成失败: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      downloadBlob(`${task.article_title}-监控报告.pdf`, blob);
      toast.success('PDF 导出完成', `【${task.article_title}】已导出`);
    } catch (error) {
      toast.error('PDF 导出失败', (error as Error).message);
      throw error;
    }
  }

  async function addArticleManually(articleUrl: string) {
    try {
      toast.info('正在加载文章...', '通过代理下载文章 HTML');

      const html = await downloadArticleHTML(articleUrl);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('#activity-name')?.textContent?.trim() || '未知标题';
      const nickname = doc.querySelector('#js_name')?.textContent?.trim() || '未知公众号';
      const { fakeid, aid } = parseArticleUrlMeta(articleUrl);

      const commentId = extractCommentId(html) || '';

      const now = Date.now();
      const task: Omit<MonitorTask, 'id'> = {
        fakeid,
        nickname,
        article_url: articleUrl,
        article_title: title,
        article_aid: aid,
        comment_id: commentId,
        status: 'tracking',
        created_at: now,
        tracking_end_at: now + 1.5 * 60 * 60 * 1000,
        accumulated_comments: [],
        final_comments: [],
        shielded_comments: [],
        stats: {},
        error_msg: '',
        auto_track_enabled: true,
      };

      const id = await createTask(task);
      const createdTask = { ...task, id };
      await ensureMonitorTaskArticleStub(createdTask);
      await refreshTasks();

      toast.success('添加成功', `【${nickname}】${title}，正在自动抓取评论...`);
      try {
        const result = await syncMonitorTaskComments(createdTask);
        await refreshTasks();
        toast.success('评论抓取完成', `获取到 ${result.latestComments.length} 条评论`);
      } catch (e) {
        const errMsg = (e as Error).message;
        const isCredentialIssue = /Credential|未设置/i.test(errMsg);
        toast.warning(
          isCredentialIssue ? '添加成功，但无法抓取评论' : '评论抓取失败',
          `${errMsg}${isCredentialIssue ? '，请先配置该公众号的 Credential' : '，可稍后手动抓取'}`
        );
      }
    } catch (err) {
      toast.error('添加失败', (err as Error).message);
    }
  }

  async function fetchTaskComments(taskId: number): Promise<void> {
    const task = tasks.value.find(t => t.id === taskId);
    if (!task) return;

    try {
      const result = await syncMonitorTaskComments(task);
      await refreshTasks();
      toast.success(
        '获取评论成功',
        `本次获取 ${result.latestComments.length} 条，累计 ${result.mergedComments.length} 条评论`
      );
    } catch (e) {
      toast.error('获取评论失败', (e as Error).message);
    }
  }

  refreshWatches().then(() => {
    if (watches.value.length > 0 && !monitoring.value) {
      startMonitoring();
    }
  });
  refreshTasks();

  return {
    watches,
    tasks,
    monitoring,
    credentials,
    addWatchAccount,
    removeWatchAccount,
    toggleWatch,
    startMonitoring,
    stopMonitoring,
    retryTask,
    removeTask,
    toggleTaskAutoTrack,
    downloadTaskMarkdown,
    downloadTaskPdf,
    addArticleManually,
    fetchTaskComments,
    refreshTasks,
    refreshWatches,
  };
}
