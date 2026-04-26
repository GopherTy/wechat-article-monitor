/**
 * GET /api/db/html
 * 获取 HTML 内容
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { htmlContent } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' });
  }

  const result = await db.select().from(htmlContent).where(eq(htmlContent.url, url)).limit(1);
  if (!result[0]) return null;

  // 将 Buffer 转 base64 返回（客户端重建 Blob）
  const row = result[0];
  return {
    url: row.url,
    fakeid: row.fakeid,
    title: row.title,
    commentId: row.commentId,
    fileData: row.fileData ? Buffer.from(row.fileData).toString('base64') : null,
  };
});
