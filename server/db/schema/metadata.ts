import { index, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const metadata = pgTable(
  'metadata',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    title: text('title'),
    readNum: integer('read_num').default(0),
    oldLikeNum: integer('old_like_num').default(0),
    shareNum: integer('share_num').default(0),
    likeNum: integer('like_num').default(0),
    commentNum: integer('comment_num').default(0),
  },
  table => [index('idx_metadata_fakeid').on(table.fakeid)]
);
