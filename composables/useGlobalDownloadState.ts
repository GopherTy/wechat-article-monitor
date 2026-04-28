import { ref } from 'vue';
import type { Downloader } from '~/utils/download/Downloader';
import type { DownloadArticleOptions } from './useDownloader';

// 全局单例状态，确保页面切换时不丢失任务状态
export const globalDownloadState = {
  loading: ref(false),
  completedCount: ref(0),
  totalCount: ref(0),
  activeType: ref<'html' | 'metadata' | 'comment' | 'fakeid' | null>(null),
  activeDownloader: null as Downloader | null,
  // 当前页面的临时回调
  currentOptions: null as Partial<DownloadArticleOptions> | null,
};
