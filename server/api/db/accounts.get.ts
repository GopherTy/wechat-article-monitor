/**
 * GET /api/db/accounts
 * 获取所有公众号信息，或通过 fakeid 查询单个
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { mpAccount } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const fakeid = query.fakeid as string | undefined;

  if (fakeid) {
    const result = await db.select().from(mpAccount).where(eq(mpAccount.fakeid, fakeid)).limit(1);
    return result[0] || null;
  }

  return db.select().from(mpAccount);
});
