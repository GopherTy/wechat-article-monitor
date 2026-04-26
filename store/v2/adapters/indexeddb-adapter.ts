/**
 * IndexedDB 适配器
 * 包装现有 Dexie 逻辑，实现 StoreAdapter 接口
 */
import type { StoreAdapter } from '~/store/v2/adapter';
import type { ArticleAsset } from '~/store/v2/article';
import type { Asset } from '~/store/v2/assets';
import type { CommentAsset } from '~/store/v2/comment';
import type { CommentReplyAsset } from '~/store/v2/comment_reply';
import type { CommentMonitorTask } from '~/store/v2/commentMonitorTask';
import type { DebugAsset } from '~/store/v2/debug';
import type { HtmlAsset } from '~/store/v2/html';
import type { MpAccount } from '~/store/v2/info';
import type { Metadata } from '~/store/v2/metadata';
import type { ResourceAsset } from '~/store/v2/resource';
import type { ResourceMapAsset } from '~/store/v2/resource-map';
import type { WatchedAccount } from '~/store/v2/watchedAccount';
import { db } from '~/store/v2/db';

export class IndexedDBAdapter implements StoreAdapter {
  readonly mode = 'indexeddb' as const;

  // ─── MpAccount ───
  async getAccount(fakeid: string): Promise<MpAccount | undefined> {
    return db.info.get(fakeid);
  }

  async getAllAccounts(): Promise<MpAccount[]> {
    return db.info.toArray();
  }

  async putAccount(account: MpAccount): Promise<void> {
    await db.info.put(account);
  }

  // ─── Article ───
  async getArticles(fakeid: string, beforeTime?: number): Promise<ArticleAsset[]> {
    let query = db.article.where('fakeid').equals(fakeid);
    if (beforeTime) {
      query = query.and(article => article.create_time < beforeTime);
    }
    return query.reverse().sortBy('create_time');
  }

  async getArticleByLink(url: string): Promise<ArticleAsset | undefined> {
    return db.article.where('link').equals(url).first();
  }

