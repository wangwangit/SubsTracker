# SubsTracker 升级指南（v1 -> v2）

> 目标：从 legacy 单文件版本平滑升级到模块化 v2，保留现有数据并可快速回滚。

## 0. 升级前准备

- 确认当前 KV 命名空间仍为：`SUBSCRIPTIONS_KV`
- 记录当前线上 Worker 版本 ID（用于回滚）
- 建议先备份：
  - `config`
  - `subscriptions`

### 备份示例（Wrangler）

```bash
# 列出 key
npx wrangler kv key list --binding=SUBSCRIPTIONS_KV --env="" --remote

# 导出关键数据
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote config > backup-config.json
npx wrangler kv key get --binding=SUBSCRIPTIONS_KV --env="" --remote subscriptions > backup-subscriptions.json
```

---

## 1. 获取 v2 代码

```bash
git pull
npm install
```

---

## 2. 核对部署配置（必须）

确认 `wrangler.toml` 至少包含：

- `main = "src/index.js"`
- `triggers.crons = ["0 * * * *"]`（每小时）
- KV 绑定为 `SUBSCRIPTIONS_KV`

---

## 3. 部署

```bash
CLOUDFLARE_API_TOKEN=你的Token npx wrangler deploy --env=""
```

---

## 4. 升级后验证（Checklist）

1. 能正常登录后台
2. 配置页测试通知可发送
3. 仪表盘出现：
   - 自动提醒任务状态
   - 最近任务历史
4. 通知时段按 UTC 生效
5. 订阅编辑日期不再误报格式错误

---

## 5. 行为变化说明（重点）

### 时间与时区

- 后端：统一使用 **UTC** 进行调度与计算
- 前端：统一显示 **当前设备时区**
- `notificationHours`：按 UTC 小时解释

### 定时任务

- 由每日改为每小时执行
- 增加去重，避免同窗口重复通知

### 成本控制

- 新增 `PAYMENT_HISTORY_LIMIT`，控制支付历史长度

---

## 6. 回滚方案（应急）

### 方案A：回滚到旧 Worker 版本
在 Cloudflare 控制台选择上一版本回滚。

### 方案B：回滚到 legacy 代码
- 切换到 `legacy-v1` 分支
- 重新 deploy

---

## 7. 常见问题

### Q1: 为什么通知时段填了多个，但仪表盘一开始只显示一个？
A: 仪表盘状态来自“最近一次 cron 执行快照”。修改配置后要等下一次 cron 触发才会刷新。

### Q2: notificationHours 留空会怎样？
A: 留空表示全天允许发送。

### Q3: 为什么页面显示时间和后台计算时区不一致？
A: 这是设计行为：页面按用户设备时区展示，后台统一 UTC，保证计算稳定。
