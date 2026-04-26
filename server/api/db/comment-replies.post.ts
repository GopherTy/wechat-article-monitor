/**
 * POST /api/db/comment-replies
 * 新增或更新评论回复（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentReply } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  const values = items.map(item => ({
    id: `${item.url}:${item.contentID || item.content_id}`,
    url: item.url,
    fakeid: item.fakeid,
    title: item.title ?? null,
    contentId: item.contentID || item.content_id,
    data: item.data,
  }));

  await db
    .insert(commentReply)
    .values(values)
    .onConflictDoUpdate({
      target: commentReply.id,
      set: {
        url: sql`excluded.url`,
        fakeid: sql`excluded.fakeid`,
        title: sql`excluded.title`,
        contentId: sql`excluded.content_id`,
        data: sql`excluded.data`,
      },
    });

  return { success: true, count: items.length };
});
