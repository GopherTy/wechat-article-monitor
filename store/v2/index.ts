import { getStoreAdapter } from './adapters';

// 删除公众号数据
export async function deleteAccountData(ids: string[]): Promise<void> {
  await getStoreAdapter().deleteAccountData(ids);
}
