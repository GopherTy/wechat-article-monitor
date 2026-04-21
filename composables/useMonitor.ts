/**
 * 文章监控 facade。
 *
 * 自 v5 起，"公众号文章发现"与"文章评论监控"被拆分为两个独立 capability：
 * - {@link useAccountDiscovery}
 * - {@link useCommentMonitor}
 *
 * 本 facade 仅用于 `pages/dashboard/monitor.vue` 顶部状态条聚合两侧状态，**不再**承担调度器生命周期管理。
 * 如需操作公众号或评论任务，请直接使用上述两个 composable。
 */
import useAccountDiscovery, { autoStartAccountDiscoveryIfNeeded } from '~/composables/useAccountDiscovery';
import useCommentMonitor, { autoStartCommentMonitorIfNeeded } from '~/composables/useCommentMonitor';

export default function useMonitor() {
  const discovery = useAccountDiscovery();
  const commentMonitor = useCommentMonitor();

  // 首次进入页面时按需自启
  autoStartAccountDiscoveryIfNeeded();
  autoStartCommentMonitorIfNeeded();

  const monitoring = computed(() => discovery.discovering.value || commentMonitor.monitoring.value);

  return {
    discovery,
    commentMonitor,
    credentials: discovery.credentials,
    monitoring,
  };
}
