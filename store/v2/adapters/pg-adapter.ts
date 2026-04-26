/**
 * PostgreSQL 适配器
 * 通过 $fetch 调用 /api/db/* 端点实现 StoreAdapter 接口
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

/**
 * Blob → base64 工具
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // 去掉 data:*/*;base64, 前缀
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * base64 → Blob 工具
 */
function base64ToBlob(base64: string, type = 'application/octet-stream'): Blob {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

export class PgAdapter implements StoreAdapter {
  readonly mode = 'postgres' as const;

  // ─── MpAccount ───
  async getAccount(fakeid: string): Promise<MpAccount | undefined> {
    const result = await $fetch('/api/db/accounts', { query: { fakeid } });
    if (!result) return undefined;
    return this.mapAccountFromPg(result as any);
  }

  async getAllAccounts(): Promise<MpAccount[]> {
    const result = await $fetch<any[]>('/api/db/accounts');
    return (result || []).map(r => this.mapAccountFromPg(r));
  }

  async putAccount(account: MpAccount): Promise<void> {
    await $fetch('/api/db/accounts', {
      method: 'POST',
      body: {
        fakeid: account.fakeid,
        nickname: account.nickname,
        round_head_img: account.round_head_img,
        completed: account.completed,
        count: account.count,
        articles: account.articles,
        total_count: account.total_count,
        create_time: account.create_time,
        update_time: account.update_time,
        last_update_time: account.last_update_time,
      },
    });
  }

  private mapAccountFromPg(r: any): MpAccount {
    return {
      fakeid: r.fakeid,
      nickname: r.nickname,
      round_head_img: r.roundHeadImg ?? r.round_head_img,
      completed: r.completed,
      count: r.count,
      articles: r.articles,
      total_count: r.totalCount ?? r.total_count,
      create_time: r.createTime ?? r.create_time,
      update_time: r.updateTime ?? r.update_time,
      last_update_time: r.lastUpdateTime ?? r.last_update_time,
    };
  }

  // ─── Article ───
  async getArticles(fakeid: string, beforeTime?: number): Promise<ArticleAsset[]> {
    const query: Record<string, any> = { fakeid };
    if (beforeTime) query.before_time = beforeTime;
    const result = await $fetch<any[]>('/api/db/articles', { query });
    return (result || []).map(r => this.mapArticleFromPg(r));
  }

  async getArticleByLink(url: string): Promise<ArticleAsset | undefined> {
    const result = await $fetch('/api/db/articles', { query: { link: url } });
    if (!result) return undefined;
    return this.mapArticleFromPg(result as any);
  }

  async putArticles(articles: ArticleAsset[], keys?: string[]): Promise<string[]> {
    const items = articles.map((article, i) => ({
      id: keys?.[i] || `${article.fakeid}:${article.aid}`,
      fakeid: article.fakeid,
      aid: article.aid,
      title: article.title,
      link: article.link,
      digest: article.digest,
      cover: article.cover,
      author_name: article.author_name,
      create_time: article.create_time,
      update_time: article.update_time,
      appmsgid: article.appmsgid,
      itemidx: article.itemidx,
      is_deleted: article.is_deleted,
      _status: article._status,
      _single: article._single,
      // 将其余字段打包进 extra
      album_id: article.album_id,
      appmsg_album_infos: article.appmsg_album_infos,
      ban_flag: article.ban_flag,
      checking: article.checking,
      copyright_stat: article.copyright_stat,
      copyright_type: article.copyright_type,
      cover_img: article.cover_img,
      cover_img_theme_color: article.cover_img_theme_color,
      has_red_packet_cover: article.has_red_packet_cover,
      is_pay_subscribe: article.is_pay_subscribe,
      wecoin_count: article.wecoin_count,
      item_show_type: article.item_show_type,
      media_duration: article.media_duration,
      mediaapi_publish_status: article.mediaapi_publish_status,
      pic_cdn_url_1_1: article.pic_cdn_url_1_1,
      pic_cdn_url_3_4: article.pic_cdn_url_3_4,
      pic_cdn_url_16_9: article.pic_cdn_url_16_9,
      pic_cdn_url_235_1: article.pic_cdn_url_235_1,
    }));

    // 分批上传，每批 200 条
    const BATCH_SIZE = 200;
    const resultKeys: string[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await $fetch('/api/db/articles', { method: 'POST', body: batch });
      resultKeys.push(...batch.map(b => b.id));
    }
    return resultKeys;
  }

  async updateArticleStatus(url: string, status: string): Promise<void> {
    await $fetch('/api/db/articles', {
      method: 'PATCH',
      body: { link: url, _status: status },
    });
  }

  async updateArticleFakeid(url: string, fakeid: string): Promise<void> {
    await $fetch('/api/db/articles', {
      method: 'PATCH',
      body: { link: url, fakeid: 'SINGLE_ARTICLE_FAKEID', _single: true, fakeid_new: fakeid },
    });
  }

  async articleDeleted(url: string, isDeleted = true): Promise<void> {
    await $fetch('/api/db/articles', {
      method: 'PATCH',
      body: { link: url, is_deleted: isDeleted },
    });
  }

  private mapArticleFromPg(r: any): ArticleAsset {
    const extra = r.extra || {};
    return {
      fakeid: r.fakeid,
      aid: r.aid ?? extra.aid ?? '',
      title: r.title ?? '',
      link: r.link ?? '',
      digest: r.digest ?? '',
      cover: r.cover ?? '',
      author_name: r.authorName ?? r.author_name ?? '',
      create_time: r.createTime ?? r.create_time ?? 0,
      update_time: r.updateTime ?? r.update_time ?? 0,
      appmsgid: r.appmsgid ?? 0,
      itemidx: r.itemidx ?? 0,
      is_deleted: r.isDeleted ?? r.is_deleted ?? false,
      _status: r.status ?? r._status ?? '',
      _single: r.single ?? r._single ?? false,
      // 从 extra 恢复其余字段
      album_id: extra.album_id ?? '',
      appmsg_album_infos: extra.appmsg_album_infos ?? [],
      ban_flag: extra.ban_flag ?? 0,
      checking: extra.checking ?? 0,
      copyright_stat: extra.copyright_stat ?? 0,
      copyright_type: extra.copyright_type ?? 0,
      cover_img: extra.cover_img,
      cover_img_theme_color: extra.cover_img_theme_color,
      has_red_packet_cover: extra.has_red_packet_cover ?? 0,
      is_pay_subscribe: extra.is_pay_subscribe ?? 0,
      wecoin_count: extra.wecoin_count ?? 0,
      item_show_type: extra.item_show_type ?? 0,
      media_duration: extra.media_duration ?? '',
      mediaapi_publish_status: extra.mediaapi_publish_status ?? 0,
      pic_cdn_url_1_1: extra.pic_cdn_url_1_1 ?? '',
      pic_cdn_url_3_4: extra.pic_cdn_url_3_4 ?? '',
      pic_cdn_url_16_9: extra.pic_cdn_url_16_9 ?? '',
      pic_cdn_url_235_1: extra.pic_cdn_url_235_1 ?? '',
    };
  }

  // ─── HTML ───
  async getHtml(url: string): Promise<HtmlAsset | undefined> {
    const result = await $fetch<any>('/api/db/html', { query: { url } });
    if (!result) return undefined;
    return {
      url: result.url,
      fakeid: result.fakeid,
      title: result.title,
      commentID: result.commentId,
      file: result.fileData ? base64ToBlob(result.fileData, 'text/html') : new Blob([]),
    };
  }

  async putHtml(html: HtmlAsset): Promise<void> {
    const fileData = await blobToBase64(html.file);
    await $fetch('/api/db/html', {
      method: 'POST',
      body: {
        url: html.url,
        fakeid: html.fakeid,
        title: html.title,
        commentId: html.commentID,
        fileData,
      },
    });
  }

  // ─── Comment ───
  async getComment(url: string): Promise<CommentAsset | undefined> {
    const result = await $fetch<any>('/api/db/comments', { query: { url } });
    if (!result) return undefined;
    return { url: result.url, fakeid: result.fakeid, title: result.title, data: result.data };
  }

  async putComment(comment: CommentAsset): Promise<void> {
    await $fetch('/api/db/comments', { method: 'POST', body: comment });
  }

  // ─── CommentReply ───
  async getCommentReply(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
    const result = await $fetch<any>('/api/db/comment-replies', {
      query: { url, content_id: contentID },
    });
    if (!result) return undefined;
    return {
      url: result.url,
      fakeid: result.fakeid,
      title: result.title,
      data: result.data,
      contentID: result.contentId ?? result.content_id,
    };
  }

  async putCommentReply(reply: CommentReplyAsset): Promise<void> {
    await $fetch('/api/db/comment-replies', { method: 'POST', body: reply });
  }

  // ─── Metadata ───
  async getMetadata(url: string): Promise<Metadata | undefined> {
    const result = await $fetch<any>('/api/db/metadata', { query: { url } });
    if (!result) return undefined;
    return {
      url: result.url,
      fakeid: result.fakeid,
      title: result.title,
      readNum: result.readNum ?? result.read_num ?? 0,
      oldLikeNum: result.oldLikeNum ?? result.old_like_num ?? 0,
      shareNum: result.shareNum ?? result.share_num ?? 0,
      likeNum: result.likeNum ?? result.like_num ?? 0,
      commentNum: result.commentNum ?? result.comment_num ?? 0,
    };
  }

  async putMetadata(metadata: Metadata): Promise<void> {
    await $fetch('/api/db/metadata', { method: 'POST', body: metadata });
  }

  // ─── Resource ───
  async getResource(url: string): Promise<ResourceAsset | undefined> {
    const result = await $fetch<any>('/api/db/resources', { query: { url } });
    if (!result) return undefined;
    return {
      url: result.url,
      fakeid: result.fakeid,
      file: result.fileData ? base64ToBlob(result.fileData) : new Blob([]),
    };
  }

  async putResource(resource: ResourceAsset): Promise<void> {
    const fileData = await blobToBase64(resource.file);
    await $fetch('/api/db/resources', {
      method: 'POST',
      body: { url: resource.url, fakeid: resource.fakeid, fileData },
    });
  }

  // ─── ResourceMap ───
  async getResourceMap(url: string): Promise<ResourceMapAsset | undefined> {
    const result = await $fetch<any>('/api/db/resource-maps', { query: { url } });
    if (!result) return undefined;
    return { url: result.url, fakeid: result.fakeid, resources: result.resources };
  }

  async putResourceMap(resourceMap: ResourceMapAsset): Promise<void> {
    await $fetch('/api/db/resource-maps', { method: 'POST', body: resourceMap });
  }

  // ─── Asset ───
  async getAsset(url: string): Promise<Asset | undefined> {
    const result = await $fetch<any>('/api/db/assets', { query: { url } });
    if (!result) return undefined;
    return {
      url: result.url,
      fakeid: result.fakeid,
      file: result.fileData ? base64ToBlob(result.fileData) : new Blob([]),
    };
  }

  async putAsset(asset: Asset): Promise<void> {
    const fileData = await blobToBase64(asset.file);
    await $fetch('/api/db/assets', {
      method: 'POST',
      body: { url: asset.url, fakeid: asset.fakeid, fileData },
    });
  }

  // ─── Debug ───
  async getDebug(url: string): Promise<DebugAsset | undefined> {
    // 复用 assets 端点或创建专用端点，此处简化为不支持 debug 在 PG 模式
    return undefined;
  }

  async putDebug(_debug: DebugAsset): Promise<void> {
    // Debug 数据在 PG 模式下暂不存储
  }

  async getAllDebug(): Promise<DebugAsset[]> {
    return [];
  }

  // ─── WatchedAccount ───
  async getAllWatchedAccounts(): Promise<WatchedAccount[]> {
    const result = await $fetch<any[]>('/api/db/watched-accounts');
    return (result || []).map(r => this.mapWatchedAccountFromPg(r));
  }

  async getEnabledWatchedAccounts(): Promise<WatchedAccount[]> {
    const all = await this.getAllWatchedAccounts();
    return all.filter(w => w.enabled);
  }

  async putWatchedAccount(account: WatchedAccount): Promise<void> {
    await $fetch('/api/db/watched-accounts', {
      method: 'POST',
      body: {
        fakeid: account.fakeid,
        nickname: account.nickname,
        round_head_img: account.round_head_img,
        enabled: account.enabled,
        last_check_time: account.last_check_time,
        last_known_aid: account.last_known_aid,
        check_count: account.check_count,
        last_discovery_at: account.last_discovery_at,
        discovered_count: account.discovered_count,
      },
    });
  }

  async removeWatchedAccount(fakeid: string): Promise<void> {
    await $fetch('/api/db/watched-accounts', {
      method: 'DELETE',
      body: { fakeid },
    });
  }

  async updateWatchedAccount(fakeid: string, changes: Partial<WatchedAccount>): Promise<void> {
    // 先获取当前数据，合并后写入
    const current = await this.getAllWatchedAccounts();
    const existing = current.find(w => w.fakeid === fakeid);
    if (existing) {
      await this.putWatchedAccount({ ...existing, ...changes });
    }
  }

  private mapWatchedAccountFromPg(r: any): WatchedAccount {
    return {
      fakeid: r.fakeid,
      nickname: r.nickname ?? '',
      round_head_img: r.roundHeadImg ?? r.round_head_img ?? '',
      enabled: r.enabled ?? true,
      last_check_time: r.lastCheckTime ?? r.last_check_time ?? 0,
      last_known_aid: r.lastKnownAid ?? r.last_known_aid ?? '',
      check_count: r.checkCount ?? r.check_count ?? 0,
      last_discovery_at: r.lastDiscoveryAt ?? r.last_discovery_at ?? 0,
      discovered_count: r.discoveredCount ?? r.discovered_count ?? 0,
    };
  }

  // ─── CommentMonitorTask ───
  async getAllCommentMonitorTasks(): Promise<CommentMonitorTask[]> {
    const result = await $fetch<any[]>('/api/db/monitor-tasks');
    return (result || []).map(r => this.mapTaskFromPg(r));
  }

  async getCommentMonitorTasksByStatus(status: CommentMonitorTask['status']): Promise<CommentMonitorTask[]> {
    const result = await $fetch<any[]>('/api/db/monitor-tasks', { query: { status } });
    return (result || []).map(r => this.mapTaskFromPg(r));
  }

  async getCommentMonitorTasksByFakeid(fakeid: string): Promise<CommentMonitorTask[]> {
    const result = await $fetch<any[]>('/api/db/monitor-tasks', { query: { fakeid } });
    return (result || []).map(r => this.mapTaskFromPg(r));
  }

  async createCommentMonitorTask(task: Omit<CommentMonitorTask, 'id'>): Promise<number> {
    const result = await $fetch<any>('/api/db/monitor-tasks', {
      method: 'POST',
      body: {
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
      },
    });
    return result?.id ?? 0;
  }

  async updateCommentMonitorTask(id: number, changes: Partial<CommentMonitorTask>): Promise<void> {
    await $fetch('/api/db/monitor-tasks', {
      method: 'PATCH',
      body: { id, ...changes },
    });
  }

  async deleteCommentMonitorTask(id: number): Promise<void> {
    await $fetch('/api/db/monitor-tasks', {
      method: 'DELETE',
      body: { id },
    });
  }

  private mapTaskFromPg(r: any): CommentMonitorTask {
    return {
      id: r.id,
      fakeid: r.fakeid,
      nickname: r.nickname ?? '',
      article_url: r.articleUrl ?? r.article_url ?? '',
      article_title: r.articleTitle ?? r.article_title ?? '',
      article_aid: r.articleAid ?? r.article_aid ?? '',
      comment_id: r.commentId ?? r.comment_id ?? '',
      status: r.status,
      created_at: r.createdAt ?? r.created_at ?? 0,
      tracking_end_at: r.trackingEndAt ?? r.tracking_end_at ?? 0,
      accumulated_comments: r.accumulatedComments ?? r.accumulated_comments ?? [],
      final_comments: r.finalComments ?? r.final_comments ?? [],
      shielded_comments: r.shieldedComments ?? r.shielded_comments ?? [],
      stats: r.stats ?? {},
      error_msg: r.errorMsg ?? r.error_msg ?? '',
      auto_track_enabled: r.autoTrackEnabled ?? r.auto_track_enabled ?? true,
      source: r.source ?? 'auto',
      source_fakeid: r.sourceFakeid ?? r.source_fakeid,
      last_sync_at: r.lastSyncAt ?? r.last_sync_at ?? 0,
      comment_first_seen_at: r.commentFirstSeenAt ?? r.comment_first_seen_at,
      comment_shielded_at: r.commentShieldedAt ?? r.comment_shielded_at,
    };
  }

  // ─── 批量删除 ───
  async deleteAccountData(fakeids: string[]): Promise<void> {
    await $fetch('/api/db/accounts', {
      method: 'DELETE',
      body: { fakeids },
    });
  }
}
