import { getStoreAdapter } from './adapters';

export interface ResourceAsset {
  fakeid: string;
  url: string;
  file: Blob;
}

/**
 * 更新 resource 缓存
 * @param resource 缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
  await getStoreAdapter().putResource(resource);
  return true;
}

/**
 * 获取 resource 缓存
 * @param url
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
  return getStoreAdapter().getResource(url);
}
