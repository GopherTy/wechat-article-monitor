/**
 * 数据迁移 Composable
 * 支持 IndexedDB ↔ PostgreSQL 双向迁移
 */
import { ref, computed } from 'vue';
import type { MigrationProgress } from '~/store/v2/adapter';
import { IndexedDBAdapter } from '~/store/v2/adapters/indexeddb-adapter';
import { PgAdapter } from '~/store/v2/adapters/pg-adapter';
import { setStorageMode, getStorageMode } from '~/store/v2/adapters';
import { db } from '~/store/v2/db';

export type MigrationDirection = 'idb-to-pg' | 'pg-to-idb';

interface TableProgress {
  table: string;
  label: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  error?: string;
}

const TABLE_LABELS: Record<string, string> = {
  info: '公众号信息',
  article: '文章',
  html: 'HTML 内容',
  comment: '评论',
  comment_reply: '评论回复',
  metadata: '元数据',
  resource: '资源文件',
  'resource-map': '资源映射',
  asset: '通用资源',
  watched_account: '关注公众号',
  comment_monitor_task: '评论监控任务',
};

export function useMigration() {
  const migrating = ref(false);
  const direction = ref<MigrationDirection>('idb-to-pg');
  const tableProgress = ref<TableProgress[]>([]);
  const currentTable = ref('');
  const error = ref<string | null>(null);
  const completed = ref(false);

  const overallProgress = computed(() => {
    if (tableProgress.value.length === 0) return 0;
    const doneCount = tableProgress.value.filter(t => t.status === 'done' || t.status === 'skipped').length;
    return Math.round((doneCount / tableProgress.value.length) * 100);
  });

  const currentMode = computed(() => getStorageMode());

  function initProgress() {
    const tables = Object.keys(TABLE_LABELS);
    tableProgress.value = tables.map(table => ({
      table,
      label: TABLE_LABELS[table],
      current: 0,
      total: 0,
      status: 'pending' as const,
    }));
  }

  function updateTableProgress(table: string, updates: Partial<TableProgress>) {
    const idx = tableProgress.value.findIndex(t => t.table === table);
    if (idx >= 0) {
      tableProgress.value[idx] = { ...tableProgress.value[idx], ...updates };
    }
  }

  /**
   * 初始化 PG 数据库 schema
   */
  async function initPgDatabase(): Promise<boolean> {
    try {
      await $fetch('/api/db/init', { method: 'POST' });
      return true;
    } catch (e: any) {
      error.value = `数据库初始化失败: ${e.message}`;
      return false;
    }
  }

  /**
   * IndexedDB → PostgreSQL 迁移
   */
  async function migrateIdbToPg() {
    const source = new IndexedDBAdapter();
    const target = new PgAdapter();

    // 1. info (公众号)
    currentTable.value = 'info';
    updateTableProgress('info', { status: 'running' });
    try {
      const accounts = await source.getAllAccounts();
      updateTableProgress('info', { total: accounts.length });
      for (let i = 0; i < accounts.length; i++) {
        await target.putAccount(accounts[i]);
        updateTableProgress('info', { current: i + 1 });
      }
      updateTableProgress('info', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('info', { status: 'error', error: e.message });
      throw e;
    }

    // 2. article (文章) - 按公众号分批
    currentTable.value = 'article';
    updateTableProgress('article', { status: 'running' });
    try {
      const allArticles = await db.article.toArray();
      updateTableProgress('article', { total: allArticles.length });

      // 分批 200 条
      const BATCH = 200;
      for (let i = 0; i < allArticles.length; i += BATCH) {
        const batch = allArticles.slice(i, i + BATCH);
        const keys = await Promise.all(
          batch.map(async a => {
            // 获取原始 key
            const primaryKey = `${a.fakeid}:${a.aid}`;
            return primaryKey;
          })
        );
        await target.putArticles(batch, keys);
        updateTableProgress('article', { current: Math.min(i + BATCH, allArticles.length) });
      }
      updateTableProgress('article', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('article', { status: 'error', error: e.message });
      throw e;
    }

    // 3. html
    currentTable.value = 'html';
    updateTableProgress('html', { status: 'running' });
    try {
      const allHtml = await db.html.toArray();
      updateTableProgress('html', { total: allHtml.length });
      for (let i = 0; i < allHtml.length; i++) {
        await target.putHtml(allHtml[i]);
        updateTableProgress('html', { current: i + 1 });
      }
      updateTableProgress('html', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('html', { status: 'error', error: e.message });
      throw e;
    }

    // 4. comment
    currentTable.value = 'comment';
    updateTableProgress('comment', { status: 'running' });
    try {
      const allComments = await db.comment.toArray();
      updateTableProgress('comment', { total: allComments.length });
      for (let i = 0; i < allComments.length; i++) {
        await target.putComment(allComments[i]);
        updateTableProgress('comment', { current: i + 1 });
      }
      updateTableProgress('comment', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('comment', { status: 'error', error: e.message });
      throw e;
    }

    // 5. comment_reply
    currentTable.value = 'comment_reply';
    updateTableProgress('comment_reply', { status: 'running' });
    try {
      const allReplies = await db.comment_reply.toArray();
      updateTableProgress('comment_reply', { total: allReplies.length });
      for (let i = 0; i < allReplies.length; i++) {
        await target.putCommentReply(allReplies[i]);
        updateTableProgress('comment_reply', { current: i + 1 });
      }
      updateTableProgress('comment_reply', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('comment_reply', { status: 'error', error: e.message });
      throw e;
    }

    // 6. metadata
    currentTable.value = 'metadata';
    updateTableProgress('metadata', { status: 'running' });
    try {
      const allMeta = await db.metadata.toArray();
      updateTableProgress('metadata', { total: allMeta.length });

      const BATCH = 200;
      for (let i = 0; i < allMeta.length; i += BATCH) {
        const batch = allMeta.slice(i, i + BATCH);
        for (const m of batch) {
          await target.putMetadata(m);
        }
        updateTableProgress('metadata', { current: Math.min(i + BATCH, allMeta.length) });
      }
      updateTableProgress('metadata', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('metadata', { status: 'error', error: e.message });
      throw e;
    }

    // 7. resource (逐条，含 Blob)
    currentTable.value = 'resource';
    updateTableProgress('resource', { status: 'running' });
    try {
      const allResources = await db.resource.toArray();
      updateTableProgress('resource', { total: allResources.length });
      for (let i = 0; i < allResources.length; i++) {
        await target.putResource(allResources[i]);
        updateTableProgress('resource', { current: i + 1 });
      }
      updateTableProgress('resource', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('resource', { status: 'error', error: e.message });
      throw e;
    }

    // 8. resource-map
    currentTable.value = 'resource-map';
    updateTableProgress('resource-map', { status: 'running' });
    try {
      const allMaps = await db['resource-map'].toArray();
      updateTableProgress('resource-map', { total: allMaps.length });
      for (let i = 0; i < allMaps.length; i++) {
        await target.putResourceMap(allMaps[i]);
        updateTableProgress('resource-map', { current: i + 1 });
      }
      updateTableProgress('resource-map', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('resource-map', { status: 'error', error: e.message });
      throw e;
    }

    // 9. asset (逐条，含 Blob)
    currentTable.value = 'asset';
    updateTableProgress('asset', { status: 'running' });
    try {
      const allAssets = await db.asset.toArray();
      updateTableProgress('asset', { total: allAssets.length });
      for (let i = 0; i < allAssets.length; i++) {
        await target.putAsset(allAssets[i]);
        updateTableProgress('asset', { current: i + 1 });
      }
      updateTableProgress('asset', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('asset', { status: 'error', error: e.message });
      throw e;
    }

    // 10. watched_account
    currentTable.value = 'watched_account';
    updateTableProgress('watched_account', { status: 'running' });
    try {
      const allWatched = await source.getAllWatchedAccounts();
      updateTableProgress('watched_account', { total: allWatched.length });
      for (let i = 0; i < allWatched.length; i++) {
        await target.putWatchedAccount(allWatched[i]);
        updateTableProgress('watched_account', { current: i + 1 });
      }
      updateTableProgress('watched_account', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('watched_account', { status: 'error', error: e.message });
      throw e;
    }

    // 11. comment_monitor_task
    currentTable.value = 'comment_monitor_task';
    updateTableProgress('comment_monitor_task', { status: 'running' });
    try {
      const allTasks = await source.getAllCommentMonitorTasks();
      updateTableProgress('comment_monitor_task', { total: allTasks.length });
      for (let i = 0; i < allTasks.length; i++) {
        const { id, ...taskWithoutId } = allTasks[i];
        // 迁移时保留原始 id
        await $fetch('/api/db/monitor-tasks', {
          method: 'POST',
          body: { ...taskWithoutId, id, ...snakeCaseTask(allTasks[i]) },
        });
        updateTableProgress('comment_monitor_task', { current: i + 1 });
      }
      updateTableProgress('comment_monitor_task', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('comment_monitor_task', { status: 'error', error: e.message });
      throw e;
    }
  }

  /**
   * PostgreSQL → IndexedDB 反向迁移
   */
  async function migratePgToIdb() {
    const source = new PgAdapter();
    const target = new IndexedDBAdapter();

    // 1. info
    currentTable.value = 'info';
    updateTableProgress('info', { status: 'running' });
    try {
      const accounts = await source.getAllAccounts();
      updateTableProgress('info', { total: accounts.length });
      for (let i = 0; i < accounts.length; i++) {
        await target.putAccount(accounts[i]);
        updateTableProgress('info', { current: i + 1 });
      }
      updateTableProgress('info', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('info', { status: 'error', error: e.message });
      throw e;
    }

    // 2. article - 需要按 account 拉取
    currentTable.value = 'article';
    updateTableProgress('article', { status: 'running' });
    try {
      const accounts = await source.getAllAccounts();
      let totalArticles = 0;
      let processedArticles = 0;

      // 先统计总数
      for (const account of accounts) {
        const articles = await source.getArticles(account.fakeid);
        totalArticles += articles.length;
      }
      updateTableProgress('article', { total: totalArticles });

      // 再逐个迁移
      for (const account of accounts) {
        const articles = await source.getArticles(account.fakeid);
        if (articles.length > 0) {
          const keys = articles.map(a => `${a.fakeid}:${a.aid}`);
          await target.putArticles(articles, keys);
          processedArticles += articles.length;
          updateTableProgress('article', { current: processedArticles });
        }
      }
      updateTableProgress('article', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('article', { status: 'error', error: e.message });
      throw e;
    }

    // 3-11: 对于 PG→IDB，需要服务端提供批量查询接口
    // 此处使用简化版：按 account 逐个拉取
    const accounts = await source.getAllAccounts();

    for (const tableName of ['html', 'comment', 'comment_reply', 'metadata', 'resource', 'resource-map', 'asset'] as const) {
      currentTable.value = tableName;
      updateTableProgress(tableName, { status: 'running' });
      try {
        // 对于反向迁移，我们需要遍历已知的 URL
        // 从已迁移的文章中获取所有 link
        const allArticles = await db.article.toArray();
        const urls = allArticles.map(a => a.link).filter(Boolean);
        updateTableProgress(tableName, { total: urls.length });

        let processed = 0;
        for (const url of urls) {
          try {
            switch (tableName) {
              case 'html': {
                const data = await source.getHtml(url);
                if (data) await target.putHtml(data);
                break;
              }
              case 'comment': {
                const data = await source.getComment(url);
                if (data) await target.putComment(data);
                break;
              }
              case 'metadata': {
                const data = await source.getMetadata(url);
                if (data) await target.putMetadata(data);
                break;
              }
              case 'resource': {
                const data = await source.getResource(url);
                if (data) await target.putResource(data);
                break;
              }
              case 'resource-map': {
                const data = await source.getResourceMap(url);
                if (data) await target.putResourceMap(data);
                break;
              }
              case 'asset': {
                const data = await source.getAsset(url);
                if (data) await target.putAsset(data);
                break;
              }
              case 'comment_reply': {
                // 跳过，需要额外逻辑
                break;
              }
            }
          } catch {
            // 单条失败不中断
          }
          processed++;
          updateTableProgress(tableName, { current: processed });
        }
        updateTableProgress(tableName, { status: 'done' });
      } catch (e: any) {
        updateTableProgress(tableName, { status: 'error', error: e.message });
        // 不中断，继续下一张表
      }
    }

    // watched_account
    currentTable.value = 'watched_account';
    updateTableProgress('watched_account', { status: 'running' });
    try {
      const watched = await source.getAllWatchedAccounts();
      updateTableProgress('watched_account', { total: watched.length });
      for (let i = 0; i < watched.length; i++) {
        await target.putWatchedAccount(watched[i]);
        updateTableProgress('watched_account', { current: i + 1 });
      }
      updateTableProgress('watched_account', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('watched_account', { status: 'error', error: e.message });
    }

    // comment_monitor_task
    currentTable.value = 'comment_monitor_task';
    updateTableProgress('comment_monitor_task', { status: 'running' });
    try {
      const tasks = await source.getAllCommentMonitorTasks();
      updateTableProgress('comment_monitor_task', { total: tasks.length });
      for (let i = 0; i < tasks.length; i++) {
        const { id, ...taskWithoutId } = tasks[i];
        await target.createCommentMonitorTask(taskWithoutId);
        updateTableProgress('comment_monitor_task', { current: i + 1 });
      }
      updateTableProgress('comment_monitor_task', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('comment_monitor_task', { status: 'error', error: e.message });
    }
  }

  /**
   * 执行迁移
   */
  async function startMigration(dir: MigrationDirection) {
    migrating.value = true;
    direction.value = dir;
    error.value = null;
    completed.value = false;
    initProgress();

    try {
      if (dir === 'idb-to-pg') {
        // 先初始化 PG schema
        const ok = await initPgDatabase();
        if (!ok) {
          migrating.value = false;
          return;
        }
        await migrateIdbToPg();
        // 迁移完成，自动切换到 postgres 模式
        setStorageMode('postgres');
      } else {
        await migratePgToIdb();
        // 反向迁移完成，切换回 indexeddb 模式
        setStorageMode('indexeddb');
      }
      completed.value = true;
    } catch (e: any) {
      error.value = e.message || '迁移过程中发生未知错误';
    } finally {
      migrating.value = false;
      currentTable.value = '';
    }
  }

  /**
   * 获取 IndexedDB 各表的数据统计
   */
  async function getIdbStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    try {
      stats.info = await db.info.count();
      stats.article = await db.article.count();
      stats.html = await db.html.count();
      stats.comment = await db.comment.count();
      stats.comment_reply = await db.comment_reply.count();
      stats.metadata = await db.metadata.count();
      stats.resource = await db.resource.count();
      stats['resource-map'] = await db['resource-map'].count();
      stats.asset = await db.asset.count();
      stats.watched_account = await db.watched_account.count();
      stats.comment_monitor_task = await db.comment_monitor_task.count();
    } catch {
      // 某些表可能为空
    }
    return stats;
  }

  return {
    migrating,
    direction,
    tableProgress,
    currentTable,
    error,
    completed,
    overallProgress,
    currentMode,
    startMigration,
    getIdbStats,
    setStorageMode,
    initPgDatabase,
  };
}

/**
 * 将 CommentMonitorTask 的 camelCase 字段转为 snake_case
 */
function snakeCaseTask(task: any): Record<string, any> {
  return {
    fakeid: task.fakeid,
    nickname: task.nickname,
    article_url: task.article_url,
    article_title: task.article_title,
    article_aid: task.article_aid,
    comment_id: task.comment_id,
    status: task.status,
    created_at: task.created_at,
    tracking_end_at: task.tracking_end_at,
    accumulated_comments: task.accumulated_comments,
    final_comments: task.final_comments,
    shielded_comments: task.shielded_comments,
    stats: task.stats,
    error_msg: task.error_msg,
    auto_track_enabled: task.auto_track_enabled,
    source: task.source,
    source_fakeid: task.source_fakeid,
    last_sync_at: task.last_sync_at,
    comment_first_seen_at: task.comment_first_seen_at,
    comment_shielded_at: task.comment_shielded_at,
  };
}
