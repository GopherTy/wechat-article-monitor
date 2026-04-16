import { updateArticleFakeid } from '~/store/v2/article';
import { getCommentCache } from '~/store/v2/comment';
import { db } from '~/store/v2/db';
import { getHtmlCache } from '~/store/v2/html';
import { type MonitorTask, updateTask } from '~/store/v2/monitor';
import type { Comment } from '~/types/comment';
import type { AppMsgExWithFakeID } from '~/types/types';
import { Downloader } from '~/utils/download/Downloader';

const SINGLE_ARTICLE_FAKEID = 'SINGLE_ARTICLE_FAKEID';

export function parseArticleUrlMeta(articleUrl: string) {
  const parsed = new URL(articleUrl);
  const params = parsed.searchParams;
  const fakeid = params.get('__biz') || SINGLE_ARTICLE_FAKEID;
  const mid = params.get('mid') || params.get('appmsgid') || `${Date.now()}`;
  const idx = params.get('idx') || params.get('itemidx') || '1';
  const itemidx = Number(idx) || 1;
  return {
    fakeid,
    appmsgid: Number(mid),
    itemidx,
    aid: `${mid}_${itemidx}`,
  };
}

function buildMonitorArticleStub(task: MonitorTask): AppMsgExWithFakeID {
  const { fakeid, appmsgid, itemidx, aid } = parseArticleUrlMeta(task.article_url);
  const resolvedFakeid = task.fakeid || fakeid;
  return {
    fakeid: resolvedFakeid,
    _status: '',
    aid,
    album_id: '',
    appmsg_album_infos: [],
    appmsgid,
    author_name: '',
    ban_flag: 0,
    checking: 0,
    copyright_stat: 0,
    copyright_type: 0,
    cover: '',
    cover_img: '',
    cover_img_theme_color: undefined,
    create_time: Math.floor(task.created_at / 1000),
    digest: '',
    has_red_packet_cover: 0,
    is_deleted: false,
    is_pay_subscribe: 0,
    item_show_type: 0,
    itemidx,
    link: task.article_url,
    media_duration: '0:00',
    mediaapi_publish_status: 0,
    pic_cdn_url_1_1: '',
    pic_cdn_url_3_4: '',
    pic_cdn_url_16_9: '',
    pic_cdn_url_235_1: '',
    title: task.article_title || '未命名文章',
    update_time: Math.floor(Date.now() / 1000),
    wecoin_count: 0,
    _single: true,
  };
}

export async function ensureMonitorTaskArticleStub(task: MonitorTask) {
  const article = buildMonitorArticleStub(task);
  await db.article.put(article, `${article.fakeid}:${article.aid}`);
}

export interface SyncTaskCommentsResult {
  task: MonitorTask;
  latestComments: Comment[];
  mergedComments: Comment[];
}

export async function syncMonitorTaskComments(task: MonitorTask): Promise<SyncTaskCommentsResult> {
  await ensureMonitorTaskArticleStub(task);

  const updatedTask: MonitorTask = {
    ...task,
    accumulated_comments: [...(task.accumulated_comments ?? [])],
  };

  if (updatedTask.fakeid === SINGLE_ARTICLE_FAKEID) {
    let fixedFakeid = '';
    const fakeidDownloader = new Downloader([updatedTask.article_url], { maxRetries: 1 });
    fakeidDownloader.on('fix:fakeid', (_url: string, fakeid: string) => {
      fixedFakeid = fakeid;
    });

    try {
      await fakeidDownloader.startDownload('fakeid');
    } finally {
      fakeidDownloader.removeAllListeners();
    }

    if (!fixedFakeid) {
      throw new Error('未能修复文章 fakeid');
    }

    await updateArticleFakeid(updatedTask.article_url, fixedFakeid);
    updatedTask.fakeid = fixedFakeid;
    if (updatedTask.id) {
      await updateTask(updatedTask.id, { fakeid: fixedFakeid });
    }
  }

  const htmlDownloader = new Downloader([updatedTask.article_url], { maxRetries: 1 });
  try {
    await htmlDownloader.startDownload('html');
  } finally {
    htmlDownloader.removeAllListeners();
  }

  const htmlCache = await getHtmlCache(updatedTask.article_url);
  const commentId = htmlCache?.commentID || '';
  if (!commentId) {
    throw new Error('文章内容已抓到，但没有提取到 comment_id');
  }

  if (updatedTask.comment_id !== commentId) {
    updatedTask.comment_id = commentId;
    if (updatedTask.id) {
      await updateTask(updatedTask.id, { comment_id: commentId });
    }
  }

  const commentDownloader = new Downloader([updatedTask.article_url], { maxRetries: 1 });
  let lastError: string = '';
  commentDownloader.on('download:error', (_url: string, _attempt: number, error: any) => {
    lastError = error?.message || String(error);
  });
  try {
    await commentDownloader.startDownload('comments');
  } catch (e) {
    throw new Error(`留言抓取失败：${(e as Error).message}`);
  } finally {
    commentDownloader.removeAllListeners();
  }

  const commentStatus = commentDownloader.getStatus();
  if (commentStatus.failed.includes(updatedTask.article_url)) {
    throw new Error(`留言抓取失败：${lastError || '请检查 Credential 是否有效或稍后重试'}`);
  }

  const commentCache = await getCommentCache(updatedTask.article_url);
  if (!commentCache) {
    throw new Error('留言抓取异常：接口未返回错误但数据未写入缓存');
  }

  const responseList = Array.isArray(commentCache.data) ? commentCache.data : [commentCache.data];
  const latestComments = responseList.flatMap((response: any) => response?.elected_comment ?? []);
  const existing = updatedTask.accumulated_comments ?? [];
  const existingIds = new Set(existing.map(comment => comment.content_id));
  const mergedComments = [...existing];

  for (const comment of latestComments) {
    if (!existingIds.has(comment.content_id)) {
      mergedComments.push(comment);
      existingIds.add(comment.content_id);
    }
  }

  updatedTask.accumulated_comments = mergedComments;
  if (updatedTask.id) {
    await updateTask(updatedTask.id, { accumulated_comments: mergedComments });
  }

  return {
    task: updatedTask,
    latestComments,
    mergedComments,
  };
}
