/**
 * 数据迁移 Composable
 * 支持 IndexedDB ↔ PostgreSQL 双向迁移
 */

import { useLocalStorage } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { MigrationProgress } from '~/store/v2/adapter';
import { setStorageMode as _setStorageMode, getStorageMode } from '~/store/v2/adapters';
import { IndexedDBAdapter } from '~/store/v2/adapters/indexeddb-adapter';
import { PgAdapter } from '~/store/v2/adapters/pg-adapter';
import { db } from '~/store/v2/db';

export type MigrationDirection = 'idb-to-pg' | 'pg-to-idb';

export interface TableProgress {
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

import { globalMigrationState } from '~/composables/useGlobalMigrationState';

export function useMigration() {
  const { migrating, direction, tableProgress, currentTable, error, completed, storageMode, isStopping } =
    globalMigrationState;

  const overallProgress = computed(() => {
    if (tableProgress.value.length === 0) return 0;
    const doneCount = tableProgress.value.filter(t => t.status === 'done' || t.status === 'skipped').length;
    return Math.round((doneCount / tableProgress.value.length) * 100);
  });

  const currentMode = computed(() => storageMode.value);

  function setStorageMode(mode: 'indexeddb' | 'postgres') {
    storageMode.value = mode;
    _setStorageMode(mode);
  }

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

  function checkStop() {
    if (isStopping.value) {
      throw new Error('用户中断了迁移');
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'mpAccount', ids: accounts.map(a => a.fakeid) },
      });
      const existingSet = new Set(existingIds);
      const newAccounts = accounts.filter(a => !existingSet.has(a.fakeid));

      updateTableProgress('info', { total: newAccounts.length });
      for (let i = 0; i < newAccounts.length; i++) {
        checkStop();
        await target.putAccount(newAccounts[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'article', ids: allArticles.map(a => `${a.fakeid}:${a.aid}`) },
      });
      const existingSet = new Set(existingIds);
      const newArticles = allArticles.filter(a => !existingSet.has(`${a.fakeid}:${a.aid}`));

      updateTableProgress('article', { total: newArticles.length });

