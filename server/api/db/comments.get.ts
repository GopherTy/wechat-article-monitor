/**
 * GET /api/db/comments
 * 获取评论数据
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { comment } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' });
  }

  const result = await db.select().from(comment).where(eq(comment.url, url)).limit(1);
  return result[0] || null;
});
