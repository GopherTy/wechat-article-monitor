<template>
  <div class="h-screen">
    <UButton
      icon="i-lucide:x"
      square
      variant="link"
      color="gray"
      class="absolute right-3 top-3"
      @click="show = false"
    ></UButton>
    <client-only>
      <iframe class="border-none w-full h-screen" referrerpolicy="no-referrer" :srcdoc="htmlContent"></iframe>
    </client-only>
  </div>
</template>

<script lang="ts" setup>
import DOMPurify from 'dompurify';

interface Props {
  html: string;
}
const props = defineProps<Props>();
const show = defineModel<boolean>('show', { default: false });

// 传入的完整HTML代码
const htmlContent = ref('');

watch(
  () => props.html,
  (newHtml: string) => {
    // 使用DOMPurify来清理HTML内容，防止XSS攻击。添加 meta 与 referrerpolicy 支持以保证图片防盗链生效。
    const cleaned = DOMPurify.sanitize(newHtml, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['meta'],
      ADD_ATTR: ['name', 'content', 'referrerpolicy'],
    });

    // 强行注入白底黑字的基础样式，防止在系统黑暗模式下发生背景穿透导致预览看不清字
    const baseStyle = `
      <style>
        body {
          background-color: #ffffff !important;
          color: #333333 !important;
        }
      </style>
    `;

    if (cleaned.includes('</head>')) {
      htmlContent.value = cleaned.replace('</head>', `${baseStyle}</head>`);
    } else {
      htmlContent.value = `${baseStyle}${cleaned}`;
    }
  },
  { immediate: true }
);
</script>
