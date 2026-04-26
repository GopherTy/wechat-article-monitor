import type { AppMsgExWithFakeID, PublishInfo, PublishPage } from '~/types/types';
import { getStoreAdapter } from './adapters';
import { type MpAccount, updateInfoCache } from './info';

export type ArticleAsset = AppMsgExWithFakeID;

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: MpAccount, publish_page: PublishPage) {
  const adapter = getStoreAdapter();
  
  // 对于 PgAdapter，如果想判断是否新增，可能有些困难（因为批量 upsert），
  // 但我们尽力通过获取已有数据来判断，或者干脆默认 count += articles.length。
  // 注意，原来的 IndexedDB 实现是判断 key 是否在 keys 里。
  const fakeid = account.fakeid;
  const total_count = publish_page.total_count;
  const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

  // 统计本次缓存成功新增的数量
  let msgCount = 0;
  let articleCount = 0;

  const newArticles: ArticleAsset[] = [];
  const newKeys: string[] = [];

  for (const item of publish_list) {
    const publish_info: PublishInfo = JSON.parse(item.publish_info);
    let newEntryCount = 0;

    for (const article of publish_info.appmsgex) {
      newArticles.push({ ...article, fakeid, _status: '' });
      newKeys.push(`${fakeid}:${article.aid}`);
      newEntryCount++;
      articleCount++;
    }

    if (newEntryCount > 0) {
      msgCount++;
    }
  }

  if (newArticles.length > 0) {
    // 假设全部都是新的
    // TODO: 如果需要精准去重，可以先调用 getArticles 并做在内存中进行判断
    await adapter.putArticles(newArticles, newKeys);
  }

  await updateInfoCache({
    fakeid: fakeid,
    completed: publish_list.length === 0,
    count: msgCount,
    articles: articleCount,
    nickname: account.nickname,
    round_head_img: account.round_head_img,
    total_count: total_count,
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
  const articles = await getStoreAdapter().getArticles(fakeid, create_time);
  return articles.length > 0;
}

/**
 * 读取缓存中的指定时间之前的历史文章
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function getArticleCache(fakeid: string, create_time: number): Promise<AppMsgExWithFakeID[]> {
  return getStoreAdapter().getArticles(fakeid, create_time);
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  const article = await getStoreAdapter().getArticleByLink(url);
  if (!article) {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

// 根据 url 获取 SINGLE_ARTICLE_FAKEID 文章对象
export async function getSingleArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  const article = await getStoreAdapter().getArticleByLink(url);
  if (!article || article.fakeid !== 'SINGLE_ARTICLE_FAKEID') {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

/**
 * 文章被删除
 * @param url
 * @param is_deleted
 */
export async function articleDeleted(url: string, is_deleted = true): Promise<void> {
  await getStoreAdapter().articleDeleted(url, is_deleted);
}

/**
 * 更新文章状态
 * @param url
 * @param status
 */
export async function updateArticleStatus(url: string, status: string): Promise<void> {
  await getStoreAdapter().updateArticleStatus(url, status);
}

/**
 * 更新文章的fakeid
 * @param url
 * @param fakeid
 */
export async function updateArticleFakeid(url: string, fakeid: string): Promise<void> {
  await getStoreAdapter().updateArticleFakeid(url, fakeid);
}
