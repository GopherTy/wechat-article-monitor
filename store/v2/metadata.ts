import type { ArticleMetadata } from '~/utils/download/types';
import { getStoreAdapter } from './adapters';

export type Metadata = ArticleMetadata & {
  fakeid: string;
  url: string;
  title: string;
};

/**
 * 更新 metadata
 * @param metadata
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
  await getStoreAdapter().putMetadata(metadata);
  return true;
}

/**
 * 获取 metadata
 * @param url
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  return getStoreAdapter().getMetadata(url);
}
