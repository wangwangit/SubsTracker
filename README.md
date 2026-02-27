# SubsTracker - 订阅管理与提醒系统

基于 Cloudflare Workers 的轻量级订阅管理系统，支持多渠道提醒、自动续订、财务统计与仪表盘。

![image](https://github.com/user-attachments/assets/22ff1592-7836-4f73-aa13-24e9d43d7064)

## ✨ 功能

- 订阅管理：增删改查、启用停用、备注与分类
- 到期提醒：按 UTC 时段过滤，支持多渠道通知
- 自动续订：支持周期续订与记录支付历史
- 财务分析：月/年支出、分类排行、最近支付、即将续费
- 可观测性：任务状态与历史记录展示

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

---

## 🔑 获取 Cloudflare API Token

1. 打开 Cloudflare Dashboard → **My Profile** → **API Tokens**
2. 点击 **Create Token**
3. 可选模板：`Edit Cloudflare Workers`
4. 权限至少包含：
   - Workers Scripts: Edit
   - Workers KV Storage: Edit
5. Account Resources 选择你的账号
6. 创建后复制 Token

> ⚠️ Token 只显示一次，请妥善保存；泄露后请立刻删除重建。

---

## 🚀 推荐部署方式（统一）

```bash
npm install
# Windows PowerShell:
$env:CLOUDFLARE_API_TOKEN="你的token"
npm run deploy:safe
```

`deploy:safe` 会自动做两件事：
1. `npm run setup`：
   - 检查你账号下是否已有 `SUBSCRIPTIONS_KV` / `SUBSCRIPTIONS_KV_PREVIEW`
   - 若存在，复用原有 ID
   - 若不存在，自动创建
   - 自动回写 `wrangler.toml`
2. `npm run deploy`：部署 Worker

> 如果你是 Windows CMD，请用：
> `set CLOUDFLARE_API_TOKEN=你的token`

---

## 🔄 升级已部署版本（保留原数据）

可以，且推荐这样升级：

```bash
git pull
npm install
# Windows PowerShell:
$env:CLOUDFLARE_API_TOKEN="你的token"
npm run deploy:safe
```

为什么不会乱：
- 若你账号里已有 `SUBSCRIPTIONS_KV`，脚本会优先复用，不会随便新建替换
- 因此原有 `config/subscriptions` 数据会继续沿用

建议升级前可做备份（可选）：

```bash
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote config > backup-config.json
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote subscriptions > backup-subscriptions.json
```

---

## 🔔 通知时间说明（重要）

- 后端调度与计算统一使用 **UTC**
- `notificationHours` 也按 **UTC 小时**解释
- 留空表示全天允许发送
- 前端页面时间按“当前设备时区”显示

---

## 🛠 常见问题排查

### 1) `Authentication error [code: 10000]`

通常不是代码问题，而是本地 Wrangler 状态/缓存或 Token 权限问题。

建议按顺序处理：

```bash
# PowerShell 重新设置 token
$env:CLOUDFLARE_API_TOKEN="你的token"

# 再执行
npm run deploy:safe
```

若仍报错，清理本地 Wrangler 缓存后重试：

- Windows: `C:\Users\<你的用户名>\AppData\Roaming\xdg.config\.wrangler\`

删除该目录后，重新设置 token 再执行部署。

### 2) 旧版本升级会不会丢数据？

不会。`deploy:safe` 会优先复用你账号下已有的 `SUBSCRIPTIONS_KV`，只有不存在时才自动创建。

## 🔧 通知渠道

- Telegram
- NotifyX
- Webhook
- 企业微信机器人
- Email (Resend)
- Bark

---

## 🤝 贡献

欢迎提 issue 或 PR。

## 📜 License

MIT
