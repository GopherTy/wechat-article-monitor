<template>
  <div class="flex h-[calc(100vh-60px)] overflow-hidden bg-slate-50 dark:bg-slate-900">
    <!-- 左侧书架与检索列 -->
    <div
      class="w-full md:w-[320px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col flex-shrink-0 transition-all duration-300"
      :class="[selectedArticle ? 'hidden md:flex' : 'flex']"
    >
      <!-- 公众号选择区 -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800">
        <UFormGroup label="选择公众号" size="sm">
          <USelectMenu
            v-model="selectedAccount"
            :options="accounts"
            placeholder="请选择公众号..."
            class="w-full"
          >
            <template #label>
              <div v-if="selectedAccount" class="flex items-center gap-2">
                <UAvatar :src="selectedAccount.round_head_img || '/avatar-default.png'" size="2xs" />
                <span class="truncate font-medium">{{ selectedAccount.nickname }}</span>
              </div>
              <span v-else class="text-slate-400">选择公众号...</span>
            </template>
            <template #option="{ option }">
              <div class="flex items-center gap-2 py-0.5">
                <UAvatar :src="option.round_head_img || '/avatar-default.png'" size="2xs" />
                <span class="truncate font-medium text-xs">{{ option.nickname }}</span>
              </div>
            </template>
          </USelectMenu>
        </UFormGroup>
      </div>

      <!-- 文章搜索区 -->
      <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="搜索已下载文章标题..."
          size="sm"
          color="gray"
          variant="outline"
          clearable
          class="w-full"
        />
      </div>

      <!-- 已经下载文章列表 -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar scrollbar-thin">
        <div v-if="loadingArticles" class="space-y-3 p-2">
          <div v-for="i in 8" :key="i" class="space-y-2 border border-slate-100 dark:border-slate-900 p-2.5 rounded-lg">
            <USkeleton class="h-4 w-4/5" />
            <USkeleton class="h-3 w-1/3" />
          </div>
        </div>
        
        <div v-else-if="filteredArticles.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs">
          <UIcon name="i-heroicons-inbox" class="size-10 mb-2 opacity-40" />
          <p>{{ selectedAccount ? '暂无匹配文章' : '请先选择公众号' }}</p>
        </div>

        <button
          v-else
          v-for="article in filteredArticles"
          :key="article.aid"
          type="button"
          class="w-full text-left p-3 rounded-lg transition-all duration-200 group flex flex-col gap-1.5 border border-transparent"
          :class="[
            selectedArticle?.aid === article.aid
              ? 'bg-primary-50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-800/80 text-primary-900 dark:text-primary-100 shadow-sm'
              : 'hover:bg-slate-50 dark:hover:bg-slate-900/80 text-slate-700 dark:text-slate-300'
          ]"
          @click="selectArticle(article)"
        >
          <span class="text-xs font-semibold line-clamp-2 leading-relaxed" :class="selectedArticle?.aid === article.aid ? 'text-primary-700 dark:text-primary-400' : 'group-hover:text-primary-600 dark:group-hover:text-primary-400'">
            {{ article.title }}
          </span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {{ formatDate(article.create_time) }}
          </span>
        </button>
      </div>
    </div>

    <!-- 右侧沉浸式阅读器主体 -->
    <div
      class="flex-1 bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden transition-all duration-300"
      :class="[selectedArticle ? 'flex' : 'hidden md:flex']"
    >
      <!-- 缺省状态：未选中文章 -->
      <div v-if="!selectedArticle" class="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50">
        <div class="max-w-md text-center p-8 rounded-2xl bg-white/60 dark:bg-slate-950/60 backdrop-blur border border-slate-200/50 dark:border-slate-800/50 shadow-lg flex flex-col items-center gap-4">
          <div class="size-16 rounded-full bg-gradient-to-tr from-amber-400 to-primary-500 text-white flex items-center justify-center shadow-md animate-pulse">
            <UIcon name="i-lucide:book-open" class="size-8" />
          </div>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">公众号沉浸式阅读器</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            请在左侧书架中选择您已下载的文章。您可以通过顶部的设置项，调节舒适的主题、背景与字号，享受安静、沉浸式的离线阅读环境。
          </p>
        </div>
      </div>

      <!-- 阅读器内容渲染状态 -->
      <template v-else>
        <!-- 顶部操作栏 -->
        <div class="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <!-- 返回/上一篇/下一篇/原文链接 -->
          <div class="flex items-center gap-2">
            <!-- 手机端返回列表按钮 -->
            <UButton
              icon="i-heroicons-arrow-left"
              color="gray"
              variant="ghost"
              size="sm"
              class="md:hidden mr-1"
              label="返回"
              @click="selectedArticle = null"
            />

            <UButtonGroup size="xs" variant="ghost">
              <UButton
                icon="i-heroicons-chevron-left"
                color="gray"
                :disabled="isFirstArticle"
                @click="navigateArticle(-1)"
              />
              <UButton
                icon="i-heroicons-chevron-right"
                color="gray"
                :disabled="isLastArticle"
                @click="navigateArticle(1)"
              />
            </UButtonGroup>
            <UButton
              icon="i-heroicons-arrow-top-right-on-square"
              color="gray"
              variant="link"
              size="xs"
              label="网页原文"
              class="hidden sm:inline-flex"
              @click="openOriginalLink"
            />
          </div>

          <!-- 缩放与主题 -->
          <div class="flex items-center gap-5">
            <!-- 字号调节 -->
            <div class="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-900">
              <UButton
                icon="i-heroicons-minus"
                variant="ghost"
                color="gray"
                size="2xs"
                :disabled="fontSize <= 12"
                @click="fontSize = Math.max(12, fontSize - 1)"
              />
              <span class="text-xs font-mono px-2 text-slate-600 dark:text-slate-400 select-none">{{ fontSize }}px</span>
              <UButton
                icon="i-heroicons-plus"
                variant="ghost"
                color="gray"
                size="2xs"
                :disabled="fontSize >= 28"
                @click="fontSize = Math.min(28, fontSize + 1)"
              />
            </div>

            <!-- 主题色盘 -->
            <div class="flex items-center gap-1.5">
              <UTooltip v-for="t in themes" :key="t.id" :text="t.name" size="xs">
                <button
                  type="button"
                  class="size-6 rounded-full border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center"
                  :style="{ backgroundColor: t.bg }"
                  :class="[
                    activeTheme === t.id
                      ? 'border-primary-500 scale-105 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800'
                  ]"
                  @click="activeTheme = t.id"
                >
                  <UIcon
                    v-if="activeTheme === t.id"
                    name="i-heroicons-check"
                    class="size-3.5"
                    :style="{ color: t.text }"
                  />
                </button>
              </UTooltip>
            </div>
          </div>
        </div>

        <!-- 渲染视口 -->
        <div class="flex-1 relative overflow-hidden transition-colors duration-300" :style="{ backgroundColor: currentThemeObj.frameBg }">
          <!-- 正文解析 loading -->
          <div v-if="loadingHtml" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 dark:bg-slate-950/60 backdrop-blur z-20">
            <UIcon name="i-heroicons-arrow-path" class="size-8 text-primary-500 animate-spin" />
            <span class="text-xs text-slate-500 dark:text-slate-400">正在精心排版并加载正文...</span>
          </div>

          <!-- 未拉取正文提示 -->
          <div v-else-if="!rawHtmlContent" class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 z-20">
            <div class="size-16 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500 flex items-center justify-center border border-rose-200 dark:border-rose-900/50">
              <UIcon name="i-heroicons-exclamation-triangle" class="size-8" />
            </div>
            <div class="max-w-sm text-center space-y-1.5">
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100">未拉取该文章正文</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                本系统当前仅保存了该文章的标题及元数据，您需要回到 **「文章下载」** 页面，重新触发对此公众号的内容同步下载。完成后即可离线在此阅读。
              </p>
            </div>
          </div>

          <!-- 完美沙盒隔离渲染 -->
          <client-only v-else>
            <iframe class="border-none w-full h-full" referrerpolicy="no-referrer" :srcdoc="styledHtmlContent"></iframe>
          </client-only>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import DOMPurify from 'dompurify';
