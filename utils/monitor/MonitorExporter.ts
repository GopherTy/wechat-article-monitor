import TurndownService from 'turndown';
import { parseCgiDataNew } from '#shared/utils/html';
import { renderHTMLFromCgiDataNew } from '#shared/utils/renderer';
import { getHtmlCache } from '~/store/v2/html';
import type { Comment } from '~/types/comment';
import type { MonitorTask } from '~/store/v2/monitor';
import { renderCommentSection } from '~/utils/comment';

function getDisplayComments(task: MonitorTask): Comment[] {
  return task.status === 'done' ? task.final_comments ?? [] : task.accumulated_comments ?? [];
}

function buildEmptyCommentSection(title: string, message: string, color = '#949494') {
  return `
    <div style="max-width: 667px;margin: 0 auto;padding: 10px 10px 80px;">
      <p style="font-size: 15px;color: ${color};">${title}</p>
      <div style="margin-top: 12px;font-size: 15px;color: #949494;">${message}</div>
    </div>`;
}

function buildMessageOnlySection(message: string, color = '#949494') {
  return `
    <div style="max-width: 667px;margin: 0 auto;padding: 10px 10px 80px;">
      <div style="font-size: 15px;color: ${color};">${message}</div>
    </div>`;
}

function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  turndownService.addRule('removeBottomBar', {
    filter: (node) => {
      const cls = node.getAttribute?.('class') || '';
      return cls.includes('__bottom-bar__') || cls.includes('sns_opr_btn');
    },
    replacement: () => '',
  });

  turndownService.addRule('removeUselessImages', {
    filter: (node) => {
      if (node.nodeName !== 'IMG') return false;
      const src = node.getAttribute?.('src') || '';
      return src.startsWith('data:image/svg') || src.startsWith('data:image/png') || src.includes('wx.qlogo.cn');
    },
    replacement: () => '',
  });

  turndownService.addRule('cleanSpans', {
    filter: (node) => node.nodeName === 'SPAN' && !node.textContent?.trim(),
    replacement: () => '',
  });

  return turndownService;
}

function cleanHtmlForMarkdown(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => el.remove());
  doc.querySelector('.__bottom-bar__')?.remove();

  doc.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
  doc.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

  return doc.body.innerHTML;
}

export async function generateMonitorHtml(task: MonitorTask): Promise<string> {
  const cached = await getHtmlCache(task.article_url);
  if (!cached) {
    throw new Error('文章原文尚未缓存，无法导出');
  }

  const rawHtml = await cached.file.text();
  const cgiData = await parseCgiDataNew(rawHtml);
  if (!cgiData) {
    throw new Error('无法解析文章内容，无法导出');
  }

  const articleHtml = await renderHTMLFromCgiDataNew(cgiData, false);
  const displayComments = getDisplayComments(task);
  const shieldedComments = task.shielded_comments ?? [];

  const currentSection =
    displayComments.length > 0
      ? await renderCommentSection(task.article_url, displayComments, {
          title: task.status === 'done' ? `最终评论 ${displayComments.length}` : `留言 ${displayComments.length}`,
        })
      : buildEmptyCommentSection(task.status === 'done' ? '最终评论 0' : '留言 0', '暂无评论');

  const shieldedSection =
    shieldedComments.length > 0
      ? await renderCommentSection(task.article_url, shieldedComments, {
          title: `被盾评论 ${shieldedComments.length}`,
          titleColor: '#e11d48',
        })
      : buildMessageOnlySection('没有被盾评论', '#e11d48');

  return articleHtml.replace('</body>', `${shieldedSection}${currentSection}</body>`);
}

export async function generateMonitorMarkdown(task: MonitorTask): Promise<string> {
  const html = await generateMonitorHtml(task);
  const turndownService = createTurndownService();
  return turndownService.turndown(cleanHtmlForMarkdown(html));
}
