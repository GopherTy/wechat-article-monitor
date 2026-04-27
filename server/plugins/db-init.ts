import { initializeDb } from '../db/connection';

export default defineNitroPlugin(async (nitro) => {
  try {
    await initializeDb();
    console.info('[DB] 启动时数据库检查/初始化完成');
  } catch (err) {
    console.error('[DB] 启动时自动初始化数据库失败:', err);
  }
});