import { parseCgiDataNew } from '#shared/utils/html';
import { renderHTMLFromCgiDataNew } from '#shared/utils/renderer';
import usePreferences from '~/composables/usePreferences';
import { type ArticleAsset, getArticleCache } from '~/store/v2/article';
import { getHtmlCache } from '~/store/v2/html';
import { getAllInfo, type MpAccount } from '~/store/v2/info';
import type { Preferences } from '~/types/preferences';

const accounts = ref<MpAccount[]>([]);
const selectedAccount = ref<MpAccount | null>(null);
const articles = ref<ArticleAsset[]>([]);
const selectedArticle = ref<ArticleAsset | null>(null);

const searchQuery = ref('');
const loadingArticles = ref(false);
const loadingHtml = ref(false);

const rawHtmlContent = ref('');
const fontSize = ref(16);
const activeTheme = ref('sepia');

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const themes = [
  { id: 'light', name: '清爽纸白', bg: '#ffffff', text: '#2d3748', border: '#e2e8f0', frameBg: '#f7fafc' },
  { id: 'sepia', name: '复古麦香', bg: '#faf4e8', text: '#3c3022', border: '#e5d9c5', frameBg: '#f3e8d3' },
  { id: 'green', name: '柔和护眼', bg: '#e8f5e9', text: '#1b3f20', border: '#c8e6c9', frameBg: '#daebd8' },
  { id: 'dark', name: '沉静暗黑', bg: '#161616', text: '#d1d5db', border: '#2d2d2d', frameBg: '#0f0f0f' },
];