      // 分批 200 条
      const BATCH = 200;
      for (let i = 0; i < newArticles.length; i += BATCH) {
        checkStop();
        const batch = newArticles.slice(i, i + BATCH);
        const keys = batch.map(a => `${a.fakeid}:${a.aid}`);
        await target.putArticles(batch, keys);
        updateTableProgress('article', { current: Math.min(i + BATCH, newArticles.length) });
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'html', ids: allHtml.map(h => h.url) },
      });
      const existingSet = new Set(existingIds);
      const newHtml = allHtml.filter(h => !existingSet.has(h.url));

      updateTableProgress('html', { total: newHtml.length });
      for (let i = 0; i < newHtml.length; i++) {
        checkStop();
        await target.putHtml(newHtml[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'comment', ids: allComments.map(c => c.url) },
      });
      const existingSet = new Set(existingIds);
      const newComments = allComments.filter(c => !existingSet.has(c.url));

      updateTableProgress('comment', { total: newComments.length });
      for (let i = 0; i < newComments.length; i++) {
        checkStop();
        await target.putComment(newComments[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'commentReply', ids: allReplies.map(r => `${r.url}:${r.contentID}`) },
      });
      const existingSet = new Set(existingIds);
      const newReplies = allReplies.filter(r => !existingSet.has(`${r.url}:${r.contentID}`));

      updateTableProgress('comment_reply', { total: newReplies.length });
      for (let i = 0; i < newReplies.length; i++) {
        checkStop();
        await target.putCommentReply(newReplies[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'metadata', ids: allMeta.map(m => m.url) },
      });
      const existingSet = new Set(existingIds);
      const newMeta = allMeta.filter(m => !existingSet.has(m.url));

      updateTableProgress('metadata', { total: newMeta.length });

      const BATCH = 200;
      for (let i = 0; i < newMeta.length; i += BATCH) {
        checkStop();
        const batch = newMeta.slice(i, i + BATCH);
        for (const m of batch) {
          await target.putMetadata(m);
        }
        updateTableProgress('metadata', { current: Math.min(i + BATCH, newMeta.length) });
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'resource', ids: allResources.map(r => r.url) },
      });
      const existingSet = new Set(existingIds);
      const newResources = allResources.filter(r => !existingSet.has(r.url));

      updateTableProgress('resource', { total: newResources.length });
      for (let i = 0; i < newResources.length; i++) {
        checkStop();
        await target.putResource(newResources[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'resourceMap', ids: allMaps.map(m => m.url) },
      });
      const existingSet = new Set(existingIds);
      const newMaps = allMaps.filter(m => !existingSet.has(m.url));

      updateTableProgress('resource-map', { total: newMaps.length });
      for (let i = 0; i < newMaps.length; i++) {
        checkStop();
        await target.putResourceMap(newMaps[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'asset', ids: allAssets.map(a => a.url) },
      });
      const existingSet = new Set(existingIds);
      const newAssets = allAssets.filter(a => !existingSet.has(a.url));

      updateTableProgress('asset', { total: newAssets.length });
      for (let i = 0; i < newAssets.length; i++) {
        checkStop();
        await target.putAsset(newAssets[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'watchedAccount', ids: allWatched.map(w => w.fakeid) },
      });
      const existingSet = new Set(existingIds);
      const newWatched = allWatched.filter(w => !existingSet.has(w.fakeid));

      updateTableProgress('watched_account', { total: newWatched.length });
      for (let i = 0; i < newWatched.length; i++) {
        checkStop();
        await target.putWatchedAccount(newWatched[i]);
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
      const existingIds = await $fetch<string[]>('/api/db/sync/check', {
        method: 'POST',
        body: { table: 'commentMonitorTask', ids: allTasks.map(t => String(t.id)) },
      });
      const existingSet = new Set(existingIds);
      const newTasks = allTasks.filter(t => !existingSet.has(String(t.id)));

      updateTableProgress('comment_monitor_task', { total: newTasks.length });
      for (let i = 0; i < newTasks.length; i++) {
        checkStop();
        const { id, ...taskWithoutId } = newTasks[i];
        // 迁移时保留原始 id
        await $fetch('/api/db/monitor-tasks', {
          method: 'POST',
          body: { ...taskWithoutId, id, ...snakeCaseTask(newTasks[i]) },
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
      const newAccounts = [];
      for (const account of accounts) {
        const exists = await target.getAccount(account.fakeid);
        if (!exists) {
          newAccounts.push(account);
        }
      }

      updateTableProgress('info', { total: newAccounts.length });
      for (let i = 0; i < newAccounts.length; i++) {
        checkStop();
        await target.putAccount(newAccounts[i]);
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

      // 先收集所有远端文章
      const allPgArticles = [];
      for (const account of accounts) {
        checkStop();
        const articles = await source.getArticles(account.fakeid);
        allPgArticles.push(...articles);
      }

      // 过滤已存在于本地的文章
      const newArticles = [];
      for (const a of allPgArticles) {
        const exists = await target.getArticleByLink(a.link);
        if (!exists) {
          newArticles.push(a);
        }
      }

      updateTableProgress('article', { total: newArticles.length });
      if (newArticles.length > 0) {
        const keys = newArticles.map(a => `${a.fakeid}:${a.aid}`);
        await target.putArticles(newArticles, keys);
      }
      updateTableProgress('article', { current: newArticles.length });
      updateTableProgress('article', { status: 'done' });
    } catch (e: any) {
      updateTableProgress('article', { status: 'error', error: e.message });
      throw e;
    }

    // 3-11: 对于 PG→IDB，检查本地已存在以跳过不必要的网络 Blob 请求
    const accounts = await source.getAllAccounts();

    for (const tableName of [
      'html',
      'comment',
      'comment_reply',
      'metadata',
      'resource',
      'resource-map',
      'asset',
    ] as const) {
      currentTable.value = tableName;
      updateTableProgress(tableName, { status: 'running' });
      try {
        const allArticles = await db.article.toArray();
        const urls = allArticles.map(a => a.link).filter(Boolean);

        // 增量过滤：判断本地是否已缓存
        const urlsToFetch = [];
        for (const url of urls) {
          checkStop();
          let exists = false;
          switch (tableName) {
            case 'html':
              exists = (await target.getHtml(url)) !== undefined;
              break;
            case 'comment':
              exists = (await target.getComment(url)) !== undefined;
              break;
            case 'metadata':
              exists = (await target.getMetadata(url)) !== undefined;
              break;
            case 'resource':
              exists = (await target.getResource(url)) !== undefined;
              break;
            case 'resource-map':
              exists = (await target.getResourceMap(url)) !== undefined;
              break;
            case 'asset':
              exists = (await target.getAsset(url)) !== undefined;
              break;
            case 'comment_reply':
              const count = await db.comment_reply.where('url').equals(url).count();
              exists = count > 0;
              break;
          }
          if (!exists) {
            urlsToFetch.push(url);
          }
        }

        updateTableProgress(tableName, { total: urlsToFetch.length });

        let processed = 0;
        for (const url of urlsToFetch) {
          checkStop();
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
      }
    }

    // watched_account
    currentTable.value = 'watched_account';
    updateTableProgress('watched_account', { status: 'running' });
    try {
      const watched = await source.getAllWatchedAccounts();
      const existing = await target.getAllWatchedAccounts();
      const existingSet = new Set(existing.map(x => x.fakeid));
      const newWatched = watched.filter(w => !existingSet.has(w.fakeid));

      updateTableProgress('watched_account', { total: newWatched.length });
      for (let i = 0; i < newWatched.length; i++) {
        checkStop();
        await target.putWatchedAccount(newWatched[i]);
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
      const existing = await target.getAllCommentMonitorTasks();
      const existingSet = new Set(existing.map(t => String(t.id)));
      const newTasks = tasks.filter(t => !existingSet.has(String(t.id)));

      updateTableProgress('comment_monitor_task', { total: newTasks.length });
      for (let i = 0; i < newTasks.length; i++) {
        checkStop();
        const { id, ...taskWithoutId } = newTasks[i];
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
    isStopping.value = false;
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
        // 迁移完成，不再自动切换到 postgres 模式，由用户手动切换
        // setStorageMode('postgres');
      } else {
        await migratePgToIdb();
        // 反向迁移完成，不再自动切换到 indexeddb 模式，由用户手动切换
        // setStorageMode('indexeddb');
      }
      completed.value = true;
    } catch (e: any) {
      if (isStopping.value) {
        error.value = '迁移已停止';
      } else {
        error.value = e.message || '迁移过程中发生未知错误';
      }
    } finally {
      migrating.value = false;
      isStopping.value = false;
      currentTable.value = '';
    }
  }

  function stopMigration() {
    isStopping.value = true;
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
    stopMigration,
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
