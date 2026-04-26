/**
 * PATCH /api/db/articles
 * 更新文章字段（按 link 或 id 定位）
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { article } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const { link, id, fakeid, ...changes } = body;

  const setValues: Record<string, any> = {};
  if (changes._status !== undefined) setValues.status = changes._status;
  if (changes.is_deleted !== undefined) setValues.isDeleted = changes.is_deleted;
  if (changes._single !== undefined) setValues.single = changes._single;
  if (changes.fakeid !== undefined) setValues.fakeid = changes.fakeid;

  if (id) {
    await db.update(article).set(setValues).where(eq(article.id, id));
  } else if (link) {
    const conditions = [eq(article.link, link)];
    if (fakeid) {
      conditions.push(eq(article.fakeid, fakeid));
    }
    await db.update(article).set(setValues).where(and(...conditions));
  } else {
    throw createError({ statusCode: 400, message: 'link or id is required' });
  }

  return { success: true };
});
