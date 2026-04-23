import { getArticleList } from '~/apis';
import {
  type CommentMonitorTask,
  getCommentMonitorTasksByStatus,
  updateCommentMonitorTask,
} from '~/store/v2/commentMonitorTask';
import { syncMonitorTaskComments } from '~/utils/monitor/task-sync';

/** 默认刷新周期：30 秒 */
const DEFAULT_INTERVAL_MS = 30 * 1000;
/** 凭证将过期的提醒周期：25 分钟 */
const CREDENTIAL_REFRESH_INTERVAL_MS = 25 * 60 * 1000;

export interface CommentMonitorSchedulerEvents {
  /** 一次累积同步成功 */
  'task-synced': (taskId: number, totalCount: number) => void;
  /** 任务从 tracking 切到 final_collecting */
  'tracking-complete': (taskId: number) => void;
  /** 一次最终采集完成，任务进入 done */
  'task-finalized': (task: CommentMonitorTask) => void;
  /** 一次同步或最终采集失败 */
  'task-error': (taskId: number, error: Error) => void;
  /** 凭证即将过期提醒（25min 一次） */
  'credential-expiring': () => void;
}

type ListenerMap = { [K in keyof CommentMonitorSchedulerEvents]?: CommentMonitorSchedulerEvents[K][] };

export class CommentMonitorScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private credentialReminderId: ReturnType<typeof setInterval> | null = null;
  private listeners: ListenerMap = {};
  private working = false;
  private readonly intervalMs: number;

  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  on<K extends keyof CommentMonitorSchedulerEvents>(event: K, fn: CommentMonitorSchedulerEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(fn);
  }

  removeAllListeners() {
    this.listeners = {};
  }

  private emit<K extends keyof CommentMonitorSchedulerEvents>(
    event: K,
    ...args: Parameters<CommentMonitorSchedulerEvents[K]>
  ) {
    for (const fn of this.listeners[event] ?? []) {
      (fn as (...a: any[]) => void)(...args);
    }
  }

  start() {
    if (this.intervalId) return;
    this.tick();
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    this.credentialReminderId = setInterval(() => {
      this.emit('credential-expiring');
    }, CREDENTIAL_REFRESH_INTERVAL_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
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
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  isRunning() {
    return this.intervalId !== null;
  }

  private handleVisibility = () => {
    if (document.hidden) {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    } else {
      this.tick();
      this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    }
  };

  private async tick() {
    if (this.working) return;
    this.working = true;
    try {
      // 先处理 tracking：累积或切换到 final_collecting
      const trackingTasks = await getCommentMonitorTasksByStatus('tracking');
      for (const task of trackingTasks) {
        if (Date.now() >= task.tracking_end_at) {
          await updateCommentMonitorTask(task.id!, { status: 'final_collecting' });
          this.emit('tracking-complete', task.id!);
          continue;
        }
        if (task.auto_track_enabled === false) continue;
        await this.syncTrackingTask(task);
      }

      // 再处理 final_collecting：包括上面同轮刚切过去的
      const finalizingTasks = await getCommentMonitorTasksByStatus('final_collecting');
      for (const task of finalizingTasks) {
        await this.finalizeTask(task);
      }
    } finally {
      this.working = false;
    }
  }

  private async syncTrackingTask(task: CommentMonitorTask) {
    try {
      const result = await syncMonitorTaskComments(task);
      this.emit('task-synced', task.id!, result.mergedComments.length);
    } catch (err) {
      this.emit('task-error', task.id!, err as Error);
    }
  }

  private async finalizeTask(task: CommentMonitorTask) {
    try {
      await updateCommentMonitorTask(task.id!, { status: 'exporting' });

      const stats = await this.fetchArticleStats(task);
      const result = await syncMonitorTaskComments(task);
      const finalComments = result.latestComments;

      const shielded = result.mergedComments.filter(ac => !finalComments.some(fc => fc.content_id === ac.content_id));

      await updateCommentMonitorTask(task.id!, {
        final_comments: finalComments,
        shielded_comments: shielded,
        stats,
        status: 'done',
      });

      const updated: CommentMonitorTask = {
        ...result.task,
        final_comments: finalComments,
        shielded_comments: shielded,
        stats,
        status: 'done',
      };
      this.emit('task-finalized', updated);
    } catch (err) {
      await updateCommentMonitorTask(task.id!, {
        status: 'error',
        error_msg: (err as Error).message,
      });
      this.emit('task-error', task.id!, err as Error);
    }
  }

  private async fetchArticleStats(task: CommentMonitorTask) {
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
      // stats are non-critical
    }
    return {};
  }
}