const currentThemeObj = computed(() => {
  return themes.find(t => t.id === activeTheme.value) || themes[1];
});

// 计算属性：对 HTML 内容注入样式
const styledHtmlContent = computed(() => {
  if (!rawHtmlContent.value) return '';
  if (!process.client) return '';

  // 使用 DOMPurify 清洗安全 HTML，允许 meta 标签和 referrerpolicy 属性以保持图片防盗链配置
  const cleanHtml = DOMPurify.sanitize(rawHtmlContent.value, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['meta'],
    ADD_ATTR: ['name', 'content', 'referrerpolicy'],
  });
  const themeObj = currentThemeObj.value;

  // 渲染排版 CSS overrides
  const themeStyles = `
    body {
      background-color: ${themeObj.bg} !important;
      color: ${themeObj.text} !important;
      font-size: ${fontSize.value}px !important;
      line-height: 1.85 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif !important;
      padding: 50px 30px !important;
      max-width: 680px !important;
      margin: 0 auto !important;
      transition: background-color 0.25s ease, color 0.25s ease, font-size 0.15s ease;
    }
    #js_content {
      visibility: visible !important;
    }
    p {
      margin-bottom: 1.6em !important;
      text-align: justify !important;
    }
    /* 仅对文章正文中的插图进行精美排版和投影，避免影响留言栏的头像样式 */
    .__page_content__ section img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
      margin: 1.8em auto !important;
      display: block !important;
    }
    a {
      color: #3b82f6 !important;
      text-decoration: underline !important;
    }
    /* 评论渲染样式增强 */
    .comment_area {
      margin-top: 40px !important;
      border-top: 1px solid ${themeObj.border} !important;
      padding-top: 20px !important;
    }
    .comment_item {
      padding: 12px 0 !important;
      border-bottom: 1px dashed ${themeObj.border} !important;
    }
    .comment_author {
      font-weight: bold !important;
      font-size: 0.9em !important;
    }
    .comment_content {
      font-size: 0.95em !important;
      margin-top: 4px !important;
    }
    /* 滚动条 */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(120, 120, 120, 0.2);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(120, 120, 120, 0.4);
    }
  `;

  if (cleanHtml.includes('</head>')) {
    return cleanHtml.replace('</head>', `<style>${themeStyles}</style></head>`);
  } else {
    return `<style>${themeStyles}</style>${cleanHtml}`;
  }
});

