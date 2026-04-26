/**
 * POST /api/db/watched-accounts
 * 新增或更新关注的公众号（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { watchedAccount } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) return { success: true, count: 0 };

  const values = items.map(item => ({
    fakeid: item.fakeid,
    nickname: item.nickname ?? null,
    roundHeadImg: item.round_head_img ?? null,
    enabled: item.enabled ?? true,
    lastCheckTime: item.last_check_time ?? 0,
    lastKnownAid: item.last_known_aid ?? '',
    checkCount: item.check_count ?? 0,
    lastDiscoveryAt: item.last_discovery_at ?? 0,
    discoveredCount: item.discovered_count ?? 0,
  }));

  await db
    .insert(watchedAccount)
    .values(values)
    .onConflictDoUpdate({
      target: watchedAccount.fakeid,
      set: {
        nickname: sql`excluded.nickname`,
        roundHeadImg: sql`excluded.round_head_img`,
        enabled: sql`excluded.enabled`,
        lastCheckTime: sql`excluded.last_check_time`,
        lastKnownAid: sql`excluded.last_known_aid`,
        checkCount: sql`excluded.check_count`,
        lastDiscoveryAt: sql`excluded.last_discovery_at`,
        discoveredCount: sql`excluded.discovered_count`,
      },
    });

  return { success: true, count: items.length };
});
