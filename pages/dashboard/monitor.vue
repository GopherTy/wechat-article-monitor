<script setup lang="ts">
import { getAccountList } from '~/apis';
import type { AccountInfo } from '~/types/types';
import useMonitor from '~/composables/useMonitor';
import type { MonitorTask } from '~/store/v2/monitor';
import dayjs from 'dayjs';

const {
  watches,
  tasks,
  monitoring,
  addWatchAccount,
  removeWatchAccount,
  toggleWatch,
  startMonitoring,
  stopMonitoring,
  retryTask,
  removeTask,
  downloadTaskMarkdown,
  refreshTasks,
} = useMonitor();

const searchKeyword = ref('');
const searchResults = ref<AccountInfo[]>([]);
const searching = ref(false);
const showSearch = ref(false);

async function searchAccount() {
  if (!searchKeyword.value.trim()) return;
  searching.value = true;
  try {
    const [list] = await getAccountList(0, searchKeyword.value);
    searchResults.value = list;
  } catch (e) {
    console.error(e);
  } finally {
    searching.value = false;
  }
}

async function onAddAccount(account: AccountInfo) {
  await addWatchAccount({
    fakeid: account.fakeid,
    nickname: account.nickname,
    round_head_img: account.round_head_img,
  });
  showSearch.value = false;
  searchKeyword.value = '';
  searchResults.value = [];
}

function getStatusLabel(status: MonitorTask['status']) {
  const map: Record<string, { label: string; color: string }> = {
    tracking: { label: '追踪中', color: 'sky' },
    final_collecting: { label: '最终采集中', color: 'orange' },
    exporting: { label: '导出中', color: 'violet' },
    done: { label: '已完成', color: 'green' },
    error: { label: '异常', color: 'rose' },
  };
  return map[status] ?? { label: status, color: 'gray' };
}

function getTrackingProgress(task: MonitorTask) {
  const elapsed = Math.min(Date.now() - task.created_at, task.tracking_end_at - task.created_at);
  const total = task.tracking_end_at - task.created_at;
  return Math.round((elapsed / total) * 100);
}

function getTrackingTimeText(task: MonitorTask) {
  const elapsedMin = Math.round((Date.now() - task.created_at) / 60000);
  const totalMin = Math.round((task.tracking_end_at - task.created_at) / 60000);
  return `${Math.min(elapsedMin, totalMin)}/${totalMin} 分钟`;
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  refreshInterval = setInterval(() => {
    if (monitoring.value) refreshTasks();
  }, 10000);
});
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<template>
  <div class="p-6 overflow-y-auto h-full">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- 标题 & 总控 -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">文章监控</h1>
        <UButton :color="monitoring ? 'rose' : 'primary'" @click="monitoring ? stopMonitoring() : startMonitoring()">
          {{ monitoring ? '停止监控' : '开始监控' }}
        </UButton>
      </div>

      <!-- 监控列表 -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">监控列表（{{ watches.length }}/5）</h2>
          <UButton size="sm" variant="outline" @click="showSearch = true">
            <UIcon name="i-lucide:plus" class="mr-1" />
            添加公众号
          </UButton>
        </div>

        <div v-if="watches.length === 0" class="text-center py-8 text-gray-500">
          暂未添加监控公众号，点击上方按钮添加
        </div>

        <div v-else class="grid gap-3">
          <div
            v-for="w in watches"
            :key="w.fakeid"
            class="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <img :src="w.round_head_img" class="w-10 h-10 rounded-full" />
            <div class="flex-1">
              <p class="font-medium">{{ w.nickname }}</p>
              <p v-if="w.last_check_time" class="text-xs text-gray-500">
                上次检查：{{ dayjs(w.last_check_time).format('HH:mm:ss') }}
              </p>
            </div>
            <UToggle :model-value="w.enabled" @update:model-value="toggleWatch(w.fakeid, $event)" />
            <UButton size="xs" color="rose" variant="ghost" @click="removeWatchAccount(w.fakeid)">
              <UIcon name="i-lucide:trash-2" />
            </UButton>
          </div>
        </div>
      </section>

      <!-- 搜索添加弹窗 -->
      <UModal v-model="showSearch">
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">添加监控公众号</h3>
          <div class="flex gap-2">
            <UInput
              v-model="searchKeyword"
              placeholder="搜索公众号名称"
              class="flex-1"
              @keyup.enter="searchAccount"
            />
            <UButton :loading="searching" @click="searchAccount">搜索</UButton>
          </div>
          <div v-if="searchResults.length" class="space-y-2 max-h-80 overflow-y-auto">
            <div
              v-for="account in searchResults"
              :key="account.fakeid"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="onAddAccount(account)"
            >
              <img :src="account.round_head_img" class="w-8 h-8 rounded-full" />
              <div>
                <p class="font-medium text-sm">{{ account.nickname }}</p>
                <p class="text-xs text-gray-500">{{ account.signature }}</p>
              </div>
            </div>
          </div>
        </div>
      </UModal>

      <!-- 任务列表 -->
      <section>
        <h2 class="text-lg font-semibold mb-4">监控任务</h2>

        <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500">
          暂无监控任务，开始监控后检测到新文章会自动创建
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="p-4 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ task.article_title }}</p>
                <p class="text-sm text-gray-500">
                  {{ task.nickname }} · {{ dayjs(task.created_at).format('MM-DD HH:mm') }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <UBadge :color="getStatusLabel(task.status).color" variant="subtle">
                  {{ getStatusLabel(task.status).label }}
                </UBadge>
                <UButton size="xs" color="rose" variant="ghost" @click="removeTask(task.id!)">
                  <UIcon name="i-lucide:trash-2" />
                </UButton>
              </div>
            </div>

            <!-- 追踪中：进度 -->
            <div v-if="task.status === 'tracking'" class="mt-3">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>已追踪 {{ getTrackingTimeText(task) }}</span>
                <span>累积 {{ (task.accumulated_comments ?? []).length }} 条评论</span>
              </div>
              <UProgress :value="getTrackingProgress(task)" size="sm" />
            </div>

            <!-- 已完成：结果 -->
            <div v-if="task.status === 'done'" class="mt-3 flex items-center justify-between">
              <div class="text-sm">
                <span v-if="(task.shielded_comments ?? []).length > 0" class="text-rose-500 font-medium">
                  被盾 {{ task.shielded_comments.length }} 条
                </span>
                <span v-else class="text-green-500">未检测到被盾评论</span>
                <span class="text-gray-500 ml-2">/ 总计 {{ (task.final_comments ?? []).length }} 条评论</span>
              </div>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" @click="downloadTaskMarkdown(task)">
                  <UIcon name="i-lucide:download" class="mr-1" />
                  Markdown
                </UButton>
              </div>
            </div>

            <!-- 异常：错误信息 -->
            <div v-if="task.status === 'error'" class="mt-3 flex items-center justify-between">
              <p class="text-sm text-rose-500">{{ task.error_msg }}</p>
              <UButton size="xs" variant="outline" @click="retryTask(task.id!)">重试</UButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
