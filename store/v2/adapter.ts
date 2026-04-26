/**
 * 存储适配器接口
 * 统一抽象 IndexedDB 和 PostgreSQL 的数据访问层
 */
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

export interface StoreAdapter {
  readonly mode: 'indexeddb' | 'postgres';

  // ─── MpAccount (info) ───
  getAccount(fakeid: string): Promise<MpAccount | undefined>;
  getAllAccounts(): Promise<MpAccount[]>;
  putAccount(account: MpAccount): Promise<void>;

  // ─── Article ───
  getArticles(fakeid: string, beforeTime?: number): Promise<ArticleAsset[]>;
  getArticleByLink(url: string): Promise<ArticleAsset | undefined>;
  putArticles(articles: ArticleAsset[], keys?: string[]): Promise<string[]>;
  updateArticleStatus(url: string, status: string): Promise<void>;
  updateArticleFakeid(url: string, fakeid: string): Promise<void>;
  articleDeleted(url: string, isDeleted?: boolean): Promise<void>;

  // ─── HTML ───
  getHtml(url: string): Promise<HtmlAsset | undefined>;
  putHtml(html: HtmlAsset): Promise<void>;

  // ─── Comment ───
  getComment(url: string): Promise<CommentAsset | undefined>;
  putComment(comment: CommentAsset): Promise<void>;

  // ─── CommentReply ───
  getCommentReply(url: string, contentID: string): Promise<CommentReplyAsset | undefined>;
  putCommentReply(reply: CommentReplyAsset): Promise<void>;

  // ─── Metadata ───
  getMetadata(url: string): Promise<Metadata | undefined>;
  putMetadata(metadata: Metadata): Promise<void>;

  // ─── Resource ───
  getResource(url: string): Promise<ResourceAsset | undefined>;
  putResource(resource: ResourceAsset): Promise<void>;

  // ─── ResourceMap ───
  getResourceMap(url: string): Promise<ResourceMapAsset | undefined>;
  putResourceMap(resourceMap: ResourceMapAsset): Promise<void>;

  // ─── Asset ───
  getAsset(url: string): Promise<Asset | undefined>;
  putAsset(asset: Asset): Promise<void>;

  // ─── Debug ───
  getDebug(url: string): Promise<DebugAsset | undefined>;
  putDebug(debug: DebugAsset): Promise<void>;
  getAllDebug(): Promise<DebugAsset[]>;

  // ─── WatchedAccount ───
  getAllWatchedAccounts(): Promise<WatchedAccount[]>;
  getEnabledWatchedAccounts(): Promise<WatchedAccount[]>;
  putWatchedAccount(account: WatchedAccount): Promise<void>;
  removeWatchedAccount(fakeid: string): Promise<void>;
  updateWatchedAccount(fakeid: string, changes: Partial<WatchedAccount>): Promise<void>;

  // ─── CommentMonitorTask ───
  getAllCommentMonitorTasks(): Promise<CommentMonitorTask[]>;
  getCommentMonitorTasksByStatus(status: CommentMonitorTask['status']): Promise<CommentMonitorTask[]>;
  getCommentMonitorTasksByFakeid(fakeid: string): Promise<CommentMonitorTask[]>;
  createCommentMonitorTask(task: Omit<CommentMonitorTask, 'id'>): Promise<number>;
  updateCommentMonitorTask(id: number, changes: Partial<CommentMonitorTask>): Promise<void>;
  deleteCommentMonitorTask(id: number): Promise<void>;

  // ─── 批量操作 ───
  deleteAccountData(fakeids: string[]): Promise<void>;
}

/**
 * 迁移进度回调
 */
export interface MigrationProgress {
  table: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void;
