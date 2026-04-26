/**
 * GET /api/db/resource-maps
 * 获取资源映射
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { resourceMap } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' });
  }

  const result = await db.select().from(resourceMap).where(eq(resourceMap.url, url)).limit(1);
  return result[0] || null;
});
