<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">设置</h1>
    </Teleport>

    <div class="h-full overflow-scroll">
      <SettingProxy />
      <div class="flex flex-wrap">
        <SettingExport />
        <SettingMisc />
      </div>

      <!-- 数据存储与迁移 -->
      <div class="mx-6 mt-6">
        <h2 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3">数据存储</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">存储模式</p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                当前使用
                <UBadge :color="storageMode === 'postgres' ? 'green' : 'blue'" variant="subtle" size="xs">
                  {{ storageMode === 'postgres' ? 'PostgreSQL' : 'IndexedDB' }}
                </UBadge>
                存储数据
              </p>
            </div>
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-circle-stack"
              @click="migrationPanelOpen = true"
            >
              数据迁移
            </UButton>
          </div>
        </div>
      </div>

      <MigrationPanel v-model:open="migrationPanelOpen" />

      <div class="h-[30vh]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { websiteName } from '~/config';
import { getStorageMode } from '~/store/v2/adapters';

useHead({
  title: `设置 | ${websiteName}`,
});

const migrationPanelOpen = ref(false);
const storageMode = computed(() => getStorageMode());
</script>

