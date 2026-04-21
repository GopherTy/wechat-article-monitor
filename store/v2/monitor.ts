/**
 * @deprecated v5 起请使用 `~/store/v2/watchedAccount` 与 `~/store/v2/commentMonitorTask`。
 * 本文件保留仅供回退查询，所有导出 API 不应在新代码中使用。
 */
import type { Comment } from '~/types/comment';
import { db } from './db';

/** @deprecated 请使用 `WatchedAccount` */
export interface MonitorWatch {
  fakeid: string;
  nickname: string;
  round_head_img: string;
  enabled: boolean;
  last_check_time: number;
  last_known_aid: string;
  check_count?: number;
}

/** @deprecated 请使用 `CommentMonitorTaskStats` */
export interface MonitorTaskStats {
  read_num?: number;
  like_num?: number;
  old_like_num?: number;
}

/** @deprecated 请使用 `CommentMonitorTask` */
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
  auto_track_enabled?: boolean;
}

/** @deprecated 请使用 `getAllWatchedAccounts` */
export async function getAllWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.toArray();
}

/** @deprecated 请使用 `getEnabledWatchedAccounts` */
export async function getEnabledWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.filter(w => w.enabled).toArray();
}

/** @deprecated 请使用 `addWatchedAccount` */
export async function addWatch(watch: MonitorWatch): Promise<void> {
  await db.monitor_watch.put(watch);
}

/** @deprecated 请使用 `removeWatchedAccount` */
export async function removeWatch(fakeid: string): Promise<void> {
  await db.monitor_watch.delete(fakeid);
}

/** @deprecated 请使用 `updateWatchedAccount` */
export async function updateWatch(fakeid: string, changes: Partial<MonitorWatch>): Promise<void> {
  await db.monitor_watch.update(fakeid, changes);
}

/** @deprecated 请使用 `createCommentMonitorTask` */
export async function createTask(task: Omit<MonitorTask, 'id'>): Promise<number> {
  return db.monitor_task.add(task as MonitorTask) as Promise<number>;
}

/** @deprecated 请使用 `getCommentMonitorTasksByStatus` */
export async function getTasksByStatus(status: MonitorTask['status']): Promise<MonitorTask[]> {
  return db.monitor_task.where('status').equals(status).toArray();
}

/** @deprecated 请使用 `getAllCommentMonitorTasks` */
export async function getAllTasks(): Promise<MonitorTask[]> {
  return db.monitor_task.orderBy('created_at').reverse().toArray();
}

/** @deprecated 请使用 `updateCommentMonitorTask` */
export async function updateTask(id: number, changes: Partial<MonitorTask>): Promise<void> {
  await db.monitor_task.update(id, changes);
}

/** @deprecated 请使用 `deleteCommentMonitorTask` */
export async function deleteTask(id: number): Promise<void> {
  await db.monitor_task.delete(id);
}
