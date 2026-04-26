/**
 * POST /api/db/init
 * 初始化数据库（自动创建数据库 + 建表）
 */
import { initializeDb } from '~/server/db/connection';

export default defineEventHandler(async () => {
  await initializeDb();
  return { success: true, message: '数据库初始化完成' };
});
