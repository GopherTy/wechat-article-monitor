import Dexie, { type EntityTable, type Table } from 'dexie';
import type { ArticleAsset } from './article';
import type { Asset } from './assets';
import type { CommentAsset } from './comment';
import type { CommentReplyAsset } from './comment_reply';
import type { CommentMonitorTask } from './commentMonitorTask';
import type { DebugAsset } from './debug';
import type { HtmlAsset } from './html';
import type { MpAccount } from './info';
import type { Metadata } from './metadata';
import type { MonitorTask, MonitorWatch } from './monitor';
import type { ResourceAsset } from './resource';
import type { ResourceMapAsset } from './resource-map';
import type { WatchedAccount } from './watchedAccount';

const db = new Dexie('exporter.wxdown.online') as Dexie & {
  article: Table<ArticleAsset, string>;
  asset: EntityTable<Asset, 'url'>;
  comment: EntityTable<CommentAsset, 'url'>;
  comment_reply: Table<CommentReplyAsset, string>;
  debug: EntityTable<DebugAsset, 'url'>;
  html: EntityTable<HtmlAsset, 'url'>;
  info: EntityTable<MpAccount, 'fakeid'>;
  metadata: EntityTable<Metadata, 'url'>;
  /** @deprecated v5 起请使用 watched_account；此表仅保留以备回退查询 */
  monitor_watch: EntityTable<MonitorWatch, 'fakeid'>;
  /** @deprecated v5 起请使用 comment_monitor_task；此表仅保留以备回退查询 */
  monitor_task: EntityTable<MonitorTask, 'id'>;
  watched_account: EntityTable<WatchedAccount, 'fakeid'>;
  comment_monitor_task: EntityTable<CommentMonitorTask, 'id'>;
  resource: EntityTable<ResourceAsset, 'url'>;
  'resource-map': EntityTable<ResourceMapAsset, 'url'>;
};

db.version(1).stores({
  api: '++, name, account, call_time',
  article: ', fakeid, create_time, link', // 主键 fakeid:aid
  asset: 'url',
  comment: 'url',
  comment_reply: ', url, contentID', // 主键 url:contentID
  debug: 'url',
  html: 'url',
  info: 'fakeid',
  metadata: 'url',
  resource: 'url',
  'resource-map': 'url',
});

db.version(2).stores({
  asset: 'url, fakeid',
  comment: 'url, fakeid',
  comment_reply: ', url, contentID, fakeid',
  html: 'url, fakeid',
  metadata: 'url, fakeid',
  resource: 'url, fakeid',
  'resource-map': 'url, fakeid',
});

db.version(3).stores({
  debug: 'url, fakeid',
});

db.version(4).stores({
  monitor_watch: 'fakeid',
  monitor_task: '++id, fakeid, status, created_at',
});

db.version(5)
  .stores({
    watched_account: 'fakeid',
    comment_monitor_task: '++id, fakeid, status, source, created_at',
  })
  .upgrade(async tx => {
    try {
      const oldWatches = await tx.table('monitor_watch').toArray();
      if (oldWatches.length > 0) {
        const migrated = oldWatches.map((w: any) => ({
          fakeid: w.fakeid,
          nickname: w.nickname,
          round_head_img: w.round_head_img,
          enabled: w.enabled ?? true,
          last_check_time: w.last_check_time ?? 0,
          last_known_aid: w.last_known_aid ?? '',
          check_count: w.check_count ?? 0,
          last_discovery_at: 0,
          discovered_count: 0,
        }));
        await tx.table('watched_account').bulkPut(migrated);
        console.info(`[Monitor v5 migration] migrated ${migrated.length} watched accounts`);
      }
    } catch (err) {
      console.error('[Monitor v5 migration] watched_account migration failed:', err);
    }

    try {
      const oldTasks = await tx.table('monitor_task').toArray();
      if (oldTasks.length > 0) {
        const migrated = oldTasks.map((t: any) => ({
          id: t.id,
          fakeid: t.fakeid,
          nickname: t.nickname,
          article_url: t.article_url,
          article_title: t.article_title,
          article_aid: t.article_aid,
          comment_id: t.comment_id ?? '',
          status: t.status,
          created_at: t.created_at,
          tracking_end_at: t.tracking_end_at,
          accumulated_comments: t.accumulated_comments ?? [],
          final_comments: t.final_comments ?? [],
          shielded_comments: t.shielded_comments ?? [],
          stats: t.stats ?? {},
          error_msg: t.error_msg ?? '',
          auto_track_enabled: t.auto_track_enabled ?? true,
          source: 'auto' as const,
          source_fakeid: t.fakeid,
          last_sync_at: t.created_at,
        }));
        await tx.table('comment_monitor_task').bulkPut(migrated);
        console.info(`[Monitor v5 migration] migrated ${migrated.length} comment monitor tasks`);
      }
    } catch (err) {
      console.error('[Monitor v5 migration] comment_monitor_task migration failed:', err);
    }
  });

export { db };
