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
    if (watches.value.some((w) => w.fakeid === account.fakeid)) {
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

    tracker.on('comments-updated', async () => {
      await refreshTasks();
    });

    tracker.on('credential-expiring', () => {
      toast.warning('凭证即将过期', '请在手机微信中打开一篇被监控公众号的文章以刷新凭证');
    });

    tracker.on('tracking-complete', async () => {
      await refreshTasks();
    });

    collector.on('task-done', async (task) => {
      const shieldedCount = task.shielded_comments?.length ?? 0;
      const desc = shieldedCount > 0 ? `检测到 ${shieldedCount} 条被盾评论` : '未检测到被盾评论';
      toast.success('监控完成', `【${task.nickname}】${task.article_title} — ${desc}`);
      await refreshTasks();
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

  refreshWatches();
  refreshTasks();

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
    downloadTaskMarkdown,
    refreshTasks,
    refreshWatches,
  };
}
