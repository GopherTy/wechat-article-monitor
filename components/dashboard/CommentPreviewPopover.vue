<script setup lang="ts">
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface Props {
  comments: Comment[];
}

const props = defineProps<Props>();

const sorted = computed(() => [...(props.comments ?? [])].sort((a, b) => (b.create_time ?? 0) - (a.create_time ?? 0)));

function relTime(createTime: number) {
  if (!createTime) return '';
  return dayjs(createTime * 1000).fromNow();
}
</script>

<template>
  <div
    class="min-w-[320px] max-w-[480px] max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900 text-sm"
  >
    <div v-if="sorted.length === 0" class="px-3 py-4 text-center text-slate-400">暂无评论</div>
    <div
      v-for="c in sorted"
      :key="c.content_id || c.id"
      class="px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <img
            v-if="c.logo_url"
            :src="c.logo_url"
            alt=""
            class="size-4 rounded-full object-cover shrink-0"
            referrerpolicy="no-referrer"
          />
          <span class="font-medium text-slate-700 dark:text-slate-200 truncate">
            {{ c.nick_name || '匿名' }}
          </span>
        </div>
        <span class="text-[11px] text-slate-400 shrink-0">{{ relTime(c.create_time) }}</span>
      </div>
      <p class="text-slate-600 dark:text-slate-300 mt-1 leading-snug whitespace-pre-wrap break-words">
        {{ c.content }}
      </p>
      <div v-if="(c.like_num ?? 0) > 0" class="mt-1 text-[11px] text-rose-500">
        ♡ {{ c.like_num }}
      </div>
    </div>
  </div>
</template>
