<script setup lang="ts">
import { useMigration, type MigrationDirection } from '~/composables/useMigration';

const {
  migrating,
  direction,
  tableProgress,
  currentTable,
  error,
  completed,
  overallProgress,
  currentMode,
  startMigration,
  getIdbStats,
  setStorageMode,
} = useMigration();

const isOpen = defineModel<boolean>('open', { default: false });
const idbStats = ref<Record<string, number>>({});
const pgAvailable = ref<boolean | null>(null);
const loadingStats = ref(false);

// 打开面板时加载统计数据
watch(isOpen, async val => {
  if (val) {
    loadingStats.value = true;
    try {
      idbStats.value = await getIdbStats();
      // 检测 PG 是否可用
      try {
        await $fetch('/api/db/init', { method: 'POST' });
        pgAvailable.value = true;
      } catch {
        pgAvailable.value = false;
      }
    } finally {
      loadingStats.value = false;
    }
  }
});

const totalIdbRecords = computed(() =>
  Object.values(idbStats.value).reduce((sum, count) => sum + count, 0)
);

function handleMigrate(dir: MigrationDirection) {
  startMigration(dir);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'done':
      return 'text-green-500';
    case 'running':
      return 'text-blue-500';
    case 'error':
      return 'text-red-500';
    case 'skipped':
      return 'text-gray-400';
    default:
      return 'text-gray-500';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'done':
      return 'i-heroicons-check-circle';
    case 'running':
      return 'i-heroicons-arrow-path';
    case 'error':
      return 'i-heroicons-x-circle';
    case 'skipped':
      return 'i-heroicons-minus-circle';
    default:
      return 'i-heroicons-clock';
  }
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-2xl' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">数据迁移</h3>
          <UBadge :color="currentMode === 'postgres' ? 'green' : 'blue'" variant="subtle">
            当前模式: {{ currentMode === 'postgres' ? 'PostgreSQL' : 'IndexedDB' }}
          </UBadge>
        </div>
      </template>

      <!-- 加载中 -->
      <div v-if="loadingStats" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mr-2" />
        加载中...
      </div>

      <!-- 主内容 -->
      <div v-else class="space-y-6">
        <!-- PG 不可用警告 -->
        <UAlert
          v-if="pgAvailable === false"
          icon="i-heroicons-exclamation-triangle"
          color="orange"
          title="PostgreSQL 不可用"
          description="未配置 DATABASE_URL 环境变量或数据库连接失败。请先在 .env 中配置数据库连接。"
        />

        <!-- IndexedDB 统计 -->
        <div>
          <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            IndexedDB 数据统计
          </h4>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="(count, table) in idbStats"
              :key="table"
              class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center"
            >
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ table }}</div>
              <div class="text-lg font-semibold mt-1">{{ count.toLocaleString() }}</div>
            </div>
          </div>
          <div class="text-right text-sm text-gray-500 dark:text-gray-400 mt-2">
            共 {{ totalIdbRecords.toLocaleString() }} 条记录
          </div>
        </div>

        <!-- 迁移按钮 -->
        <div v-if="!migrating && !completed" class="flex gap-3">
          <UButton
            :disabled="pgAvailable !== true || totalIdbRecords === 0"
            color="primary"
            size="lg"
            block
            @click="handleMigrate('idb-to-pg')"
          >
            <UIcon name="i-heroicons-arrow-right" class="mr-1" />
            IndexedDB → PostgreSQL
          </UButton>
          <UButton
            :disabled="pgAvailable !== true"
            color="gray"
            size="lg"
            block
            @click="handleMigrate('pg-to-idb')"
          >
            <UIcon name="i-heroicons-arrow-left" class="mr-1" />
            PostgreSQL → IndexedDB
          </UButton>
        </div>

        <!-- 迁移进度 -->
        <div v-if="migrating || completed" class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ direction === 'idb-to-pg' ? 'IndexedDB → PostgreSQL' : 'PostgreSQL → IndexedDB' }}
            </span>
            <span class="text-sm text-gray-500">{{ overallProgress }}%</span>
          </div>

          <UProgress :value="overallProgress" :color="error ? 'red' : completed ? 'green' : 'primary'" />

          <div class="space-y-2 max-h-72 overflow-y-auto">
            <div
              v-for="tp in tableProgress"
              :key="tp.table"
              class="flex items-center justify-between py-1.5 px-3 rounded-lg"
              :class="tp.table === currentTable ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="getStatusIcon(tp.status)"
                  :class="[getStatusColor(tp.status), tp.status === 'running' ? 'animate-spin' : '']"
                />
                <span class="text-sm">{{ tp.label }}</span>
              </div>
              <div class="text-xs text-gray-500">
                <template v-if="tp.status === 'running' || tp.status === 'done'">
                  {{ tp.current }} / {{ tp.total }}
                </template>
                <template v-else-if="tp.status === 'error'">
                  <span class="text-red-500">{{ tp.error }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 错误信息 -->
        <UAlert
          v-if="error"
          icon="i-heroicons-x-circle"
          color="red"
          title="迁移出错"
          :description="error"
        />

        <!-- 完成信息 -->
        <UAlert
          v-if="completed"
          icon="i-heroicons-check-circle"
          color="green"
          title="迁移完成"
          :description="`已成功${direction === 'idb-to-pg' ? '迁移至 PostgreSQL，存储模式已自动切换' : '迁移至 IndexedDB，存储模式已自动切换'}。刷新页面后生效。`"
        />

        <!-- 手动切换模式 -->
        <div class="border-t dark:border-gray-700 pt-4">
          <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">手动切换存储模式</h4>
          <div class="flex gap-2">
            <UButton
              :color="currentMode === 'indexeddb' ? 'primary' : 'gray'"
              size="sm"
              variant="soft"
              @click="setStorageMode('indexeddb')"
            >
              IndexedDB
            </UButton>
            <UButton
              :color="currentMode === 'postgres' ? 'primary' : 'gray'"
              size="sm"
              variant="soft"
              :disabled="pgAvailable !== true"
              @click="setStorageMode('postgres')"
            >
              PostgreSQL
            </UButton>
          </div>
          <p class="text-xs text-gray-400 mt-1">切换后需刷新页面</p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="gray" @click="isOpen = false" :disabled="migrating">
            关闭
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
