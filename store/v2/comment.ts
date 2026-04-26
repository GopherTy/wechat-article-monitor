import { getStoreAdapter } from './adapters';

export interface CommentAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
}

/**
 * 更新 comment 缓存
 * @param comment 缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
  await getStoreAdapter().putComment(comment);
  return true;
}

/**
 * 获取 comment 缓存
 * @param url
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  return getStoreAdapter().getComment(url);
}
