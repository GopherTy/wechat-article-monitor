/**
 * GET /api/db/monitor-tasks
 * 获取评论监控任务
 */
import { desc, eq } from 'drizzle-orm';
import { getDb } from '~/server/db/connection';
import { commentMonitorTask } from '~/server/db/schema';

export default defineEventHandler(async event => {
  const db = getDb();
  const query = getQuery(event);
  const status = query.status as string | undefined;
  const fakeid = query.fakeid as string | undefined;

  let q = db.select().from(commentMonitorTask).$dynamic();

  if (status) {
    q = q.where(eq(commentMonitorTask.status, status));
  } else if (fakeid) {
    q = q.where(eq(commentMonitorTask.fakeid, fakeid));
  }

  return q.orderBy(desc(commentMonitorTask.createdAt));
});
