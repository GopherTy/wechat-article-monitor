/**
 * DELETE /api/db/monitor-tasks
 * 删除评论监控任务
 */
import { eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentMonitorTask } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const body = await readBody(event);
  const { id } = body;

  if (!id) {
    throw createError({ statusCode: 400, message: 'id is required' });
  }

  await db.delete(commentMonitorTask).where(eq(commentMonitorTask.id, id));
  return { success: true };
});
