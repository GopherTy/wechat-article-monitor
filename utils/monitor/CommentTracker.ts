import { getComment } from '~/apis';
import { getTasksByStatus, updateTask, type MonitorTask } from '~/store/v2/monitor';

const CREDENTIAL_REFRESH_INTERVAL_MS = 25 * 60 * 1000;

export interface CommentTrackerEvents {
  'comments-updated': (taskId: number, totalCount: number) => void;
  'credential-expiring': () => void;
  'tracking-complete': (taskId: number) => void;
  error: (taskId: number, error: Error) => void;
}

type ListenerMap = { [K in keyof CommentTrackerEvents]?: CommentTrackerEvents[K][] };

export class CommentTracker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private credentialReminderId: ReturnType<typeof setInterval> | null = null;
  private listeners: ListenerMap = {};
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
      const existingIds = new Set(existing.map((c) => c.content_id));

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
