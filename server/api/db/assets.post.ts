/**
 * POST /api/db/assets
 * 批量上传或更新通用资源
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { asset } from '~/server/db/schema';

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
    fileData: Buffer.from(item.fileData, 'base64'),
  }));

  await db
    .insert(asset)
    .values(values)
    .onConflictDoUpdate({
      target: asset.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        fileData: sql`excluded.file_data`,
      },
    });

  return { success: true, count: items.length };
});
