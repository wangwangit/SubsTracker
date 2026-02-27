# SubsTracker - 订阅管理与提醒系统

基于 Cloudflare Workers 的轻量级订阅管理系统，支持多渠道提醒、自动续订、财务统计与仪表盘。

![image](https://github.com/user-attachments/assets/22ff1592-7836-4f73-aa13-24e9d43d7064)

## ✨ 功能

- 订阅管理：增删改查、启用停用、备注与分类
- 到期提醒：按 UTC 时段过滤，支持多渠道通知
- 自动续订：支持周期续订与记录支付历史
- 财务分析：月/年支出、分类排行、最近支付、即将续费
- 可观测性：任务状态与历史记录展示

## 🚀 一键部署（推荐）

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wangwangit/SubsTracker)

> 注意：Cloudflare Deploy 按钮对“非默认分支”偶发不稳定；若出现 `An unknown error occurred`，请改用下方 CLI 方式部署（更稳定）。

部署后请确认：
- 在 Cloudflare 控制台创建并绑定 KV：`SUBSCRIPTIONS_KV`
- Cron：`0 * * * *`（每小时）
- 首次登录后修改默认账号密码

## 💻 CLI 部署（推荐开发分支使用）

```bash
npm install
export CLOUDFLARE_API_TOKEN=你的Token
npm run deploy
# 等价于：npx wrangler deploy --env=""
```

## 🔄 升级老版本

请查看：[`UPGRADE.md`](./UPGRADE.md)

适用于：
- 已在 Cloudflare 上运行旧版本
- 需要保留现有 KV 数据并平滑迁移
- 需要可回滚方案

## 🔔 通知时间说明（重要）

- 后端调度与计算统一使用 **UTC**
- `notificationHours` 也按 **UTC 小时**解释
- 留空表示全天允许发送
- 前端页面时间按“当前设备时区”显示

## 🔧 通知渠道

- Telegram
- NotifyX
- Webhook
- 企业微信机器人
- Email (Resend)
- Bark

## 🤝 贡献

欢迎提 issue 或 PR。

## 📜 License

MIT
