<script setup lang="ts">
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface Props {
  comments: Comment[];
  firstSeenAt?: Record<string, number>;
  shieldedAt?: Record<string, number>;
}

const props = defineProps<Props>();

interface Row {
  comment: Comment;
  firstAt: number;
  shieldAt: number;
  surviveMs: number;
}

const rows = computed<Row[]>(() => {
  const list = props.comments ?? [];
  const firstMap = props.firstSeenAt ?? {};
  const shieldMap = props.shieldedAt ?? {};
  return list
    .map(c => {
      const firstAt = firstMap[c.content_id] ?? (c.create_time ? c.create_time * 1000 : 0);
      const shieldAt = shieldMap[c.content_id] ?? 0;
      const surviveMs = firstAt && shieldAt ? Math.max(0, shieldAt - firstAt) : 0;
      return { comment: c, firstAt, shieldAt, surviveMs };
    })
    .sort((a, b) => b.shieldAt - a.shieldAt);
});

function fmtAt(ts: number) {
  if (!ts) return '—';
  return dayjs(ts).format('MM-DD HH:mm:ss');
}

function fmtDuration(ms: number) {
  if (!ms) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remainSec = sec % 60;
  if (min < 60) return remainSec ? `${min}m${remainSec}s` : `${min}m`;
  const h = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin ? `${h}h${remainMin}m` : `${h}h`;
}
</script>

<template>
  <div
    class="min-w-[360px] max-w-[520px] max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900 text-sm"
  >
    <div v-if="rows.length === 0" class="px-3 py-4 text-center text-slate-400">无被盾评论</div>
    <div
      v-for="row in rows"
      :key="row.comment.content_id || row.comment.id"
      class="px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <img
            v-if="row.comment.logo_url"
            :src="row.comment.logo_url"
            alt=""
            class="size-4 rounded-full object-cover shrink-0"
            referrerpolicy="no-referrer"
          />
          <span class="font-medium text-slate-700 dark:text-slate-200 truncate">
            {{ row.comment.nick_name || '匿名' }}
          </span>
        </div>
        <span class="text-[11px] text-rose-500 shrink-0 font-mono">存活 {{ fmtDuration(row.surviveMs) }}</span>
      </div>
      <p class="text-slate-600 dark:text-slate-300 mt-1 leading-snug whitespace-pre-wrap break-words">
        {{ row.comment.content }}
      </p>
      <div class="mt-1 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <span>初见 {{ fmtAt(row.firstAt) }}</span>
        <span class="text-slate-300">→</span>
        <span class="text-rose-500">被盾 {{ fmtAt(row.shieldAt) }}</span>
      </div>
    </div>
  </div>
</template>
