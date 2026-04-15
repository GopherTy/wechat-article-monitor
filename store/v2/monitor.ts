import type { Comment } from '~/types/comment';
import { db } from './db';

export interface MonitorWatch {
  fakeid: string;
  nickname: string;
  round_head_img: string;
  enabled: boolean;
  last_check_time: number;
  last_known_aid: string;
}

export interface MonitorTaskStats {
  read_num?: number;
  like_num?: number;
  old_like_num?: number;
}

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
}

export async function getAllWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.toArray();
}

export async function getEnabledWatches(): Promise<MonitorWatch[]> {
  return db.monitor_watch.filter((w) => w.enabled).toArray();
}

export async function addWatch(watch: MonitorWatch): Promise<void> {
  await db.monitor_watch.put(watch);
}

export async function removeWatch(fakeid: string): Promise<void> {
  await db.monitor_watch.delete(fakeid);
}

export async function updateWatch(fakeid: string, changes: Partial<MonitorWatch>): Promise<void> {
  await db.monitor_watch.update(fakeid, changes);
}

export async function createTask(task: Omit<MonitorTask, 'id'>): Promise<number> {
  return db.monitor_task.add(task as MonitorTask) as Promise<number>;
}

export async function getTasksByStatus(status: MonitorTask['status']): Promise<MonitorTask[]> {
  return db.monitor_task.where('status').equals(status).toArray();
}

export async function getAllTasks(): Promise<MonitorTask[]> {
  return db.monitor_task.orderBy('created_at').reverse().toArray();
}

export async function updateTask(id: number, changes: Partial<MonitorTask>): Promise<void> {
  await db.monitor_task.update(id, changes);
}

export async function deleteTask(id: number): Promise<void> {
  await db.monitor_task.delete(id);
}
