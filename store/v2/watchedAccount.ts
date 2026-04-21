import { db } from './db';

export interface WatchedAccount {
  fakeid: string;
  nickname: string;
  round_head_img: string;
  enabled: boolean;
  last_check_time: number;
  last_known_aid: string;
  check_count: number;
  /** 最近一次"检测到新文章"的时间戳；首次添加为 0 */
  last_discovery_at: number;
  /** 累计发现的新文章数 */
  discovered_count: number;
}

export async function getAllWatchedAccounts(): Promise<WatchedAccount[]> {
  return db.watched_account.toArray();
}

export async function getEnabledWatchedAccounts(): Promise<WatchedAccount[]> {
  return db.watched_account.filter(w => w.enabled).toArray();
}

export async function addWatchedAccount(watch: WatchedAccount): Promise<void> {
  await db.watched_account.put(watch);
}

export async function removeWatchedAccount(fakeid: string): Promise<void> {
  await db.watched_account.delete(fakeid);
}

export async function updateWatchedAccount(fakeid: string, changes: Partial<WatchedAccount>): Promise<void> {
  await db.watched_account.update(fakeid, changes);
}
