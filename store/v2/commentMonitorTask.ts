import type { Comment } from '~/types/comment';
import { getStoreAdapter } from './adapters';

export interface CommentMonitorTaskStats {
  read_num?: number;
  like_num?: number;
  old_like_num?: number;
}

export interface CommentMonitorTask {
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
  stats: CommentMonitorTaskStats;
  error_msg: string;
  auto_track_enabled: boolean;
  /** 任务来源：'auto' 来自公众号自动发现；'manual' 由用户手动添加 URL */
  source: 'auto' | 'manual';
  /** 当 source=auto 时，记录触发该任务的公众号 fakeid */
  source_fakeid?: string;
  /** 最近一次成功拉取评论的时间戳；0 表示还未同步过 */
  last_sync_at: number;
  /**
   * 评论 content_id → 首次被监控到的时间戳（毫秒）。
   * 用于计算"存活时长"。
   */
  comment_first_seen_at?: Record<string, number>;
  /**
   * 评论 content_id → 首次监控不到的时间戳（毫秒）。
   * 评论若再次出现会被清除；finalize 时仍存在的视为"被盾时间"。
   */
  comment_shielded_at?: Record<string, number>;
}

export async function createCommentMonitorTask(task: Omit<CommentMonitorTask, 'id'>): Promise<number> {
  return getStoreAdapter().createCommentMonitorTask(task);
}

export async function getAllCommentMonitorTasks(): Promise<CommentMonitorTask[]> {
  return getStoreAdapter().getAllCommentMonitorTasks();
}

export async function getCommentMonitorTasksByStatus(
  status: CommentMonitorTask['status']
): Promise<CommentMonitorTask[]> {
  return getStoreAdapter().getCommentMonitorTasksByStatus(status);
}

export async function getCommentMonitorTasksByFakeid(fakeid: string): Promise<CommentMonitorTask[]> {
  return getStoreAdapter().getCommentMonitorTasksByFakeid(fakeid);
}

export async function updateCommentMonitorTask(id: number, changes: Partial<CommentMonitorTask>): Promise<void> {
  await getStoreAdapter().updateCommentMonitorTask(id, changes);
}

export async function deleteCommentMonitorTask(id: number): Promise<void> {
  await getStoreAdapter().deleteCommentMonitorTask(id);
}
