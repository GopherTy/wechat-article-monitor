import { inArray } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import * as schema from '~/server/db/schema';

/**
 * POST /api/db/sync/check
 * 增量检测：检查给定的 ID 列表在数据库中是否已存在
 */
export default defineEventHandler(async event => {
  const db = getDb();
  const { table, ids } = await readBody(event);

  if (!table || !Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  // 映射前端表名到后端 schema 名
  const tableMap: Record<string, any> = {
    article: schema.article,
    asset: schema.asset,
    html: schema.htmlContent,
    htmlContent: schema.htmlContent,
    mpAccount: schema.mpAccount,
    comment: schema.comment,
    commentReply: schema.commentReply,
  };

  const tableSchema = tableMap[table];
  if (!tableSchema) {
    throw createError({ statusCode: 400, message: `Invalid table: ${table}` });
  }

  // 确定主键字段名（url 或 id）
  const pk = tableSchema.url || tableSchema.id;
  if (!pk) {
    throw createError({ statusCode: 400, message: `Table ${table} does not have a supported ID field` });
  }

  // 分批查询，避免 inArray 限制（通常 Postgres 限制在 65535 左右，但为了保险分批）
  const BATCH_SIZE = 1000;
  const existingIds: string[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const result = await db
      .select({ id: pk })
      .from(tableSchema)
      .where(inArray(pk, batch));
    
    existingIds.push(...result.map(r => String(r.id)));
  }

  return existingIds;
});
