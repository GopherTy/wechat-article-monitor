<template>
  <div class="h-screen">
    <div class="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-white/90 shadow-sm ring-1 ring-gray-200 backdrop-blur dark:bg-gray-900/90 dark:ring-gray-800">
      <UCheckbox v-model="includeComments" label="打印留言" class="px-2 py-1" :disabled="loading" />
      <UTooltip text="打印文章">
        <UButton
          icon="i-heroicons-printer"
          square
          variant="ghost"
          color="gray"
          :loading="loading || printing"
          :disabled="printing"
          @click="printArticle"
        />
      </UTooltip>
      <UTooltip text="关闭预览">
        <UButton icon="i-lucide:x" square variant="ghost" color="gray" @click="show = false" />
      </UTooltip>
    </div>
    <client-only>
      <iframe
        ref="articleFrameRef"
        class="border-none w-full h-screen"
        referrerpolicy="no-referrer"
        :srcdoc="htmlContent"
      ></iframe>
    </client-only>
  </div>
</template>

<script lang="ts" setup>
import DOMPurify from 'dompurify';
import { printIframe } from '~/utils/print';

interface Props {
  html: string;
  loading?: boolean;
}
const props = defineProps<Props>();
const show = defineModel<boolean>('show', { default: false });
const includeComments = defineModel<boolean>('includeComments', { default: false });

// 传入的完整HTML代码
const htmlContent = ref('');
const articleFrameRef = ref<HTMLIFrameElement | null>(null);
const printing = ref(false);

async function printArticle() {
  if (!htmlContent.value || printing.value) return;

  printing.value = true;
  try {
    await printIframe(articleFrameRef.value);
  } finally {
    printing.value = false;
  }
}

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
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #111827 !important;
          }
          body {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 13px !important;
            line-height: 1.55 !important;
          }
          .__page_content__ {
            max-width: none !important;
            padding: 0 !important;
            padding-bottom: 0 !important;
          }
          @page {
            size: auto;
            margin: 10mm 9mm;
          }
          * {
            color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          img, svg, video, iframe, table, pre, blockquote {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          a {
            color: #111827 !important;
            text-decoration: none !important;
          }
          .title {
            font-size: 20px !important;
            line-height: 1.3 !important;
            margin-bottom: 8px !important;
          }
          .__meta__ {
            font-size: 12px !important;
            line-height: 1.4 !important;
            margin-bottom: 14px !important;
          }
          blockquote.source {
            margin: 12px 0 16px !important;
            padding: 6px 8px !important;
            border-left-width: 3px !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
          p {
            margin-top: 0 !important;
            margin-bottom: 0.75em !important;
            letter-spacing: 0 !important;
            text-align: left !important;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 1em !important;
            margin-bottom: 0.45em !important;
            line-height: 1.3 !important;
          }
          table {
            margin: 0.8em 0 !important;
          }
          th, td {
            padding: 5px 8px !important;
          }
          pre {
            margin: 0.8em 0 !important;
            padding: 8px 10px !important;
          }
          .comment_area {
            max-width: none !important;
            margin-top: 24px !important;
            padding: 14px 0 0 !important;
          }
          .comment_item {
            margin-top: 12px !important;
            padding: 0 !important;
            gap: 8px !important;
          }
          .comment_content {
            margin-top: 2px !important;
            line-height: 1.45 !important;
          }
          .comment_reply {
            margin-top: 6px !important;
            padding: 0 !important;
          }
          .picture_content .picture_item {
            margin-bottom: 12px !important;
          }
          .picture_item_label {
            margin-bottom: 0 !important;
          }
          .__page_content__ section img {
            border-radius: 0 !important;
            margin: 0.6em auto !important;
          }
          .__bottom-bar__,
          #js_article_bottom_bar,
          #js_bar_profile,
          #js_top_profile,
          .rich_media_tool,
          .rich_media_extra,
          .rich_media_meta_list,
          .profile_container,
          .wx_follow,
          .wx_follow_context,
          .wx_follow_avatar,
          .wx_follow_nickname {
            display: none !important;
          }
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
