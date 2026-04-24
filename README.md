# wechat-article-monitor

> 微信公众号 **文章监控 + 评论监控** 个人定制版。
>
> 本项目基于 [wechat-article/wechat-article-exporter](https://github.com/wechat-article/wechat-article-exporter) (MIT License) 二次开发，
> 在原项目的文章批量导出能力之上，新增了一整套**长期运行的监控工作流**与配套的 credential 抓包服务。
>
> 感谢原作者 [@Jock](https://github.com/wechat-article) 的优秀工作。本仓库仅用于个人/团队场景，不接受外部 PR 与 issue。

---

## 在原项目之上新增的能力

- **账号文章发现 (Account Discovery)**：长期轮询关注的公众号，自动入库新文章
  - `composables/useAccountDiscovery.ts`、`utils/monitor/AccountDiscoveryPoller.ts`
- **文章评论监控 (Comment Monitor)**：对入库文章进行持续评论抓取与状态追踪（首次出现时间、被屏蔽时间）
  - `composables/useCommentMonitor.ts`、`utils/monitor/CommentMonitorScheduler.ts`
  - `components/dashboard/CommentPreviewPopover.vue`、`ShieldedCommentsPopover.vue`
- **统一监控调度面板**：`pages/dashboard/monitor.vue` + `composables/useMonitor.ts`
- **Credential 抓包服务**：基于 mitmproxy 的本地 Python 服务，自动捕获并下发凭据
  - `credential-service/credential.py`
  - `server/api/credential/*`、`server/plugins/credential-service.ts`
  - 前端凭据有效期提示条 `components/global/CredentialExpiryBar.vue`
- **PDF 导出**：`server/api/web/pdf/generate.post.ts`（基于 puppeteer）
- **Markdown 导出质量改进**
- **OpenSpec / Superpowers 工作流**：`openspec/`、`docs/superpowers/`、`.cursor/`

详细的设计文档见 `openspec/specs/` 与 `docs/superpowers/specs/`。

## 快速开始

```bash
corepack enable && corepack prepare yarn@1.22.22 --activate
yarn

cp .env.example .env   # 按需要填写 NUXT_AGGRID_LICENSE / CREDENTIAL_MITM_PORT 等
yarn dev
```

Credential 抓包服务依赖 Python + mitmproxy，详见 `credential-service/requirements.txt`。

## 致谢与许可

- 原项目：[wechat-article/wechat-article-exporter](https://github.com/wechat-article/wechat-article-exporter) — MIT
- 原项目原理思路：[1061700625/WeChat_Article](https://github.com/1061700625/WeChat_Article)
- 本仓库沿用 [MIT License](./LICENSE)；版权声明同时保留原作者与本仓库维护者。

## 声明

通过本程序获取的公众号文章与评论内容，版权归原作者所有，请合理合规使用。
