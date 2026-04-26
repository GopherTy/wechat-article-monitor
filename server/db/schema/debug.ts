import { customType, index, pgTable, text, varchar } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const debug = pgTable(
  'debug',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    type: varchar('type', { length: 64 }),
    title: text('title'),
    fileData: bytea('file_data').notNull(),
  },
  table => [index('idx_debug_fakeid').on(table.fakeid)]
);
