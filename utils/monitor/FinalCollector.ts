import { getArticleList, getComment } from '~/apis';
import type { Comment } from '~/types/comment';
import { getTasksByStatus, updateTask, type MonitorTask } from '~/store/v2/monitor';

export interface FinalCollectorEvents {
  'task-done': (task: MonitorTask) => void;
  'task-error': (taskId: number, error: Error) => void;
}

type ListenerMap = { [K in keyof FinalCollectorEvents]?: FinalCollectorEvents[K][] };

export class FinalCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: ListenerMap = {};
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

      const stats = await this.fetchArticleStats(task);

      let finalComments: Comment[] = [];
      if (task.comment_id) {
        const response = await getComment(task.comment_id);
        if (response) {
          finalComments = response.elected_comment ?? [];
        }
      }

      const shielded = (task.accumulated_comments ?? []).filter(
        (ac) => !finalComments.some((fc) => fc.content_id === ac.content_id),
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
      const target = articles.find((a) => a.aid === task.article_aid);
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
