import { customType, index, pgTable, text, varchar } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const resource = pgTable(
  'resource',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    fileData: bytea('file_data').notNull(),
  },
  table => [index('idx_resource_fakeid').on(table.fakeid)]
);
