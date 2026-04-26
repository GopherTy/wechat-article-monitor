/**
 * PATCH /api/db/monitor-tasks
 * 更新评论监控任务
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentMonitorTask } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);
  const { id, ...changes } = body;

  if (!id) {
    throw createError({ statusCode: 400, message: 'id is required' });
  }

  const setValues: Record<string, any> = {};
  if (changes.status !== undefined) setValues.status = changes.status;
  if (changes.tracking_end_at !== undefined) setValues.trackingEndAt = changes.tracking_end_at;
  if (changes.accumulated_comments !== undefined) setValues.accumulatedComments = changes.accumulated_comments;
  if (changes.final_comments !== undefined) setValues.finalComments = changes.final_comments;
  if (changes.shielded_comments !== undefined) setValues.shieldedComments = changes.shielded_comments;
  if (changes.stats !== undefined) setValues.stats = changes.stats;
  if (changes.error_msg !== undefined) setValues.errorMsg = changes.error_msg;
  if (changes.auto_track_enabled !== undefined) setValues.autoTrackEnabled = changes.auto_track_enabled;
  if (changes.last_sync_at !== undefined) setValues.lastSyncAt = changes.last_sync_at;
  if (changes.comment_first_seen_at !== undefined) setValues.commentFirstSeenAt = changes.comment_first_seen_at;
  if (changes.comment_shielded_at !== undefined) setValues.commentShieldedAt = changes.comment_shielded_at;

  await db.update(commentMonitorTask).set(setValues).where(eq(commentMonitorTask.id, id));
  return { success: true };
});
