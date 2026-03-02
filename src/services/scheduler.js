import { getConfig } from '../data/config.js';
import { getAllSubscriptions } from '../data/subscriptions.js';
import { getCurrentTimeInTimezone, MS_PER_HOUR, MS_PER_DAY, getTimezoneMidnightTimestamp } from '../core/time.js';
import { formatNotificationContent, shouldTriggerReminder } from './notify/reminder.js';
import { sendNotificationToAllChannels } from './notify/index.js';
import { lunarCalendar, lunarBiz } from '../core/lunar.js';

async function saveSchedulerStatus(env, status) {
  try {
    await env.SUBSCRIPTIONS_KV.put('scheduler_status', JSON.stringify(status));

    const historyLimit = 20;
    const historyRaw = await env.SUBSCRIPTIONS_KV.get('scheduler_status_history');
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    const nextHistory = [status, ...(Array.isArray(history) ? history : [])].slice(0, historyLimit);
    await env.SUBSCRIPTIONS_KV.put('scheduler_status_history', JSON.stringify(nextHistory));
  } catch (error) {
    console.error('[定时任务] 写入执行状态失败:', error);
  }
}

async function dedupeNotifications(env, subscriptions, bucketKey) {
  const deduped = [];
  let skipped = 0;

  for (const subscription of subscriptions) {
    const key = `notify_dedupe:${subscription.id}:${bucketKey}`;
    const exists = await env.SUBSCRIPTIONS_KV.get(key);
    if (exists) {
      skipped += 1;
      continue;
    }

    await env.SUBSCRIPTIONS_KV.put(key, '1', { expirationTtl: 60 * 60 * 48 });
    deduped.push(subscription);
  }

  return { deduped, skipped };
}

