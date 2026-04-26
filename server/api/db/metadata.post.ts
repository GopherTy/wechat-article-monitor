/**
 * POST /api/db/metadata
 * 新增或更新文章元数据（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { metadata } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  const values = items.map(item => ({
    url: item.url,
    fakeid: item.fakeid,
    title: item.title ?? null,
    readNum: item.readNum ?? 0,
    oldLikeNum: item.oldLikeNum ?? 0,
    shareNum: item.shareNum ?? 0,
    likeNum: item.likeNum ?? 0,
    commentNum: item.commentNum ?? 0,
  }));

  await db
    .insert(metadata)
    .values(values)
    .onConflictDoUpdate({
      target: metadata.url,
      set: {
        fakeid: sql`excluded.fakeid`,
        title: sql`excluded.title`,
        readNum: sql`excluded.read_num`,
        oldLikeNum: sql`excluded.old_like_num`,
        shareNum: sql`excluded.share_num`,
        likeNum: sql`excluded.like_num`,
        commentNum: sql`excluded.comment_num`,
      },
    });

  return { success: true, count: items.length };
});
