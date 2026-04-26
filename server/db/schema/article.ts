import { boolean, bigint, index, integer, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const article = pgTable(
  'article',
  {
    id: varchar('id', { length: 255 }).primaryKey(), // "fakeid:aid"
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    aid: varchar('aid', { length: 64 }).notNull(),
    title: text('title'),
    link: text('link'),
    digest: text('digest'),
    cover: text('cover'),
    authorName: varchar('author_name', { length: 255 }),
    createTime: integer('create_time'),
    updateTime: integer('update_time'),
    appmsgid: bigint('appmsgid', { mode: 'number' }),
    itemidx: integer('itemidx'),
    isDeleted: boolean('is_deleted').default(false),
    status: varchar('_status', { length: 64 }).default(''),
    single: boolean('_single').default(false),
    // 存储其余不常查询的字段
    extra: jsonb('extra').default({}),
  },
  table => [
    index('idx_article_fakeid').on(table.fakeid),
    index('idx_article_create_time').on(table.createTime),
    index('idx_article_link').on(table.link),
  ]
);
