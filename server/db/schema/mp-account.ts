import { boolean, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const mpAccount = pgTable('mp_account', {
  fakeid: varchar('fakeid', { length: 64 }).primaryKey(),
  nickname: varchar('nickname', { length: 255 }),
  roundHeadImg: text('round_head_img'),
  completed: boolean('completed').notNull().default(false),
  count: integer('count').notNull().default(0),
  articles: integer('articles').notNull().default(0),
  totalCount: integer('total_count').notNull().default(0),
  createTime: integer('create_time'),
  updateTime: integer('update_time'),
  lastUpdateTime: integer('last_update_time'),
});
