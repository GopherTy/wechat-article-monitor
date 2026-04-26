/**
 * 存储适配器工厂
 * 根据运行时配置选择 IndexedDB 或 PostgreSQL 适配器
 */
import type { StoreAdapter } from '~/store/v2/adapter';
import { IndexedDBAdapter } from './indexeddb-adapter';
import { PgAdapter } from './pg-adapter';

let _adapter: StoreAdapter | null = null;

/**
 * 获取当前存储适配器（单例）
 */
export function getStoreAdapter(): StoreAdapter {
  if (_adapter) return _adapter;

  const mode = getStorageMode();
  _adapter = mode === 'postgres' ? new PgAdapter() : new IndexedDBAdapter();
  console.info(`[StoreAdapter] 使用 ${mode} 模式`);
  return _adapter;
}

/**
 * 重置适配器（切换模式后调用）
 */
export function resetStoreAdapter(): void {
  _adapter = null;
}

/**
 * 获取当前存储模式
 */
export function getStorageMode(): 'indexeddb' | 'postgres' {
  // 优先读取 localStorage（用户可在迁移后自动切换）
  if (typeof window !== 'undefined') {
    const localMode = localStorage.getItem('storage_mode');
    if (localMode === 'postgres' || localMode === 'indexeddb') {
      return localMode;
    }
  }

  // 其次读取 runtimeConfig
  try {
    const config = useRuntimeConfig();
    const configMode = config.public.storageMode as string;
    if (configMode === 'postgres') return 'postgres';
  } catch {
    // 在非 Nuxt 上下文中可能报错，忽略
  }

  return 'indexeddb';
}

/**
 * 设置存储模式（持久化到 localStorage）
 */
export function setStorageMode(mode: 'indexeddb' | 'postgres'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('storage_mode', mode);
  }
  resetStoreAdapter();
}

export { IndexedDBAdapter } from './indexeddb-adapter';
export { PgAdapter } from './pg-adapter';
