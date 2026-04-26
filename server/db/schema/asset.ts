import { customType, index, pgTable, text, varchar } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const asset = pgTable(
  'asset',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    fileData: bytea('file_data').notNull(),
  },
  table => [index('idx_asset_fakeid').on(table.fakeid)]
);
