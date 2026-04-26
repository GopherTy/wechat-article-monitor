/**
 * POST /api/db/resource-maps
 * 新增或更新资源映射（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { resourceMap } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) return { success: true, count: 0 };

  const values = items.map(item => ({
    url: item.url,
    fakeid: item.fakeid,
    resources: item.resources || [],
  }));

  await db
    .insert(resourceMap)
    .values(values)
    .onConflictDoUpdate({
      target: resourceMap.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        resources: sql`excluded.resources`,
      },
    });

  return { success: true, count: items.length };
});
