import { getArticleList } from '~/apis';
import { getCommentMonitorTasksByFakeid } from '~/store/v2/commentMonitorTask';
import { getEnabledWatchedAccounts, updateWatchedAccount, type WatchedAccount } from '~/store/v2/watchedAccount';
import type { AppMsgEx } from '~/types/types';

/** "近 1.5h 发布"过滤窗口 */
export const DISCOVERY_WINDOW_MS = 1.5 * 60 * 60 * 1000;
/** 默认轮询周期：5 分钟 */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface AccountDiscoveryPollerEvents {
  /** 检测到 1 篇或多篇满足条件的新文章 */
  discovered: (watch: WatchedAccount, articles: AppMsgEx[]) => void;
  /** 完成对一个公众号的检查（无论是否有发现） */
  'watch-checked': (fakeid: string, foundCount: number) => void;
  /** 检查异常 */
  error: (fakeid: string, error: Error) => void;
  /** 完成一轮（所有 enabled 公众号都已检查） */
  'poll-complete': () => void;
}

type ListenerMap = { [K in keyof AccountDiscoveryPollerEvents]?: AccountDiscoveryPollerEvents[K][] };

export class AccountDiscoveryPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private listeners: ListenerMap = {};
  private polling = false;

  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  on<K extends keyof AccountDiscoveryPollerEvents>(event: K, fn: AccountDiscoveryPollerEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(fn);
  }

  removeAllListeners() {
    this.listeners = {};
  }

  private emit<K extends keyof AccountDiscoveryPollerEvents>(
    event: K,
    ...args: Parameters<AccountDiscoveryPollerEvents[K]>
  ) {
    for (const fn of this.listeners[event] ?? []) {
      (fn as (...a: any[]) => void)(...args);
    }
  }

  start() {
    if (this.intervalId) return;
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.intervalMs);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
      this.poll();
      this.intervalId = setInterval(() => this.poll(), this.intervalMs);
    }
  };

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const watches = await getEnabledWatchedAccounts();
      for (const watch of watches) {
        await this.checkAccount(watch);
      }
    } finally {
      this.polling = false;
      this.emit('poll-complete');
    }
  }

  /** 立即对指定 watch 执行一次检查（不影响轮询周期） */
  async checkOnce(watch: WatchedAccount) {
    await this.checkAccount(watch);
  }

  private async checkAccount(watch: WatchedAccount) {
    const nextCheckCount = (watch.check_count ?? 0) + 1;
    const now = Date.now();

    try {
      const account = {
        fakeid: watch.fakeid,
        nickname: watch.nickname,
        round_head_img: watch.round_head_img,
      };
      const [articles] = await getArticleList(account as any, 0);

      if (articles.length === 0) {
        await updateWatchedAccount(watch.fakeid, {
          last_check_time: now,
          check_count: nextCheckCount,
        });
        this.emit('watch-checked', watch.fakeid, 0);
        return;
      }

      const maxAid = articles.reduce((max, a) => (a.aid > max ? a.aid : max), articles[0].aid);
      const existingTasks = await getCommentMonitorTasksByFakeid(watch.fakeid);
      const knownAids = new Set(existingTasks.map(t => t.article_aid));

      const newArticles = articles.filter(a => {
        if (a.create_time * 1000 < now - DISCOVERY_WINDOW_MS) return false;
        return !knownAids.has(a.aid);
      });

      if (newArticles.length === 0) {
        await updateWatchedAccount(watch.fakeid, {
          last_check_time: now,
          check_count: nextCheckCount,
          last_known_aid: maxAid,
        });
        this.emit('watch-checked', watch.fakeid, 0);
        return;
      }

      this.emit('discovered', watch, newArticles);

      await updateWatchedAccount(watch.fakeid, {
        last_check_time: now,
        check_count: nextCheckCount,
        last_known_aid: maxAid,
        last_discovery_at: now,
        discovered_count: (watch.discovered_count ?? 0) + newArticles.length,
      });
      this.emit('watch-checked', watch.fakeid, newArticles.length);
    } catch (err) {
      await updateWatchedAccount(watch.fakeid, {
        last_check_time: now,
        check_count: nextCheckCount,
      });
      this.emit('watch-checked', watch.fakeid, 0);
      this.emit('error', watch.fakeid, err as Error);
    }
  }
}
