/**
 * GET /api/db/watched-accounts
 * 获取所有关注的公众号
 */
import { getDb } from '~/server/db/connection';
import { watchedAccount } from '~/server/db/schema';

export default defineEventHandler(async () => {
  const db = getDb();
  return db.select().from(watchedAccount);
});
