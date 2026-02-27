# SubsTracker - 订阅管理与提醒系统

基于 Cloudflare Workers 的轻量级订阅管理系统，帮助你轻松跟踪各类订阅服务的到期时间，并通过 Telegram、Webhook 等多渠道发送及时提醒。

> 🎉 项目说明：
> - 原有稳定版本代码已保留在 **`legacy-v1`** 分支（可随时回看/回滚）
> - 从现在开始，**`main` 分支由 AI 托管持续迭代**（功能优化、体验升级、问题修复）
> - 欢迎大家直接试用 `main` 分支，遇到问题就提 Issue —— 我会让 AI 第一时间跟进修改 👻

![image](https://github.com/user-attachments/assets/22ff1592-7836-4f73-aa13-24e9d43d7064)

---

## ✨ 功能特色

### 🎯 核心功能
- **订阅管理**：添加、编辑、删除各类订阅服务
- **智能提醒**：自定义提前提醒天数，自动续订计算
- **农历显示**：支持农历日期显示，可控制开关
- **状态管理**：订阅启用/停用，过期状态自动识别
- **财务追踪**：记录订阅费用，完整的支付历史和统计分析
- **手动续订**：支持自定义金额、周期和备注
- **仪表盘**：可视化展示月度/年度支出，支出趋势和分类统计

### 📱 多渠道通知
- **Telegram**：支持 Telegram Bot 通知
- **NotifyX**：集成 NotifyX 推送服务
- **Webhook 通知**：支持自定义 Webhook 推送
- **企业微信机器人**：支持企业微信群机器人通知
- **邮件通知**：基于 Resend 的邮件服务
- **Bark**：支持 iOS Bark 推送

### 🌙 农历功能
- **农历转换**：支持 1900-2100 年农历转换
- **智能显示**：列表和编辑页面可控制农历显示
- **通知集成**：通知消息中可包含农历信息

### 🎨 用户体验
- **响应式设计**：适配桌面端和移动端
- **备注优化**：长备注自动截断，悬停显示完整内容
- **实时预览**：日期选择时实时显示对应农历
- **外观风格**：支持浅色模式、深色模式、跟随系统

### 💰 财务管理
- **订阅金额追踪**：支持多币种记录
- **汇率换算**：支持动态汇率、固定汇率
- **智能仪表盘**：
  - 📊 月度/年度支出统计，环比趋势分析
  - 💳 活跃订阅数量，月均支出计算
  - 📅 最近7天支付记录，即将续费提醒
  - 📈 按类型/分类的支出排行和占比
- **支付历史管理**：
  - 📝 完整支付记录，支持编辑/删除
  - 🕒 精确显示计费周期
  - 📊 累计支出和支付次数统计
  - 🔄 删除支付记录时自动回退订阅周期
- **高级续订功能**：
  - 💵 自定义续订金额
  - 📅 选择续订日期（支持回溯）
  - 🔢 批量续订多个周期
  - 📝 添加续订备注
  - 👁️ 实时预览新的到期日期

---

## 🧰 环境准备

### 1) 安装 Node.js / npm

如果你电脑里没有 `npm`：

- 前往官网下载安装：<https://nodejs.org/>
- 推荐安装 LTS 版本（安装后自动包含 npm）

安装后验证：

```bash
node -v
npm -v
```

### 2) 获取 Cloudflare API Token

1. 打开 Cloudflare Dashboard → **My Profile** → **API Tokens**
2. 点击 **Create Token**
3. 推荐使用自定义 Token（Custom Token）
4. 权限至少包含：
   - Workers Scripts: Edit
   - Workers KV Storage: Edit
5. Account Resources 选择你的目标账号
6. 创建后复制 Token

![image-20260227170420115](https://img.996007.icu/file/1772183075773_20260227170427274.png)

> ⚠️ Token 只显示一次，请妥善保存；泄露后请立刻删除重建。

---

## 🚀 部署方式（推荐）

```bash
npm install
# Windows PowerShell:
$env:CLOUDFLARE_API_TOKEN="你的token"
npm run deploy:safe
```

`deploy:safe` 会自动执行：
1. `npm run setup`
   - 检查是否已有 `SUBSCRIPTIONS_KV` / `SUBSCRIPTIONS_KV_PREVIEW`
   - 若存在则复用原 ID
   - 若不存在则自动创建
   - 自动回写 `wrangler.toml`
2. `npm run deploy`
   - 执行部署到 Cloudflare Workers

![image-20260227170513582](https://img.996007.icu/file/1772183123590_20260227170513797.png)

如果你是 Windows CMD：

```bat
set CLOUDFLARE_API_TOKEN=你的token
npm run deploy:safe
```

---

## 🔄 已部署版本升级（保留原数据）

可以直接升级，且会优先复用原 KV：

```bash
git pull
npm install
# Windows PowerShell:
$env:CLOUDFLARE_API_TOKEN="你的token"
npm run deploy:safe
```

如需备份（可选）：

```bash
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote config > backup-config.json
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote subscriptions > backup-subscriptions.json
```

---

## 🔐 首次部署登录说明

部署完成后，访问你的 Worker 域名：

- 默认用户名：`admin`
- 默认密码：`password`

首次登录后请立即在系统配置中修改账号密码。

---

## 🔧 通知渠道配置

### Telegram
- **Bot Token**: 从 [@BotFather](https://t.me/BotFather) 获取
- **Chat ID**: 从 [@userinfobot](https://t.me/userinfobot) 获取

### NotifyX
- **API Key**: 从 [NotifyX 官网](https://www.notifyx.cn/) 获取

### 企业微信机器人
- **推送 URL**: 参考 [官方文档](https://developer.work.weixin.qq.com/document/path/91770) 获取

### Webhook 通知
- **推送 URL**: 例如 `https://your-service.com/hooks/notify`
- 支持自定义请求方法、请求头与消息模板
- **模板占位符**：`{{title}}`、`{{content}}`、`{{tags}}`、`{{tagsLine}}`、`{{timestamp}}`、`{{formattedMessage}}`

### Bark（iOS 推送）
- **服务器地址**：默认 `https://api.day.app`，也可用自建服务器
- **设备 Key**：在 Bark App 内复制
- **历史记录**：勾选“保存推送”后可保留推送历史

### 邮件通知 (Resend)
- **API Key**: 从 [Resend 官方教程](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/) 获取
- **发件人邮箱**: 需为 Resend 已验证域名邮箱
- **收件人邮箱**: 接收通知的邮箱

### 🔔 通知时间与时区说明
- 后端调度与计算统一使用 **UTC**
- `notificationHours` 按 **UTC 小时**解释
- 留空表示全天允许发送
- 前端页面时间按“当前设备时区”显示

### 🔐 第三方 API 安全调用
- `POST /api/notify/{token}` 可触发系统通知
- 令牌也支持 `Authorization: Bearer <token>` 或 `?token=<token>`
- 未配置或令牌不匹配时接口会拒绝请求

---

## 🛠 常见问题排查

### `Authentication error [code: 10000]`
通常是本地 Wrangler 状态/缓存或 Token 权限问题。

可按顺序处理：

```bash
# PowerShell 重新设置 token
$env:CLOUDFLARE_API_TOKEN="你的token"
npm run deploy:safe
```

若仍报错，清理本地 Wrangler 缓存后重试：

- Windows: `C:\Users\<你的用户名>\AppData\Roaming\xdg.config\.wrangler\`

删除目录后，重新设置 token 再执行部署。

---

## 欢迎关注我的公众号

![39d8d5a902fa1eee6cbbbc8a0dcff4b](https://github.com/user-attachments/assets/96bae085-4299-4377-9958-9a3a11294efc)

---

## 赞助

本项目 CDN 加速及安全防护由 Tencent EdgeOne 赞助：EdgeOne 提供长期有效的免费套餐，包含不限量流量和请求，覆盖中国大陆节点，且无超额收费。

[[Best Asian CDN, Edge, and Secure Solutions - Tencent EdgeOne](https://edgeone.ai/?from=github)]

[![image](https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png)](https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png)

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出新功能建议。

## 📜 许可证

MIT License

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=wangwangit/SubsTracker&type=Date)](https://www.star-history.com/#wangwangit/SubsTracker&Date)
