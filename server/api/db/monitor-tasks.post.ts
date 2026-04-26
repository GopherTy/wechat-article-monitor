/**
 * POST /api/db/monitor-tasks
 * 新增或更新评论监控任务（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentMonitorTask } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) return { success: true, count: 0 };

  const values = items.map(item => ({
    ...(item.id ? { id: item.id } : {}),
    fakeid: item.fakeid,
    nickname: item.nickname ?? null,
    articleUrl: item.article_url ?? null,
    articleTitle: item.article_title ?? null,
    articleAid: item.article_aid ?? null,
    commentId: item.comment_id ?? '',
    status: item.status,
    createdAt: item.created_at,
    trackingEndAt: item.tracking_end_at ?? 0,
    accumulatedComments: item.accumulated_comments ?? [],
    finalComments: item.final_comments ?? [],
    shieldedComments: item.shielded_comments ?? [],
    stats: item.stats ?? {},
    errorMsg: item.error_msg ?? '',
    autoTrackEnabled: item.auto_track_enabled ?? true,
    source: item.source ?? 'auto',
    sourceFakeid: item.source_fakeid ?? null,
    lastSyncAt: item.last_sync_at ?? 0,
    commentFirstSeenAt: item.comment_first_seen_at ?? {},
    commentShieldedAt: item.comment_shielded_at ?? {},
  }));

  // 对于有 id 的进行 upsert，无 id 的直接 insert
  for (const value of values) {
    if (value.id) {
      await db
        .insert(commentMonitorTask)
        .values(value)
        .onConflictDoUpdate({
          target: commentMonitorTask.id,
          set: {
            fakeid: sql`excluded.fakeid`,
            nickname: sql`excluded.nickname`,
            articleUrl: sql`excluded.article_url`,
            articleTitle: sql`excluded.article_title`,
            status: sql`excluded.status`,
            accumulatedComments: sql`excluded.accumulated_comments`,
            finalComments: sql`excluded.final_comments`,
            shieldedComments: sql`excluded.shielded_comments`,
            stats: sql`excluded.stats`,
            errorMsg: sql`excluded.error_msg`,
            lastSyncAt: sql`excluded.last_sync_at`,
          },
        });
    } else {
      await db.insert(commentMonitorTask).values(value);
    }
  }

  return { success: true, count: items.length };
});
