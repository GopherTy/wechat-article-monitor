import { getArticleList, getComment } from '~/apis';
import type { Comment } from '~/types/comment';
import {
  getEnabledWatches,
  updateWatch,
  createTask,
  updateTask,
  type MonitorWatch,
  type MonitorTask,
} from '~/store/v2/monitor';
import { extractCommentId } from '~/utils/comment';
import { request } from '#shared/utils/request';

export interface ArticlePollerEvents {
  'new-article': (task: MonitorTask) => void;
  error: (fakeid: string, error: Error) => void;
  'poll-complete': () => void;
}

type ListenerMap = { [K in keyof ArticlePollerEvents]?: ArticlePollerEvents[K][] };

export class ArticlePoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private listeners: ListenerMap = {};
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

      const newArticles = watch.last_known_aid ? articles.filter((a) => a.aid > watch.last_known_aid) : [];

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

        const commentId = await this.fetchCommentId(article.link);
        if (commentId) {
          task.comment_id = commentId;
          const firstComments = await this.fetchFirstComments(commentId);
          await updateTask(id, {
            comment_id: commentId,
            accumulated_comments: firstComments,
          });
        }

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

  private async fetchFirstComments(commentId: string): Promise<Comment[]> {
    try {
      const response = await getComment(commentId);
      return response?.elected_comment ?? [];
    } catch {
      return [];
    }
  }

  private async fetchCommentId(articleUrl: string): Promise<string | null> {
    try {
      const credentials = JSON.parse(window.localStorage.getItem('credentials')!);
      const headers: Record<string, string> = {};
      if (credentials?.pass_ticket) {
        headers.cookie = `pass_ticket=${credentials.pass_ticket};wap_sid2=${credentials.wap_sid2}`;
      }
      const html = await request<string>(articleUrl, {
        timeout: 30000,
        referrerPolicy: 'unsafe-url',
      });
      return extractCommentId(html);
    } catch (err) {
      console.warn('[ArticlePoller] Failed to fetch comment_id:', err);
      return null;
    }
  }
}
