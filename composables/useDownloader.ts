import { formatElapsedTime } from '#shared/utils/helpers';
import toastFactory from '~/composables/toast';
import { globalDownloadState } from '~/composables/useGlobalDownloadState';
import type { Metadata } from '~/store/v2/metadata';
import { Downloader } from '~/utils/download/Downloader';
import type { DownloaderStatus } from '~/utils/download/types';

export interface DownloadArticleOptions {
  // 文章内容下载成功回调
  onContent: (url: string) => void;

  // 文章状态异常回调(不含「已删除」)
  onStatusChange: (url: string, status: string) => void;

  // 文章被删除回调
  onDelete: (url: string) => void;

  // 文章阅读量抓取成功回调
  onMetadata: (url: string, metadata: Metadata) => void;

  // 文章留言抓取成功回调
  onComment: (url: string) => void;

  // 修复单篇文章下载的 fakeid 专用
  onFakeID: (url: string, fakeid: string) => void;
}

export default (options: Partial<DownloadArticleOptions> = {}) => {
  const toast = toastFactory();

  // 挂载时，如果当前有正在进行的相同类型的任务，将回调注入全局
  onMounted(() => {
    globalDownloadState.currentOptions = options;
  });

  // 卸载时，清除当前页面的回调，但保留任务运行
  onUnmounted(() => {
    if (globalDownloadState.currentOptions === options) {
      globalDownloadState.currentOptions = null;
    }
  });

  // 抓取文章内容(html)
  async function downloadArticleHTML(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      globalDownloadState.loading.value = true;
      globalDownloadState.activeType.value = 'html';
      cleanupDownloader();

      const downloader = new Downloader(urls);
      globalDownloadState.activeDownloader = downloader;

      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        globalDownloadState.completedCount.value = status.completed.length;
        // 执行当前页面的回调
        if (success && typeof globalDownloadState.currentOptions?.onContent === 'function') {
          globalDownloadState.currentOptions.onContent(url);
        }
      });
      downloader.on('download:deleted', (url: string) => {
        if (typeof globalDownloadState.currentOptions?.onDelete === 'function') {
          globalDownloadState.currentOptions.onDelete(url);
        }
      });
      downloader.on('download:exception', (url: string, msg: string) => {
        if (typeof globalDownloadState.currentOptions?.onStatusChange === 'function') {
          globalDownloadState.currentOptions.onStatusChange(url, msg);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【文章内容】...');
        globalDownloadState.completedCount.value = 0;
        globalDownloadState.totalCount.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【文章内容】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
        );
      });
      downloader.on('download:stop', () => {
        toast.info('HTML下载任务已停止');
      });

      await downloader.startDownload('html');
    } catch (error) {
      console.error('【文章内容】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      globalDownloadState.loading.value = false;
      globalDownloadState.activeType.value = null;
      cleanupDownloader();
    }
  }

  // 抓取文章阅读量、点赞量等元数据
  async function downloadArticleMetadata(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      globalDownloadState.loading.value = true;
      globalDownloadState.activeType.value = 'metadata';
      cleanupDownloader();

      const downloader = new Downloader(urls);
      globalDownloadState.activeDownloader = downloader;

      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        globalDownloadState.completedCount.value = status.completed.length;
      });
      downloader.on('download:metadata', (url: string, metadata: Metadata) => {
        if (typeof globalDownloadState.currentOptions?.onMetadata === 'function') {
          globalDownloadState.currentOptions.onMetadata(url, metadata);
        }
      });
      downloader.on('download:deleted', (url: string) => {
        if (typeof globalDownloadState.currentOptions?.onDelete === 'function') {
          globalDownloadState.currentOptions.onDelete(url);
        }
      });
      downloader.on('download:exception', (url: string, msg: string) => {
        if (typeof globalDownloadState.currentOptions?.onStatusChange === 'function') {
          globalDownloadState.currentOptions.onStatusChange(url, msg);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【阅读量】...');
        globalDownloadState.completedCount.value = 0;
        globalDownloadState.totalCount.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【阅读量】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
        );
      });

      await downloader.startDownload('metadata');
    } catch (error) {
      console.error('【阅读量】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      globalDownloadState.loading.value = false;
      globalDownloadState.activeType.value = null;
      cleanupDownloader();
    }
  }

  // 抓取文章留言数据
  async function downloadArticleComment(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      globalDownloadState.loading.value = true;
      globalDownloadState.activeType.value = 'comment';
      cleanupDownloader();

      const downloader = new Downloader(urls);
      globalDownloadState.activeDownloader = downloader;

      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        globalDownloadState.completedCount.value = status.completed.length;
        if (success && typeof globalDownloadState.currentOptions?.onComment === 'function') {
          globalDownloadState.currentOptions.onComment(url);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【留言内容】...');
        globalDownloadState.completedCount.value = 0;
        globalDownloadState.totalCount.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【留言内容】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`
        );
      });

      await downloader.startDownload('comments');
    } catch (error) {
      console.error('【留言内容】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      globalDownloadState.loading.value = false;
      globalDownloadState.activeType.value = null;
      cleanupDownloader();
    }
  }

  // 修复单篇文章fakeid
  async function fixSingleFakeidTask(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      globalDownloadState.loading.value = true;
      globalDownloadState.activeType.value = 'fakeid';
      cleanupDownloader();

      const downloader = new Downloader(urls);
      globalDownloadState.activeDownloader = downloader;

      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        globalDownloadState.completedCount.value = status.completed.length;
      });
      downloader.on('download:begin', () => {
        console.debug('开始修复 fakeid ...');
        globalDownloadState.completedCount.value = 0;
        globalDownloadState.totalCount.value = urls.length;
      });
      downloader.on('fix:fakeid', (url: string, fakeid: string) => {
        console.debug(`${url} 修复成功 fakeid: ${fakeid}`);
        if (typeof globalDownloadState.currentOptions?.onFakeID === 'function') {
          globalDownloadState.currentOptions.onFakeID(url, fakeid);
        }
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【fakeid】修复完成',
          `本次耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`
        );
      });

      await downloader.startDownload('fakeid');
    } catch (error) {
      console.error('【fakeid】修复失败:', error);
      alert((error as Error).message);
    } finally {
      globalDownloadState.loading.value = false;
      globalDownloadState.activeType.value = null;
      cleanupDownloader();
    }
  }

  async function download(type: 'html' | 'metadata' | 'comment' | 'fakeid', urls: string[]) {
    if (type === 'html') {
      await downloadArticleHTML(urls);
    } else if (type === 'metadata') {
      await downloadArticleMetadata(urls);
    } else if (type === 'comment') {
      await downloadArticleComment(urls);
    } else if (type === 'fakeid') {
      await fixSingleFakeidTask(urls);
    }
  }

  function cleanupDownloader() {
    if (globalDownloadState.activeDownloader) {
      globalDownloadState.activeDownloader.removeAllListeners();
      globalDownloadState.activeDownloader = null;
    }
  }

  function stop() {
    if (globalDownloadState.activeDownloader) {
      globalDownloadState.activeDownloader.stop();
    }
  }

  return {
    loading: globalDownloadState.loading,
    completed_count: globalDownloadState.completedCount,
    total_count: globalDownloadState.totalCount,
    activeType: globalDownloadState.activeType,
    download,
    stop,
  };
};
