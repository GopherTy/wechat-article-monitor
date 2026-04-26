import { customType, index, pgTable, text, varchar } from 'drizzle-orm/pg-core';

// 自定义 bytea 类型，用于存储二进制数据
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const htmlContent = pgTable(
  'html_content',
  {
    url: text('url').primaryKey(),
    fakeid: varchar('fakeid', { length: 64 }).notNull(),
    title: text('title'),
    commentId: varchar('comment_id', { length: 255 }),
    fileData: bytea('file_data').notNull(),
  },
  table => [index('idx_html_fakeid').on(table.fakeid)]
);
