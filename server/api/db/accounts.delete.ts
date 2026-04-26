/**
 * DELETE /api/db/accounts
 * 删除公众号及其所有关联数据
 */
import { inArray } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import * as schema from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);
  const fakeids: string[] = Array.isArray(body.fakeids) ? body.fakeids : [body.fakeids];

  if (fakeids.length === 0) {
    return { success: true, count: 0 };
  }

  // 删除所有关联表的数据
  await db.delete(schema.article).where(inArray(schema.article.fakeid, fakeids));
  await db.delete(schema.htmlContent).where(inArray(schema.htmlContent.fakeid, fakeids));
  await db.delete(schema.comment).where(inArray(schema.comment.fakeid, fakeids));
  await db.delete(schema.commentReply).where(inArray(schema.commentReply.fakeid, fakeids));
  await db.delete(schema.metadata).where(inArray(schema.metadata.fakeid, fakeids));
  await db.delete(schema.resource).where(inArray(schema.resource.fakeid, fakeids));
  await db.delete(schema.resourceMap).where(inArray(schema.resourceMap.fakeid, fakeids));
  await db.delete(schema.asset).where(inArray(schema.asset.fakeid, fakeids));
  await db.delete(schema.debug).where(inArray(schema.debug.fakeid, fakeids));
  await db.delete(schema.mpAccount).where(inArray(schema.mpAccount.fakeid, fakeids));

  return { success: true, count: fakeids.length };
});
