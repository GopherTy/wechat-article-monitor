<script setup lang="ts">
import { CREDENTIAL_LIVE_MINUTES } from '~/config';

interface Props {
  timestamp: number;
}

const props = defineProps<Props>();

const ttl = CREDENTIAL_LIVE_MINUTES * 60 * 1000;
const now = ref(Date.now());

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

const elapsed = computed(() => Math.max(0, now.value - props.timestamp));
const remaining = computed(() => Math.max(0, ttl - elapsed.value));
const ratio = computed(() => (ttl > 0 ? remaining.value / ttl : 0));

const progressValue = computed(() => Math.min(100, Math.round((elapsed.value / ttl) * 100)));

const colorClass = computed<'green' | 'amber' | 'rose' | 'gray'>(() => {
  if (ratio.value <= 0) return 'gray';
  if (ratio.value <= 0.2) return 'rose';
  if (ratio.value <= 0.5) return 'amber';
  return 'green';
});

const remainingText = computed(() => {
  if (ratio.value <= 0) return '已过期';
  const totalSec = Math.floor(remaining.value / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `剩余 ${min} 分 ${String(sec).padStart(2, '0')} 秒`;
});

const textColor = computed(() => {
  switch (colorClass.value) {
    case 'gray':
      return 'text-gray-400';
    case 'rose':
      return 'text-rose-500';
    case 'amber':
      return 'text-amber-500';
    default:
      return 'text-green-600';
  }
});
</script>

<template>
  <div class="flex items-center gap-2 w-full">
    <UProgress :value="progressValue" :color="colorClass" :max="100" size="xs" class="flex-1" />
    <span class="text-xs font-mono shrink-0" :class="textColor">{{ remainingText }}</span>
  </div>
</template>
