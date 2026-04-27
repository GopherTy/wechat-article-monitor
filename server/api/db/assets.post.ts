/**
 * POST /api/db/assets
 * 上传通用资源
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { asset } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readLargeBody(event);
  const { url, fakeid, fileData } = body;

  if (!url || !fakeid || !fileData) {
    throw createError({ statusCode: 400, message: 'url, fakeid, fileData are required' });
  }

  const buffer = Buffer.from(fileData, 'base64');

  await db
    .insert(asset)
    .values({ url, fakeid, fileData: buffer })
    .onConflictDoUpdate({
      target: asset.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        fileData: sql`excluded.file_data`,
      },
    });

  return { success: true };
});
