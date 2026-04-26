/**
 * POST /api/db/comments
 * 新增或更新评论（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { comment } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  const values = items.map(item => ({
    url: item.url,
    fakeid: item.fakeid,
    title: item.title ?? null,
    data: item.data,
  }));

  await db
    .insert(comment)
    .values(values)
    .onConflictDoUpdate({
      target: comment.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        title: sql`excluded.title`,
        data: sql`excluded.data`,
      },
    });

  return { success: true, count: items.length };
});
