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
                <UAvatar :src="selectedAccount.round_head_img ? IMAGE_PROXY + selectedAccount.round_head_img : '/avatar-default.png'" size="2xs" />
                <span class="truncate font-medium">{{ selectedAccount.nickname }}</span>
              </div>
              <span v-else class="text-slate-400">选择公众号...</span>
            </template>
            <template #option="{ option }">
              <div class="flex items-center gap-2 py-0.5">
                <UAvatar :src="option.round_head_img ? IMAGE_PROXY + option.round_head_img : '/avatar-default.png'" size="2xs" />
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
          <div class="flex items-center justify-between w-full">
            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              {{ formatDate(article.create_time) }}
            </span>
            <span
              v-if="articleProgressMap[article.aid]"
              class="text-[10px] text-primary-500 dark:text-primary-400 flex items-center gap-0.5 font-medium transition-all"
            >
              <UIcon name="i-heroicons-bookmark" class="size-3" />
              <span>继续阅读</span>
            </span>
          </div>
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
              @click="closeArticle"
            >
              <span class="hidden xs:inline">返回</span>
            </UButton>

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
            <UButton
              icon="i-heroicons-printer"
              color="gray"
              variant="link"
              size="xs"
              label="打印"
              class="hidden sm:inline-flex"
              :disabled="!rawHtmlContent || loadingHtml || printing"
              :loading="printing"
              @click="printArticle"
            />
            <UCheckbox
              v-model="includeComments"
              label="打印留言"
              class="hidden sm:flex"
              :disabled="!selectedArticle || loadingHtml"
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
            <iframe
              :key="`${selectedArticle?.aid}_${activeTheme}_${fontSize}`"
              ref="articleFrameRef"
              class="border-none w-full h-full"
              referrerpolicy="no-referrer"
              :srcdoc="styledHtmlContent"
              @load="onIframeLoad"
            ></iframe>
          </client-only>

          <!-- 悬浮继续阅读提示栏 -->
          <Transition name="slide-up">
            <div
              v-if="showResumeBanner"
              class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
            >
              <UIcon name="i-heroicons-bookmark" class="size-4 text-primary-500 animate-pulse" />
              <span class="text-xs text-slate-600 dark:text-slate-300">
                检测到您上次有未读完的内容
              </span>
              <button
                type="button"
                class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2"
                @click="jumpToSavedPosition"
              >
                点击跳转
              </button>
              <div class="w-px h-3 bg-slate-200 dark:bg-slate-800 mx-1" />
              <button
                type="button"
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center"
                @click="showResumeBanner = false"
              >
                <UIcon name="i-heroicons-x-mark" class="size-4" />
              </button>
            </div>
          </Transition>
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
import toastFactory from '~/composables/toast';
import usePreferences from '~/composables/usePreferences';
import { IMAGE_PROXY } from '~/config';
import { type ArticleAsset, getArticleCache } from '~/store/v2/article';
import { getHtmlCache } from '~/store/v2/html';
import { getAllInfo, type MpAccount } from '~/store/v2/info';
import type { Preferences } from '~/types/preferences';
import { printIframe } from '~/utils/print';

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
const articleFrameRef = ref<HTMLIFrameElement | null>(null);
const articleCgiData = shallowRef<any | null>(null);
const printing = ref(false);

const toast = toastFactory();
const showResumeBanner = ref(false);
const savedScrollPosition = ref<number | null>(null);
const articleProgressMap = ref<Record<string, boolean>>({});

function jumpToSavedPosition() {
  const iframe = articleFrameRef.value;
  if (!iframe || savedScrollPosition.value === null) return;
  const win = iframe.contentWindow;
  if (!win) return;

  const scrollPos = savedScrollPosition.value;
  win.scrollTo(0, scrollPos);
  requestAnimationFrame(() => {
    if (win) win.scrollTo(0, scrollPos);
  });
  setTimeout(() => {
    if (win) win.scrollTo(0, scrollPos);
  }, 50);

  toast.success('已恢复至上次阅读位置');
  showResumeBanner.value = false;
}

