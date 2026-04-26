/**
 * GET /api/db/comment-replies
 * 获取评论回复
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentReply } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const url = query.url as string | undefined;
  const contentId = query.content_id as string | undefined;

  if (!url || !contentId) {
    throw createError({ statusCode: 400, message: 'url and content_id are required' });
  }

  const id = `${url}:${contentId}`;
  const result = await db.select().from(commentReply).where(eq(commentReply.id, id)).limit(1);
  return result[0] || null;
});
