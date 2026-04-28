import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core';

export const commentMonitorTask = pgTable(
  'comment_monitor_task',
  {
    id: serial('id').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    nickname: varchar('nickname', { length: 255 }),
    articleUrl: text('article_url'),
    articleTitle: text('article_title'),
    articleAid: varchar('article_aid', { length: 64 }),
    commentId: varchar('comment_id', { length: 255 }).default(''),
    status: varchar('status', { length: 32 }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    trackingEndAt: bigint('tracking_end_at', { mode: 'number' }).default(0),
    accumulatedComments: jsonb('accumulated_comments').default([]),
    finalComments: jsonb('final_comments').default([]),
    shieldedComments: jsonb('shielded_comments').default([]),
    stats: jsonb('stats').default({}),
    errorMsg: text('error_msg').default(''),
    autoTrackEnabled: boolean('auto_track_enabled').default(true),
    source: varchar('source', { length: 16 }).default('auto'),
    sourceFakeid: varchar('source_fakeid', { length: 64 }),
    lastSyncAt: bigint('last_sync_at', { mode: 'number' }).default(0),
    commentFirstSeenAt: jsonb('comment_first_seen_at').default({}),
    commentShieldedAt: jsonb('comment_shielded_at').default({}),
  },
  table => [
    index('idx_cmt_fakeid').on(table.fakeid),
    index('idx_cmt_status').on(table.status),
    index('idx_cmt_created').on(table.createdAt),
  ]
);
