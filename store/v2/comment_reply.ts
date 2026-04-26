import { getStoreAdapter } from './adapters';

export interface CommentReplyAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
  contentID: string;
}

/**
 * 更新 comment 缓存
 * @param reply 缓存
 */
export async function updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
  await getStoreAdapter().putCommentReply(reply);
  return true;
}

/**
 * 获取 comment 缓存
 * @param url
 * @param contentID
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
  return getStoreAdapter().getCommentReply(url, contentID);
}
