import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const commentReply = pgTable(
  'comment_reply',
  {
    id: text('id').primaryKey(), // "url:contentID"
    url: text('url').notNull(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    title: text('title'),
    contentId: varchar('content_id', { length: 255 }).notNull(),
    data: jsonb('data').notNull(),
  },
  table => [index('idx_comment_reply_url').on(table.url), index('idx_comment_reply_fakeid').on(table.fakeid)]
);
