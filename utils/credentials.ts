import { CREDENTIAL_LIVE_MINUTES } from '~/config';
import type { ParsedCredential } from '~/types/credential';

const STORAGE_KEY = 'auto-detect-credentials:credentials';

/**
 * 实时读取 credentials，并按 CREDENTIAL_LIVE_MINUTES 重新计算 valid 字段。
 *
 * 用于下载/校验场景：避免依赖跨模块的 useLocalStorage 响应式同步
 * （多个模块各自创建 ref，CredentialsDialog 写入后无法保证其它模块即时拿到新值），
 * 也避免使用持久化时落盘的 valid 已过期但未刷新。
 */
export function getCurrentCredentials(): ParsedCredential[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let parsed: ParsedCredential[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const now = Date.now();
  const ttl = 1000 * 60 * CREDENTIAL_LIVE_MINUTES;
  return parsed.map(item => ({
    ...item,
    valid: now < item.timestamp + ttl,
  }));
}

/**
 * 查找指定公众号当前有效的 credential。
 */
export function findValidCredential(fakeid: string): ParsedCredential | undefined {
  return getCurrentCredentials().find(item => item.biz === fakeid && item.valid);
}
