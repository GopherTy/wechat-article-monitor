/**
 * GET /api/db/metadata
 * 获取文章元数据（阅读量等）
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { metadata } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' });
  }

  const result = await db.select().from(metadata).where(eq(metadata.url, url)).limit(1);
  return result[0] || null;
});