  async putArticles(articles: ArticleAsset[], keys?: string[]): Promise<string[]> {
    const resultKeys: string[] = [];
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const key = keys?.[i] || `${article.fakeid}:${article.aid}`;
      await db.article.put(article, key);
      resultKeys.push(key);
    }
    return resultKeys;
  }

  async updateArticleStatus(url: string, status: string): Promise<void> {
    await db.article
      .where('link')
      .equals(url)
      .modify(article => {
        article._status = status;
      });
  }

  async updateArticleFakeid(url: string, fakeid: string): Promise<void> {
    await db.article
      .where('link')
      .equals(url)
      .and(article => article.fakeid === 'SINGLE_ARTICLE_FAKEID')
      .modify(article => {
        article.fakeid = fakeid;
        article._single = true;
      });
  }

  async articleDeleted(url: string, isDeleted = true): Promise<void> {
    await db.article
      .where('link')
      .equals(url)
      .modify(article => {
        article.is_deleted = isDeleted;
      });
  }

  // ─── HTML ───
  async getHtml(url: string): Promise<HtmlAsset | undefined> {
    return db.html.get(url);
  }

  async putHtml(html: HtmlAsset): Promise<void> {
    await db.html.put(html);
  }

  // ─── Comment ───
  async getComment(url: string): Promise<CommentAsset | undefined> {
    return db.comment.get(url);
  }

  async putComment(comment: CommentAsset): Promise<void> {
    await db.comment.put(comment);
  }

  // ─── CommentReply ───
  async getCommentReply(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
    return db.comment_reply.get(`${url}:${contentID}`);
  }

  async putCommentReply(reply: CommentReplyAsset): Promise<void> {
    await db.comment_reply.put(reply, `${reply.url}:${reply.contentID}`);
  }

  // ─── Metadata ───
  async getMetadata(url: string): Promise<Metadata | undefined> {
    return db.metadata.get(url);
  }

  async putMetadata(metadata: Metadata): Promise<void> {
    await db.metadata.put(metadata);
  }

  // ─── Resource ───
  async getResource(url: string): Promise<ResourceAsset | undefined> {
    return db.resource.get(url);
  }

  async putResource(resource: ResourceAsset): Promise<void> {
    await db.resource.put(resource);
  }

  // ─── ResourceMap ───
  async getResourceMap(url: string): Promise<ResourceMapAsset | undefined> {
    return db['resource-map'].get(url);
  }

  async putResourceMap(resourceMap: ResourceMapAsset): Promise<void> {
    await db['resource-map'].put(resourceMap);
  }

  // ─── Asset ───
  async getAsset(url: string): Promise<Asset | undefined> {
    return db.asset.get(url);
  }

  async putAsset(asset: Asset): Promise<void> {
    await db.asset.put(asset);
  }

  // ─── Debug ───
  async getDebug(url: string): Promise<DebugAsset | undefined> {
    return db.debug.get(url);
  }

  async putDebug(debug: DebugAsset): Promise<void> {
    await db.debug.put(debug);
  }

  async getAllDebug(): Promise<DebugAsset[]> {
    return db.debug.toArray();
  }

  // ─── WatchedAccount ───
  async getAllWatchedAccounts(): Promise<WatchedAccount[]> {
    return db.watched_account.toArray();
  }

  async getEnabledWatchedAccounts(): Promise<WatchedAccount[]> {
    return db.watched_account.filter(w => w.enabled).toArray();
  }

  async putWatchedAccount(account: WatchedAccount): Promise<void> {
    await db.watched_account.put(account);
  }

  async removeWatchedAccount(fakeid: string): Promise<void> {
    await db.watched_account.delete(fakeid);
  }

  async updateWatchedAccount(fakeid: string, changes: Partial<WatchedAccount>): Promise<void> {
    await db.watched_account.update(fakeid, changes);
  }

  // ─── CommentMonitorTask ───
  async getAllCommentMonitorTasks(): Promise<CommentMonitorTask[]> {
    return db.comment_monitor_task.orderBy('created_at').reverse().toArray();
  }

  async getCommentMonitorTasksByStatus(status: CommentMonitorTask['status']): Promise<CommentMonitorTask[]> {
    return db.comment_monitor_task.where('status').equals(status).toArray();
  }

  async getCommentMonitorTasksByFakeid(fakeid: string): Promise<CommentMonitorTask[]> {
    return db.comment_monitor_task.where('fakeid').equals(fakeid).toArray();
  }

  async createCommentMonitorTask(task: Omit<CommentMonitorTask, 'id'>): Promise<number> {
    return db.comment_monitor_task.add(task as CommentMonitorTask) as Promise<number>;
  }

  async updateCommentMonitorTask(id: number, changes: Partial<CommentMonitorTask>): Promise<void> {
    await db.comment_monitor_task.update(id, changes);
  }

  async deleteCommentMonitorTask(id: number): Promise<void> {
    await db.comment_monitor_task.delete(id);
  }

  // ─── 批量删除 ───
  async deleteAccountData(fakeids: string[]): Promise<void> {
    await db.transaction(
      'rw',
      ['article', 'asset', 'comment', 'comment_reply', 'debug', 'html', 'info', 'metadata', 'resource', 'resource-map'],
      async () => {
        db.article.where('fakeid').anyOf(fakeids).delete();
        db.asset.where('fakeid').anyOf(fakeids).delete();
        db.comment.where('fakeid').anyOf(fakeids).delete();
        db.comment_reply.where('fakeid').anyOf(fakeids).delete();
        db.debug.where('fakeid').anyOf(fakeids).delete();
        db.html.where('fakeid').anyOf(fakeids).delete();
        db.info.where('fakeid').anyOf(fakeids).delete();
        db.metadata.where('fakeid').anyOf(fakeids).delete();
        db.resource.where('fakeid').anyOf(fakeids).delete();
        db['resource-map'].where('fakeid').anyOf(fakeids).delete();
      }
    );
  }
}
