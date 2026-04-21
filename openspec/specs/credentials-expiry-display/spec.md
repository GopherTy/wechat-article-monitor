# credentials-expiry-display Specification

## Purpose
TBD - created by archiving change polish-monitor-credentials-ui. Update Purpose after archive.
## Requirements
### Requirement: Credential 卡片到期进度可视化

`CredentialsDialog` 中每张 credential 卡片 SHALL 在底部展示一根进度条与剩余时间文案；进度条进度 MUST 等于 `(now - credential.timestamp) / (CREDENTIAL_LIVE_MINUTES * 60 * 1000)`，已过期时进度固定为 100%。

#### Scenario: 新鲜 credential 显示绿色满进度
- **WHEN** credential 的 `now - timestamp < CREDENTIAL_LIVE_MINUTES * 60 * 1000 * 0.5`
- **THEN** 进度条颜色为绿色，文案显示 `剩余 X 分 Y 秒`

#### Scenario: 中等剩余显示黄色
- **WHEN** credential 剩余比例在 (0.2, 0.5] 区间
- **THEN** 进度条颜色为黄色

#### Scenario: 即将过期显示红色
- **WHEN** credential 剩余比例在 (0, 0.2] 区间
- **THEN** 进度条颜色为红色

#### Scenario: 已过期显示灰色
- **WHEN** `now >= credential.timestamp + CREDENTIAL_LIVE_MINUTES * 60 * 1000`
- **THEN** 进度条颜色为灰色，文案显示 `已过期`，已存在的"有效/已过期"badge 保持不变

### Requirement: 倒计时实时刷新

进度条与剩余时间文案 SHALL 至少每 1 秒自更新一次，无需依赖外部组件刷新或弹窗重开；定时器 MUST 在组件 unmount 时清理。

#### Scenario: 弹窗打开期间持续刷新
- **WHEN** 用户打开 CredentialsDialog 持续 30 秒
- **THEN** 至少 30 次刷新进度条/文案，剩余秒数随时间递减

#### Scenario: 弹窗关闭后停止
- **WHEN** 用户关闭 CredentialsDialog
- **THEN** 内部 setInterval 被清理，无后台 tick

#### Scenario: 跨过期边界自动切换状态
- **WHEN** credential 在弹窗打开期间从有效变为过期
- **THEN** 进度条颜色切换为灰色，文案变为 `已过期`，无需用户交互

### Requirement: 与现有 valid badge 协同

进度条展示 MUST 与卡片现有的"有效 / 已过期" badge 同源（均基于实时计算的 `now < timestamp + ttl`），不得出现 badge 显示"有效"但进度条显示"已过期"的不一致。

#### Scenario: 有效状态一致
- **WHEN** credential 实时 valid 为 true
- **THEN** badge 显示"有效" 且进度条剩余时间文案非"已过期"

#### Scenario: 过期状态一致
- **WHEN** credential 实时 valid 为 false
- **THEN** badge 显示"已过期" 且进度条文案显示"已过期"

