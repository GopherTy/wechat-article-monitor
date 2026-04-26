/**
 * DELETE /api/db/watched-accounts
 * 删除关注的公众号
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { watchedAccount } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);
  const { fakeid } = body;

  if (!fakeid) {
    throw createError({ statusCode: 400, message: 'fakeid is required' });
  }

  await db.delete(watchedAccount).where(eq(watchedAccount.fakeid, fakeid));
  return { success: true };
});
