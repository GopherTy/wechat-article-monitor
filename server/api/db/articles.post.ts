/**
 * POST /api/db/articles
 * 新增或更新文章（支持批量 upsert）
 */
import { sql } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { article } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  // 已知的核心字段列表，其余存入 extra
  const CORE_FIELDS = new Set([
    'id',
    'fakeid',
    'aid',
    'title',
    'link',
    'digest',
    'cover',
    'author_name',
    'create_time',
    'update_time',
    'appmsgid',
    'itemidx',
    'is_deleted',
    '_status',
    '_single',
  ]);

  const values = items.map(item => {
    // 提取 extra 字段
    const extra: Record<string, any> = {};
    for (const key of Object.keys(item)) {
      if (!CORE_FIELDS.has(key) && key !== 'extra') {
        extra[key] = item[key];
      }
    }
    // 如果 item 已有 extra，合并
    if (item.extra) {
      Object.assign(extra, item.extra);
    }

    return {
      id: item.id || `${item.fakeid}:${item.aid}`,
      fakeid: item.fakeid,
      aid: item.aid || '',
      title: item.title ?? null,
      link: item.link ?? null,
      digest: item.digest ?? null,
      cover: item.cover ?? null,
      authorName: item.author_name ?? null,
      createTime: item.create_time ?? null,
      updateTime: item.update_time ?? null,
      appmsgid: item.appmsgid ?? null,
      itemidx: item.itemidx ?? null,
      isDeleted: item.is_deleted ?? false,
      status: item._status ?? '',
      single: item._single ?? false,
      extra: extra,
    };
  });

  // 使用 raw SQL 的 excluded 引用批量 upsert
  await db
    .insert(article)
    .values(values)
    .onConflictDoUpdate({
      target: article.id,
      set: {
        title: sql`excluded.title`,
        link: sql`excluded.link`,
        digest: sql`excluded.digest`,
        cover: sql`excluded.cover`,
        authorName: sql`excluded.author_name`,
        createTime: sql`excluded.create_time`,
        updateTime: sql`excluded.update_time`,
        appmsgid: sql`excluded.appmsgid`,
        itemidx: sql`excluded.itemidx`,
        isDeleted: sql`excluded.is_deleted`,
        status: sql`excluded._status`,
        single: sql`excluded._single`,
        extra: sql`excluded.extra`,
      },
    });

  return { success: true, count: items.length };
});
