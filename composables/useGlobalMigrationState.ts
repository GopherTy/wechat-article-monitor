import { ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { getStorageMode } from '~/store/v2/adapters';
import type { MigrationDirection, TableProgress } from './useMigration';

// 全局数据迁移状态
export const globalMigrationState = {
  migrating: ref(false),
  direction: ref<MigrationDirection>('idb-to-pg'),
  tableProgress: ref<TableProgress[]>([]),
  currentTable: ref(''),
  error: ref<string | null>(null),
  completed: ref(false),
  isStopping: ref(false),
  // 将存储模式也放到全局，确保 UI 反馈一致
  storageMode: useLocalStorage<'indexeddb' | 'postgres'>('storage_mode', getStorageMode()),
};
