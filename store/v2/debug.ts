import { getStoreAdapter } from './adapters';

export interface DebugAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
  fakeid: string;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateDebugCache(html: DebugAsset): Promise<boolean> {
  await getStoreAdapter().putDebug(html);
  return true;
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getDebugCache(url: string): Promise<DebugAsset | undefined> {
  return getStoreAdapter().getDebug(url);
}

export async function getDebugInfo(): Promise<DebugAsset[]> {
  return getStoreAdapter().getAllDebug();
}
