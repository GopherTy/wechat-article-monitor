/**
 * GET /api/db/resources
 * 获取资源文件（返回 base64）
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { resource } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' });
  }

  const result = await db.select().from(resource).where(eq(resource.url, url)).limit(1);
  if (!result[0]) return null;

  return {
    url: result[0].url,
    fakeid: result[0].fakeid,
    fileData: result[0].fileData ? Buffer.from(result[0].fileData).toString('base64') : null,
  };
});
