import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const comment = pgTable(
  'comment',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    title: text('title'),
    data: jsonb('data').notNull(),
  },
  table => [index('idx_comment_fakeid').on(table.fakeid)]
);
