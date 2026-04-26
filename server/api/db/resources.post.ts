/**
 * POST /api/db/resources
 * 上传资源文件（base64 编码）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { resource } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);
  const { url, fakeid, fileData } = body;

  if (!url || !fakeid || !fileData) {
    throw createError({ statusCode: 400, message: 'url, fakeid, fileData are required' });
  }

  const buffer = Buffer.from(fileData, 'base64');

  await db
    .insert(resource)
    .values({ url, fakeid, fileData: buffer })
    .onConflictDoUpdate({
      target: resource.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        fileData: sql`excluded.file_data`,
      },
    });

  return { success: true };
});