// 计算属性：搜索过滤后的文章列表
const filteredArticles = computed(() => {
  if (!selectedAccount.value) return [];

  let list = articles.value;

  // 过滤 SINGLE_ARTICLE_FAKEID 纯测试/单篇残留
  list = list.filter(item => item.fakeid !== 'SINGLE_ARTICLE_FAKEID');

  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(item => item.title.toLowerCase().includes(query));
  }

  return list;
});

// 计算属性：当前文章索引导航
const currentArticleIndex = computed(() => {
  if (!selectedArticle.value) return -1;
  return filteredArticles.value.findIndex(item => item.aid === selectedArticle.value?.aid);
});

const isFirstArticle = computed(() => {
  return currentArticleIndex.value <= 0;
});

const isLastArticle = computed(() => {
  const index = currentArticleIndex.value;
  return index === -1 || index >= filteredArticles.value.length - 1;
});

// 格式化发布日期
function formatDate(timestamp: number) {
  if (!timestamp) return '--';
  return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm');
}

// 导航到上一篇/下一篇
function navigateArticle(direction: number) {
  const nextIndex = currentArticleIndex.value + direction;
  if (nextIndex >= 0 && nextIndex < filteredArticles.value.length) {
    selectArticle(filteredArticles.value[nextIndex]);
  }
}

// 打开外部网页原文
function openOriginalLink() {
  if (selectedArticle.value?.link) {
    window.open(selectedArticle.value.link, '_blank');
  }
}

// 获取并排布文章正文 HTML
async function selectArticle(article: ArticleAsset) {
  selectedArticle.value = article;
  loadingHtml.value = true;
  rawHtmlContent.value = '';

  try {
    const htmlAsset = await getHtmlCache(article.link);
    if (htmlAsset) {
      const rawHtml = await htmlAsset.file.text();
      const cgiData = await parseCgiDataNew(rawHtml);

      const includeComments = Boolean(preferences.value?.exportConfig?.exportHtmlIncludeComments);
      const normalizedHtml = await renderHTMLFromCgiDataNew(cgiData, includeComments);

      rawHtmlContent.value = normalizedHtml;
    }
  } catch (err) {
    console.error('[Reader] Failed to load cached html:', err);
  } finally {
    loadingHtml.value = false;
  }
}

// 监听选中的公众号
watch(selectedAccount, async newAccount => {
  selectedArticle.value = null;
  rawHtmlContent.value = '';
  searchQuery.value = '';
  articles.value = [];

  if (newAccount) {
    loadingArticles.value = true;
    try {
      // 传入 0 以获取该账号所有的缓存文章列表
      const list = await getArticleCache(newAccount.fakeid, 0);
      articles.value = list.sort((a, b) => b.create_time - a.create_time);
    } catch (err) {
      console.error('[Reader] Failed to fetch article cache:', err);
    } finally {
      loadingArticles.value = false;
    }
  }
});

onMounted(async () => {
  try {
    const list = await getAllInfo();
    // 排除特殊的单篇临时缓存
    accounts.value = list.filter(item => item.fakeid !== 'SINGLE_ARTICLE_FAKEID');

    if (accounts.value.length > 0) {
      selectedAccount.value = accounts.value[0];
    }
  } catch (err) {
    console.error('[Reader] Failed to initialize reader:', err);
  }
});
</script>

<style scoped>
/* 自定义列表滚动条，极简设计 */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.15);
  border-radius: 2px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.3);
}
</style>
