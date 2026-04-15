import dayjs from 'dayjs';
import type { Comment } from '~/types/comment';
import type { MonitorTask } from '~/store/v2/monitor';

function formatComment(comment: Comment): string {
  const likes = comment.like_num > 0 ? ` (👍 ${comment.like_num})` : '';
  let text = `- **${comment.nick_name}**${likes}：${comment.content}`;

  if (comment.reply_new?.reply_list?.length > 0) {
    for (const reply of comment.reply_new.reply_list) {
      text += `\n  - **${reply.nick_name}** 回复：${reply.content}`;
    }
  }
  return text;
}

function formatShieldedComment(comment: Comment): string {
  const likes = comment.like_num > 0 ? `${comment.like_num}` : '0';
  const content = comment.content.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const nick = comment.nick_name.replace(/\|/g, '\\|');
  return `| ${nick} | ${content} | ${likes} |`;
}

export function generateMonitorMarkdown(task: MonitorTask): string {
  const lines: string[] = [];

  lines.push(`# ${task.article_title}`);
  lines.push('');

  const publishTime = dayjs(task.created_at).format('YYYY-MM-DD HH:mm');
  const statParts = [`来源：${task.nickname}`, `发布时间：${publishTime}`];
  if (task.stats.read_num != null) statParts.push(`阅读：${task.stats.read_num}`);
  if (task.stats.like_num != null) statParts.push(`点赞：${task.stats.like_num}`);
  lines.push(`> ${statParts.join(' | ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 评论区');
  lines.push('');

  const shielded = task.shielded_comments ?? [];
  if (shielded.length > 0) {
    lines.push(`### ⚠️ 被盾评论（共 ${shielded.length} 条）`);
    lines.push('');
    lines.push('| 昵称 | 评论内容 | 点赞数 |');
    lines.push('|------|---------|--------|');
    for (const c of shielded) {
      lines.push(formatShieldedComment(c));
    }
    lines.push('');
  } else {
    lines.push('*未检测到被盾评论*');
    lines.push('');
  }

  const finalComments = task.final_comments ?? [];
  lines.push(`### 精选评论（共 ${finalComments.length} 条）`);
  lines.push('');
  if (finalComments.length > 0) {
    for (const c of finalComments) {
      lines.push(formatComment(c));
    }
  } else {
    lines.push('*暂无评论*');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(
    `*监控时间：${dayjs(task.created_at).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(task.tracking_end_at).format('HH:mm')}*`,
  );
  lines.push(
    `*累积捕获评论：${(task.accumulated_comments ?? []).length} 条，最终评论：${finalComments.length} 条，被盾：${shielded.length} 条*`,
  );
  lines.push('');

  return lines.join('\n');
}
