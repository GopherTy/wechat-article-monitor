import { boolean, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const watchedAccount = pgTable('watched_account', {
  fakeid: varchar('fakeid', { length: 64 }).primaryKey(),
  nickname: varchar('nickname', { length: 255 }),
  roundHeadImg: text('round_head_img'),
  enabled: boolean('enabled').default(true),
  lastCheckTime: integer('last_check_time').default(0),
  lastKnownAid: varchar('last_known_aid', { length: 64 }).default(''),
  checkCount: integer('check_count').default(0),
  lastDiscoveryAt: integer('last_discovery_at').default(0),
  discoveredCount: integer('discovered_count').default(0),
});
