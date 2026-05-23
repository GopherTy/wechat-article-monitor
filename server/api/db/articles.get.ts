/**
 * GET /api/db/articles
 * 查询文章列表，按 fakeid 过滤 + 可选的 before_time
 */
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { article } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const fakeid = query.fakeid as string | undefined;
  const beforeTime = query.before_time ? Number(query.before_time) : undefined;
  const link = query.link as string | undefined;

  if (link) {
    const result = await db.select().from(article).where(eq(article.link, link)).limit(1);
    return result[0] || null;
  }

  if (!fakeid) {
    throw createError({ statusCode: 400, message: 'fakeid is required' });
  }

  const conditions = [eq(article.fakeid, fakeid)];
  if (beforeTime) {
    conditions.push(lt(article.createTime, beforeTime));
  }
  if (query.exclude_deleted === 'true') {
    conditions.push(eq(article.isDeleted, false));
  }

  if (query.count === 'true') {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(article)
      .where(and(...conditions));
    return { count: result[0]?.count ?? 0 };
  }

  const limit = query.limit ? Number(query.limit) : undefined;
  const offset = query.offset ? Number(query.offset) : undefined;

  const selectQuery = db
    .select()
    .from(article)
    .where(and(...conditions))
    .orderBy(desc(article.createTime));

  if (limit !== undefined && offset !== undefined) {
    return selectQuery.limit(limit).offset(offset);
  }
  if (limit !== undefined) {
    return selectQuery.limit(limit);
  }
  if (offset !== undefined) {
    return selectQuery.offset(offset);
  }

  return selectQuery;
});
