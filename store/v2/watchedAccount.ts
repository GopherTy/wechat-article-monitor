import { getStoreAdapter } from './adapters';

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
  return getStoreAdapter().getAllWatchedAccounts();
}

export async function getEnabledWatchedAccounts(): Promise<WatchedAccount[]> {
  return getStoreAdapter().getEnabledWatchedAccounts();
}

export async function addWatchedAccount(watch: WatchedAccount): Promise<void> {
  await getStoreAdapter().putWatchedAccount(watch);
}

export async function removeWatchedAccount(fakeid: string): Promise<void> {
  await getStoreAdapter().removeWatchedAccount(fakeid);
}

export async function updateWatchedAccount(fakeid: string, changes: Partial<WatchedAccount>): Promise<void> {
  await getStoreAdapter().updateWatchedAccount(fakeid, changes);
}
