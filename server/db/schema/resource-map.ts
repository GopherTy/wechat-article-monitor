import { index, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const resourceMap = pgTable(
  'resource_map',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    resources: text('resources').array().notNull().default([]),
  },
  table => [index('idx_resource_map_fakeid').on(table.fakeid)]
);