async function checkExpiringSubscriptions(env) {
  try {
    const config = await getConfig(env);
    const timezone = 'UTC';
    const currentTime = getCurrentTimeInTimezone('UTC');
    const todayMidnight = getTimezoneMidnightTimestamp(currentTime, 'UTC');

    const subscriptions = await getAllSubscriptions(env);
    const expiringSubscriptions = [];
    const updatedSubscriptions = [];
    let hasUpdates = false;

    const normalizedNotificationHours = Array.isArray(config.NOTIFICATION_HOURS)
      ? config.NOTIFICATION_HOURS.map(h => String(h).padStart(2, '0'))
      : [];
    const currentHour = String(currentTime.getHours()).padStart(2, '0');
    const shouldNotifyThisHour =
      normalizedNotificationHours.includes('*') ||
      normalizedNotificationHours.includes('ALL') ||
      normalizedNotificationHours.includes(currentHour) ||
      normalizedNotificationHours.length === 0;

    const status = {
      lastRunAt: new Date().toISOString(),
      timezone,
      currentHour,
      configuredHours: normalizedNotificationHours,
      shouldNotifyThisHour,
      checkedSubscriptions: Array.isArray(subscriptions) ? subscriptions.length : 0,
      activeSubscriptions: 0,
      expiringMatched: 0,
      dedupeSkipped: 0,
      updatedSubscriptions: 0,
      sent: false,
      sendResult: null,
      reason: ''
    };

    for (const subscription of subscriptions) {
      if (!subscription.isActive) continue;
      status.activeSubscriptions += 1;

      const reminderSetting = { unit: subscription.reminderUnit || 'day', value: subscription.reminderValue ?? 7 };
      let expiryDate = new Date(subscription.expiryDate);
      let daysDiff = Math.ceil((expiryDate.getTime() - todayMidnight) / MS_PER_DAY);
      let diffMs = expiryDate.getTime() - currentTime.getTime();
      let diffHours = diffMs / MS_PER_HOUR;

      if (subscription.autoRenew && daysDiff < 0) {
        const mode = subscription.subscriptionMode || 'cycle';
        let periodsAdded = 0;

        if (subscription.useLunar) {
          let lunar = lunarCalendar.solar2lunar(expiryDate.getFullYear(), expiryDate.getMonth() + 1, expiryDate.getDate());
          while (expiryDate <= currentTime) {
            lunar = lunarBiz.addLunarPeriod(lunar, subscription.periodValue, subscription.periodUnit);
            const solar = lunarBiz.lunar2solar(lunar);
            expiryDate = new Date(solar.year, solar.month - 1, solar.day);
            periodsAdded++;
          }
        } else {
          while (expiryDate <= currentTime) {
            if (mode === 'reset') {
              expiryDate = new Date(currentTime);
            }
            if (subscription.periodUnit === 'day') {
              expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
            } else if (subscription.periodUnit === 'month') {
              expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
            } else if (subscription.periodUnit === 'year') {
              expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
            }
            periodsAdded++;
          }
        }

        const newStartDate = mode === 'reset' ? new Date(currentTime) : new Date(subscription.expiryDate);
        const newExpiryDate = expiryDate;
        const paymentRecord = {
          id: Date.now().toString(),
          date: currentTime.toISOString(),
          amount: subscription.amount || 0,
          type: 'auto',
          note: `自动续订 (${mode === 'reset' ? '重置模式' : '接续模式'}${periodsAdded > 1 ? ', 补齐' + periodsAdded + '周期' : ''})`,
          periodStart: newStartDate.toISOString(),
          periodEnd: newExpiryDate.toISOString()
        };

        const paymentHistory = subscription.paymentHistory || [];
        paymentHistory.push(paymentRecord);
        const paymentHistoryLimit = Number(config.PAYMENT_HISTORY_LIMIT) || 100;
        const trimmedPaymentHistory = paymentHistory.length > paymentHistoryLimit
          ? paymentHistory.slice(-paymentHistoryLimit)
          : paymentHistory;

        const updatedSubscription = {
          ...subscription,
          startDate: newStartDate.toISOString(),
          expiryDate: newExpiryDate.toISOString(),
          lastPaymentDate: currentTime.toISOString(),
          paymentHistory: trimmedPaymentHistory
        };

        updatedSubscriptions.push(updatedSubscription);
        hasUpdates = true;

        diffMs = newExpiryDate.getTime() - currentTime.getTime();
        diffHours = diffMs / MS_PER_HOUR;
        daysDiff = Math.ceil((newExpiryDate.getTime() - todayMidnight) / MS_PER_DAY);
        const shouldRemindAfterRenewal = shouldTriggerReminder(reminderSetting, daysDiff, diffHours);
        if (shouldRemindAfterRenewal) {
          expiringSubscriptions.push({
            ...updatedSubscription,
            daysRemaining: daysDiff,
            hoursRemaining: Math.round(diffHours)
          });
        }
        continue;
      }

      const shouldRemind = shouldTriggerReminder(reminderSetting, daysDiff, diffHours);
      if (daysDiff < 0 && subscription.autoRenew === false) {
        expiringSubscriptions.push({
          ...subscription,
          daysRemaining: daysDiff,
          hoursRemaining: Math.round(diffHours)
        });
      } else if (shouldRemind) {
        expiringSubscriptions.push({
          ...subscription,
          daysRemaining: daysDiff,
          hoursRemaining: Math.round(diffHours)
        });
      }
    }

    if (hasUpdates) {
      const mergedSubscriptions = subscriptions.map(sub => {
        const updated = updatedSubscriptions.find(u => u.id === sub.id);
        return updated || sub;
      });
      await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(mergedSubscriptions));
      console.log(`[定时任务] 已更新 ${updatedSubscriptions.length} 个自动续费订阅`);
    }

    status.updatedSubscriptions = updatedSubscriptions.length;
    status.expiringMatched = expiringSubscriptions.length;

    if (expiringSubscriptions.length > 0) {
      if (!shouldNotifyThisHour) {
        status.sent = false;
        status.reason = `当前小时 ${currentHour} 未在通知时段内 (${normalizedNotificationHours.join(',') || '空'})`;
        console.log(`[定时任务] ${status.reason}，跳过发送`);
      } else {
        expiringSubscriptions.sort((a, b) => a.daysRemaining - b.daysRemaining);
        const bucketKey = `${new Date().toISOString().slice(0, 13)}`;
        const dedupeResult = await dedupeNotifications(env, expiringSubscriptions, bucketKey);
        status.dedupeSkipped = dedupeResult.skipped;

        if (dedupeResult.deduped.length === 0) {
          status.sent = false;
          status.reason = `命中 ${expiringSubscriptions.length} 条，但全部在去重窗口内（跳过 ${dedupeResult.skipped} 条）`;
          console.log(`[定时任务] ${status.reason}`);
        } else {
          console.log(`[定时任务] 发送 ${dedupeResult.deduped.length} 条提醒通知（去重跳过 ${dedupeResult.skipped} 条）`);
          const commonContent = formatNotificationContent(dedupeResult.deduped, config);
          const sendResult = await sendNotificationToAllChannels('订阅到期/续费提醒', commonContent, config, '[定时任务]');
          status.sent = true;
          status.sendResult = sendResult;
          status.reason = sendResult && sendResult.attempted > 0
            ? `已尝试发送到 ${sendResult.attempted} 个渠道，成功 ${sendResult.successCount} 个（去重跳过 ${dedupeResult.skipped} 条）`
            : '未启用任何通知渠道';
        }
      }
    } else {
      status.sent = false;
      status.reason = '本次未命中需要提醒的订阅';
    }

    await saveSchedulerStatus(env, status);
  } catch (error) {
    console.error('[定时任务] 执行失败:', error);
    await saveSchedulerStatus(env, {
      lastRunAt: new Date().toISOString(),
      sent: false,
      reason: '执行异常: ' + (error && error.message ? error.message : String(error)),
      errorStack: error && error.stack ? error.stack : undefined
    });
  }
}

export { checkExpiringSubscriptions };