// 更新 localStorage 中的阅读进度映射
function updateProgressMap() {
  const map: Record<string, boolean> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('reader_scroll_')) {
      const aid = key.replace('reader_scroll_', '');
      map[aid] = true;
    }
  }
  articleProgressMap.value = map;
}

// 监听 iframe 加载事件，恢复阅读位置并绑定滚动事件
function onIframeLoad() {
  const iframe = articleFrameRef.value;
  if (!iframe || !selectedArticle.value) return;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) return;

  // 检查是否存在上次未读完的进度，显示跳转提示栏
  const key = `reader_scroll_${selectedArticle.value.aid}`;
  const savedScroll = localStorage.getItem(key);
  if (savedScroll) {
    const scrollPos = parseFloat(savedScroll);
    if (!isNaN(scrollPos) && scrollPos > 5) {
      savedScrollPosition.value = scrollPos;
      showResumeBanner.value = true;
    } else {
      showResumeBanner.value = false;
      savedScrollPosition.value = null;
    }
  } else {
    showResumeBanner.value = false;
    savedScrollPosition.value = null;
  }

  // 注册滚动监听并进行防抖缓存
  let scrollTimeout: any = null;
  const handleScroll = () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!selectedArticle.value || !win || !doc) return;

      // 移动端兼容性取值：优先使用 Math.max 确保在各类浏览器及微信下都能获取真实滚动距离
      const currentScroll = Math.max(
        win.scrollY || 0,
        win.pageYOffset || 0,
        doc.documentElement.scrollTop || 0,
        doc.body.scrollTop || 0
      );

      const clientHeight = win.innerHeight || doc.documentElement.clientHeight || doc.body.clientHeight || 0;
      const scrollHeight = Math.max(doc.documentElement.scrollHeight || 0, doc.body.scrollHeight || 0);

      // 如果提示栏显示中，且用户自己往下滚动了超过 100px，则自动淡出提示栏以防遮挡
      if (showResumeBanner.value && currentScroll > 100) {
        showResumeBanner.value = false;
      }

      const key = `reader_scroll_${selectedArticle.value.aid}`;

      // 仅当可滚动高度差合理（大于 150px）时，才计算是否接近底部并清除进度；
      // 否则在某些移动端浏览器下（如 iframe 被拉展导致 clientHeight === scrollHeight）会产生误判而误删进度。
      const isNearBottom = scrollHeight - clientHeight > 150 && scrollHeight - clientHeight - currentScroll < 80;

      if (isNearBottom) {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          articleProgressMap.value[selectedArticle.value.aid] = false;
        }
      } else if (currentScroll > 15) {
        localStorage.setItem(key, currentScroll.toString());
        articleProgressMap.value[selectedArticle.value.aid] = true;
      } else {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          articleProgressMap.value[selectedArticle.value.aid] = false;
        }
      }
    }, 150);
  };

  // 同时监听 iframe 的 window 与 document 上的滚动，以防在某些手机端排版引擎下无法捕获
  win.addEventListener('scroll', handleScroll, { passive: true });
  doc.addEventListener('scroll', handleScroll, { passive: true });
}

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;
const includeComments = ref(Boolean(preferences.value?.exportConfig?.exportHtmlIncludeComments));
let renderToken = 0;

