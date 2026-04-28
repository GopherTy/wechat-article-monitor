/**
 * POST /api/db/html
 * 批量上传或更新 HTML 内容
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { htmlContent } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readLargeBody(event);
  const items = Array.isArray(body) ? body : [body];

  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  const values = items.map(item => ({
    url: item.url,
    fakeid: item.fakeid,
    title: item.title ?? null,
    commentId: item.commentId ?? null,
    fileData: Buffer.from(item.fileData, 'base64'),
  }));

  await db
    .insert(htmlContent)
    .values(values)
    .onConflictDoUpdate({
      target: htmlContent.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        title: sql`excluded.title`,
        commentId: sql`excluded.comment_id`,
        fileData: sql`excluded.file_data`,
      },
    });

  return { success: true, count: items.length };
});
