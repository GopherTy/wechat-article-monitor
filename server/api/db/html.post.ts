/**
 * POST /api/db/html
 * 上传 HTML 内容（支持 base64 编码的二进制数据）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { htmlContent } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readLargeBody(event);

  const { url, fakeid, title, commentId, fileData } = body;

  if (!url || !fakeid || !fileData) {
    throw createError({ statusCode: 400, message: 'url, fakeid, fileData are required' });
  }

  const buffer = Buffer.from(fileData, 'base64');

  await db
    .insert(htmlContent)
    .values({
      url,
      fakeid,
      title: title ?? null,
      commentId: commentId ?? null,
      fileData: buffer,
    })
    .onConflictDoUpdate({
      target: htmlContent.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        title: sql`excluded.title`,
        commentId: sql`excluded.comment_id`,
        fileData: sql`excluded.file_data`,
      },
    });

  return { success: true };
});