const themes = [
  { id: 'light', name: '清爽纸白', bg: '#ffffff', text: '#2d3748', border: '#e2e8f0', frameBg: '#f7fafc' },
  { id: 'sepia', name: '复古麦香', bg: '#faf4e8', text: '#3c3022', border: '#e5d9c5', frameBg: '#f3e8d3' },
  { id: 'green', name: '柔和护眼', bg: '#e8f5e9', text: '#1b3f20', border: '#c8e6c9', frameBg: '#daebd8' },
  { id: 'dark', name: '沉静暗黑', bg: '#121212', text: '#9ca3af', border: '#2d2d2d', frameBg: '#0d0d0d' },
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
  const isDark = themeObj.id === 'dark';
  const darkOverrides = isDark
    ? `
    html, body, 
    html body .__page_content__, 
    html body .__page_content__ *,
    html body .rich_media_content, 
    html body .rich_media_content *,
    html body #js_content, 
    html body #js_content * {
      color: ${themeObj.text} !important;
      background-color: transparent !important;
      --weui-FG-0: ${themeObj.text} !important;
      --weui-FG-1: ${themeObj.text} !important;
      --weui-FG-2: ${themeObj.text} !important;
      --weui-FG-3: ${themeObj.text} !important;
      --weui-FG-HALF: ${themeObj.text} !important;
      --weui-BG-0: ${themeObj.bg} !important;
      --weui-BG-1: ${themeObj.bg} !important;
      --weui-BG-2: ${themeObj.bg} !important;
      --weui-BG-3: ${themeObj.bg} !important;
      --weui-BG-4: ${themeObj.bg} !important;
      --weui-BG-5: ${themeObj.bg} !important;
    }
    /* 极致保险：针对文章内部可能存在的直接行内元素强力拦截 */
    span, p, section, font {
      color: ${themeObj.text} !important;
    }
    strong, h1, h2, h3, h4, h5, h6 {
      color: #e2e8f0 !important;
    }
    html a, body a, html a *, body a * {
      color: #60a5fa !important;
    }
    .comment_title,
    .comment_author,
    .comment_content {
      color: ${themeObj.text} !important;
    }
    .comment_badge,
    .comment_time,
    .comment_area .sns_opr_btn {
      color: #9ca3af !important;
    }
  `
    : '';

  // 渲染排版 CSS overrides
  const themeStyles = `
    html, body {
      background-color: ${themeObj.bg} !important;
      color: ${themeObj.text} !important;
      transition: background-color 0.25s ease, color 0.25s ease;
    }
    body {
      font-size: ${fontSize.value}px !important;
      line-height: 1.85 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif !important;
      padding: 50px 30px !important;
      max-width: 680px !important;
      margin: 0 auto !important;
      word-wrap: break-word !important;
    }
    @media (max-width: 640px) {
      body {
        padding: 24px 16px !important;
      }
    }
    @media print {
      html, body {
        background-color: #ffffff !important;
        color: #111827 !important;
        transition: none !important;
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
      .__page_content__ section img {
        border-radius: 0 !important;
        margin: 0.6em auto !important;
      }
    }
    #js_content {
      visibility: visible !important;
    }
    #js_content p {
      margin-top: 0 !important;
      margin-bottom: 1.5em !important;
      text-align: justify !important;
      text-justify: inter-word !important;
      letter-spacing: 0.03em !important;
    }
    /* 极致保险：微信有些图或者宽表格宽度溢出，强力拦截并适配 */
    .rich_media_content {
      overflow-x: hidden !important;
    }
    /* 仅对文章正文中的插图进行精美排版和投影，避免影响留言栏和表情等头像样式 */
    .__page_content__ section img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
      margin: 1.6em auto !important;
      display: block !important;
    }
    /* 文章头部/小字/引言 */
    .rich_media_meta_list, .profile_container {
      display: none !important; /* 隐藏微信原生头部 profile 卡片以防干扰排版 */
    }
    a {
      color: #3b82f6 !important;
      text-decoration: underline !important;
    }
    strong {
      color: ${isDark ? '#e2e8f0' : '#111827'} !important;
      font-weight: 700 !important;
    }
    /* 标题排版设计 */
    h1, h2, h3, h4, h5, h6 {
      font-weight: 700 !important;
      line-height: 1.4 !important;
      margin-top: 1.8em !important;
      margin-bottom: 0.8em !important;
      color: ${isDark ? '#e2e8f0' : '#111827'} !important;
    }
    h1 { font-size: 1.5em !important; }
    h2 { 
      font-size: 1.35em !important; 
      border-bottom: 2px solid ${themeObj.border} !important; 
      padding-bottom: 0.4em !important; 
    }
    h3 { font-size: 1.2em !important; }
    
    /* 响应式表格设计 */
    table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      margin: 1.6em 0 !important;
      overflow-x: auto !important;
      display: block !important;
    }
    th, td {
      border: 1px solid ${themeObj.border} !important;
      padding: 8px 12px !important;
      font-size: 0.9em !important;
    }
    
    /* 优雅的代码块样式 */
    pre, code {
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace !important;
      font-size: 0.85em !important;
      background-color: ${isDark ? '#262626' : '#f5f5f5'} !important;
      border-radius: 6px !important;
    }
    pre {
      padding: 12px 16px !important;
      overflow-x: auto !important;
      margin: 1.6em 0 !important;
      line-height: 1.5 !important;
    }
    code {
      padding: 2px 6px !important;
      margin: 0 4px !important;
    }
    pre code {
      padding: 0 !important;
      margin: 0 !important;
      background-color: transparent !important;
    }
    
    /* 留言跟随正文排版体系，避免和阅读器形成两套视觉语言 */
    .comment_area {
      max-width: none !important;
      margin: 3em 0 0 !important;
      padding: 1.5em 0 0 !important;
      border-top: 0 !important;
      color: ${themeObj.text} !important;
      background: transparent !important;
    }
    .comment_title {
      margin: 0 0 1em !important;
      color: ${themeObj.text} !important;
      font-size: 1em !important;
      font-weight: 700 !important;
      line-height: 1.5 !important;
      letter-spacing: 0 !important;
    }
    .comment_list {
      margin-top: 0 !important;
    }
    .comment_item {
      display: block !important;
      margin-top: 0 !important;
      padding: 1.15em 0 !important;
      border-bottom: 0 !important;
      background: transparent !important;
    }
    .comment_item > div:first-child {
      display: flex !important;
      gap: 0.75em !important;
      align-items: flex-start !important;
    }
    .comment_item > div:first-child > div {
      min-width: 0 !important;
      flex: 1 !important;
    }
    .comment_item > div:first-child > img {
      width: 2em !important;
      height: 2em !important;
      border-radius: 50% !important;
      flex-shrink: 0 !important;
      margin: 0.15em 0 0 !important;
      box-shadow: none !important;
    }
    .comment_header {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 0.25em 0.5em !important;
      align-items: baseline !important;
      margin: 0 0 0.25em !important;
      line-height: 1.45 !important;
      letter-spacing: 0 !important;
    }
    .comment_author {
      font-weight: 600 !important;
      font-size: 0.92em !important;
      color: ${themeObj.text} !important;
    }
    .comment_badge,
    .comment_time,
    .comment_area .sns_opr_btn {
      color: ${isDark ? '#9ca3af' : '#6b7280'} !important;
      font-size: 0.78em !important;
      line-height: 1.45 !important;
    }
    .comment_content {
      font-size: 1em !important;
      line-height: 1.85 !important;
      color: ${themeObj.text} !important;
      margin: 0.2em 0 0 !important;
      text-align: justify !important;
      text-justify: inter-word !important;
      letter-spacing: 0.03em !important;
      white-space: pre-line !important;
    }
    .comment_replies {
      margin: 0.75em 0 0 !important;
      padding-left: 2.75em !important;
    }
    .comment_reply {
      display: flex !important;
      gap: 0.65em !important;
      margin-top: 0.75em !important;
      padding: 0 !important;
      background: transparent !important;
      border-left: 0 !important;
      border-radius: 0 !important;
      font-size: 0.92em !important;
    }
    .comment_reply > div {
      min-width: 0 !important;
      flex: 1 !important;
    }
    .comment_reply > img {
      width: 1.6em !important;
      height: 1.6em !important;
      border-radius: 50% !important;
      flex-shrink: 0 !important;
      margin: 0.15em 0 0 !important;
      box-shadow: none !important;
    }
    .comment_content img,
    .comment_area p > img {
      max-width: 100% !important;
      height: auto !important;
      margin: 1.2em auto 0 !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
      display: block !important;
    }
    .comment_area p {
      margin: 0 !important;
    }
    .comment_area span {
      background: transparent !important;
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
    @media print {
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
        display: table !important;
        overflow: visible !important;
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
      .rich_media_content {
        overflow: visible !important;
      }
      .__page_content__ section img {
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0.6em auto !important;
      }
    }
    ${darkOverrides}
  `;

  const metaColorScheme = `<meta name="color-scheme" content="${isDark ? 'dark' : 'light'}">`;
  if (cleanHtml.includes('</head>')) {
    return cleanHtml.replace('</head>', `${metaColorScheme}<style>${themeStyles}</style></head>`);
  } else {
    return `${metaColorScheme}<style>${themeStyles}</style>${cleanHtml}`;
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

async function printArticle() {
  if (!rawHtmlContent.value || printing.value) return;

  printing.value = true;
  try {
    await printIframe(articleFrameRef.value);
  } finally {
    printing.value = false;
  }
}

async function renderCurrentArticleHtml() {
  if (!articleCgiData.value) return;

  const token = ++renderToken;
  loadingHtml.value = true;
  try {
    const normalizedHtml = await renderHTMLFromCgiDataNew(articleCgiData.value, includeComments.value);
    if (token === renderToken) {
      rawHtmlContent.value = normalizedHtml;
    }
  } finally {
    if (token === renderToken) {
      loadingHtml.value = false;
    }
  }
}

// 获取并排布文章正文 HTML
async function selectArticle(article: ArticleAsset) {
  selectedArticle.value = article;
  loadingHtml.value = true;
  rawHtmlContent.value = '';
  articleCgiData.value = null;
  showResumeBanner.value = false;
  savedScrollPosition.value = null;

  if (article) {
    localStorage.setItem('reader_last_article', article.aid);
  }

  try {
    const htmlAsset = await getHtmlCache(article.link);
    if (htmlAsset) {
      const rawHtml = await htmlAsset.file.text();
      const cgiData = await parseCgiDataNew(rawHtml);

      articleCgiData.value = cgiData;
      await renderCurrentArticleHtml();
    }
  } catch (err) {
    console.error('[Reader] Failed to load cached html:', err);
  } finally {
    loadingHtml.value = false;
  }
}

function closeArticle() {
  selectedArticle.value = null;
  localStorage.removeItem('reader_last_article');
}

watch(includeComments, () => {
  if (selectedArticle.value && articleCgiData.value) {
    renderCurrentArticleHtml().catch(err => {
      console.error('[Reader] Failed to rerender article html:', err);
    });
  }
});

// 监听选中的公众号
watch(selectedAccount, async newAccount => {
  selectedArticle.value = null;
  rawHtmlContent.value = '';
  articleCgiData.value = null;
  searchQuery.value = '';
  articles.value = [];

  if (newAccount) {
    // 记忆上次选中的公众号
    localStorage.setItem('reader_last_account', newAccount.fakeid);

    loadingArticles.value = true;
    try {
      // 传入 0 以获取该账号所有的缓存文章列表
      const list = await getArticleCache(newAccount.fakeid, 0);
      articles.value = list.sort((a, b) => b.create_time - a.create_time);

      // 自动恢复上次选中的文章
      const lastArticleAid = localStorage.getItem('reader_last_article');
      if (lastArticleAid) {
        const foundArticle = articles.value.find(item => item.aid === lastArticleAid);
        if (foundArticle) {
          // 自动加载该文章
          await selectArticle(foundArticle);
        }
      }
    } catch (err) {
      console.error('[Reader] Failed to fetch article cache:', err);
    } finally {
      loadingArticles.value = false;
    }
  } else {
    localStorage.removeItem('reader_last_account');
  }
});

onMounted(async () => {
  updateProgressMap();
  try {
    const list = await getAllInfo();
    // 排除特殊的单篇临时缓存
    accounts.value = list.filter(item => item.fakeid !== 'SINGLE_ARTICLE_FAKEID');

    if (accounts.value.length > 0) {
      // 恢复上次选中的公众号，若没有则默认选中第一个
      const lastAccountFakeid = localStorage.getItem('reader_last_account');
      const foundAccount = accounts.value.find(item => item.fakeid === lastAccountFakeid);
      if (foundAccount) {
        selectedAccount.value = foundAccount;
      } else {
        selectedAccount.value = accounts.value[0];
      }
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

/* slide-up 动画效果 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 1rem) scale(0.95);
  opacity: 0;
}
</style>
