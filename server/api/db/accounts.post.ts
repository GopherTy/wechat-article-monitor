/**
 * POST /api/db/accounts
 * 新增或更新公众号信息（支持批量 upsert）
 */
import { getDb } from '~/server/db/connection';
import { mpAccount } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  // 支持单条和批量
  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  const values = items.map(item => ({
    fakeid: item.fakeid,
    nickname: item.nickname ?? null,
    roundHeadImg: item.round_head_img ?? null,
    completed: item.completed ?? false,
    count: item.count ?? 0,
    articles: item.articles ?? 0,
    totalCount: item.total_count ?? 0,
    createTime: item.create_time ?? null,
    updateTime: item.update_time ?? null,
    lastUpdateTime: item.last_update_time ?? null,
  }));

  await db
    .insert(mpAccount)
    .values(values)
    .onConflictDoUpdate({
      target: mpAccount.fakeid,
      set: {
        nickname: values[0].nickname,
        roundHeadImg: values[0].roundHeadImg,
        completed: values[0].completed,
        count: values[0].count,
        articles: values[0].articles,
        totalCount: values[0].totalCount,
        createTime: values[0].createTime,
        updateTime: values[0].updateTime,
        lastUpdateTime: values[0].lastUpdateTime,
      },
    });

  return { success: true, count: items.length };
});
