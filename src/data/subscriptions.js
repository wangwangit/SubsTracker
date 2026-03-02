import { getConfig } from './config.js';
import { getCurrentTimeInTimezone, getTimezoneMidnightTimestamp } from '../core/time.js';
import { lunarCalendar, lunarBiz } from '../core/lunar.js';
import { resolveReminderSetting } from '../services/notify/reminder.js';

function trimPaymentHistory(records = [], limit = 100) {
  const safeLimit = Math.min(1000, Math.max(10, Number(limit) || 100));
  if (!Array.isArray(records)) return [];
  if (records.length <= safeLimit) return records;

  const initialRecords = records.filter(item => item && item.type === 'initial');
  const otherRecords = records.filter(item => item && item.type !== 'initial');
  const keptOther = otherRecords.slice(-(safeLimit - Math.min(initialRecords.length, 1)));
  const keptInitial = initialRecords.length > 0 ? [initialRecords[0]] : [];
  return [...keptInitial, ...keptOther];
}

async function getAllSubscriptions(env) {
  try {
    const data = await env.SUBSCRIPTIONS_KV.get('subscriptions');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

async function getSubscription(id, env) {
  const subscriptions = await getAllSubscriptions(env);
  return subscriptions.find(s => s.id === id);
}

async function createSubscription(subscription, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);

    if (!subscription.name || !subscription.expiryDate) {
      return { success: false, message: '缺少必填字段' };
    }

    let expiryDate = new Date(subscription.expiryDate);
    const currentTime = getCurrentTimeInTimezone('UTC');

    let useLunar = !!subscription.useLunar;
    if (useLunar) {
      let lunar = lunarCalendar.solar2lunar(
        expiryDate.getFullYear(),
        expiryDate.getMonth() + 1,
        expiryDate.getDate()
      );

      if (lunar && subscription.periodValue && subscription.periodUnit) {
        while (expiryDate <= currentTime) {
          lunar = lunarBiz.addLunarPeriod(lunar, subscription.periodValue, subscription.periodUnit);
          const solar = lunarBiz.lunar2solar(lunar);
          expiryDate = new Date(solar.year, solar.month - 1, solar.day);
        }
        subscription.expiryDate = expiryDate.toISOString();
      }
    } else {
      if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
        while (expiryDate < currentTime) {
          if (subscription.periodUnit === 'day') {
            expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
          } else if (subscription.periodUnit === 'month') {
            expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
          } else if (subscription.periodUnit === 'year') {
            expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
          }
        }
        subscription.expiryDate = expiryDate.toISOString();
      }
    }

    const reminderSetting = resolveReminderSetting(subscription);

    const initialPaymentDate = subscription.startDate || currentTime.toISOString();
    const newSubscription = {
      id: Date.now().toString(),
      name: subscription.name,
      subscriptionMode: subscription.subscriptionMode || 'cycle',
      customType: subscription.customType || '',
      category: subscription.category ? subscription.category.trim() : '',
      startDate: subscription.startDate || null,
      expiryDate: subscription.expiryDate,
      periodValue: subscription.periodValue || 1,
      periodUnit: subscription.periodUnit || 'month',
      reminderUnit: reminderSetting.unit,
      reminderValue: reminderSetting.value,
      reminderDays: reminderSetting.unit === 'day' ? reminderSetting.value : undefined,
      reminderHours: reminderSetting.unit === 'hour' ? reminderSetting.value : undefined,
      notes: subscription.notes || '',
      amount: subscription.amount || null,
      currency: subscription.currency || 'CNY',
      lastPaymentDate: initialPaymentDate,
      paymentHistory: subscription.amount ? [{
        id: Date.now().toString(),
        date: initialPaymentDate,
        amount: subscription.amount,
        type: 'initial',
        note: '初始订阅',
        periodStart: subscription.startDate || initialPaymentDate,
        periodEnd: subscription.expiryDate
      }] : [],
      isActive: subscription.isActive !== false,
      autoRenew: subscription.autoRenew !== false,
      useLunar: useLunar,
      createdAt: new Date().toISOString()
    };

    subscriptions.push(newSubscription);

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: newSubscription };
  } catch (error) {
    console.error("创建订阅异常：", error && error.stack ? error.stack : error);
    return { success: false, message: error && error.message ? error.message : '创建订阅失败' };
  }
}

async function updateSubscription(id, subscription, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === id);

    if (index === -1) {
      return { success: false, message: '订阅不存在' };
    }

    if (!subscription.name || !subscription.expiryDate) {
      return { success: false, message: '缺少必填字段' };
    }

    let expiryDate = new Date(subscription.expiryDate);
    const currentTime = getCurrentTimeInTimezone('UTC');

    let useLunar = !!subscription.useLunar;
    if (useLunar) {
      let lunar = lunarCalendar.solar2lunar(
        expiryDate.getFullYear(),
        expiryDate.getMonth() + 1,
        expiryDate.getDate()
      );
      if (!lunar) {
        return { success: false, message: '农历日期超出支持范围（1900-2100年）' };
      }
      if (lunar && expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
        do {
          lunar = lunarBiz.addLunarPeriod(lunar, subscription.periodValue, subscription.periodUnit);
          const solar = lunarBiz.lunar2solar(lunar);
          expiryDate = new Date(solar.year, solar.month - 1, solar.day);
        } while (expiryDate < currentTime);
        subscription.expiryDate = expiryDate.toISOString();
      }
    } else {
      if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
        while (expiryDate < currentTime) {
          if (subscription.periodUnit === 'day') {
            expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
          } else if (subscription.periodUnit === 'month') {
            expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
          } else if (subscription.periodUnit === 'year') {
            expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
          }
        }
        subscription.expiryDate = expiryDate.toISOString();
      }
    }

    const reminderSource = {
      reminderUnit: subscription.reminderUnit !== undefined ? subscription.reminderUnit : subscriptions[index].reminderUnit,
      reminderValue: subscription.reminderValue !== undefined ? subscription.reminderValue : subscriptions[index].reminderValue,
      reminderHours: subscription.reminderHours !== undefined ? subscription.reminderHours : subscriptions[index].reminderHours,
      reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : subscriptions[index].reminderDays
    };
    const reminderSetting = resolveReminderSetting(reminderSource);

    const oldSubscription = subscriptions[index];
    const newAmount = subscription.amount !== undefined ? subscription.amount : oldSubscription.amount;

    let paymentHistory = oldSubscription.paymentHistory || [];

    if (newAmount !== oldSubscription.amount) {
      const initialPaymentIndex = paymentHistory.findIndex(p => p.type === 'initial');
      if (initialPaymentIndex !== -1) {
        paymentHistory[initialPaymentIndex] = {
          ...paymentHistory[initialPaymentIndex],
          amount: newAmount
        };
      }
    }

    subscriptions[index] = {
      ...subscriptions[index],
      name: subscription.name,
      subscriptionMode: subscription.subscriptionMode || subscriptions[index].subscriptionMode || 'cycle',
      customType: subscription.customType || subscriptions[index].customType || '',
      category: subscription.category !== undefined ? subscription.category.trim() : (subscriptions[index].category || ''),
      startDate: subscription.startDate || subscriptions[index].startDate,
      expiryDate: subscription.expiryDate,
      periodValue: subscription.periodValue || subscriptions[index].periodValue || 1,
      periodUnit: subscription.periodUnit || subscriptions[index].periodUnit || 'month',
      reminderUnit: reminderSetting.unit,
      reminderValue: reminderSetting.value,
      reminderDays: reminderSetting.unit === 'day' ? reminderSetting.value : undefined,
      reminderHours: reminderSetting.unit === 'hour' ? reminderSetting.value : undefined,
      notes: subscription.notes || '',
      amount: newAmount,
      currency: subscription.currency || subscriptions[index].currency || 'CNY',
      lastPaymentDate: subscriptions[index].lastPaymentDate || subscriptions[index].startDate || subscriptions[index].createdAt || currentTime.toISOString(),
      paymentHistory: paymentHistory,
      isActive: subscription.isActive !== undefined ? subscription.isActive : subscriptions[index].isActive,
      autoRenew: subscription.autoRenew !== undefined ? subscription.autoRenew : (subscriptions[index].autoRenew !== undefined ? subscriptions[index].autoRenew : true),
      useLunar: useLunar,
      updatedAt: new Date().toISOString()
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index] };
  } catch (error) {
    return { success: false, message: '更新订阅失败' };
  }
}

async function deleteSubscription(id, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const filteredSubscriptions = subscriptions.filter(s => s.id !== id);

    if (filteredSubscriptions.length === subscriptions.length) {
      return { success: false, message: '订阅不存在' };
    }

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(filteredSubscriptions));

    return { success: true };
  } catch (error) {
    return { success: false, message: '删除订阅失败' };
  }
}

async function manualRenewSubscription(id, env, options = {}) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === id);

    if (index === -1) {
      return { success: false, message: '订阅不存在' };
    }

    const subscription = subscriptions[index];

    if (!subscription.periodValue || !subscription.periodUnit) {
      return { success: false, message: '订阅未设置续订周期' };
    }

    const config = await getConfig(env);
    const currentTime = getCurrentTimeInTimezone('UTC');
    const todayMidnight = getTimezoneMidnightTimestamp(currentTime, 'UTC');
    void todayMidnight;

    const paymentDate = options.paymentDate ? new Date(options.paymentDate) : currentTime;
    const amount = options.amount !== undefined ? options.amount : subscription.amount || 0;
    const periodMultiplier = options.periodMultiplier || 1;
    const note = options.note || '手动续订';
    const mode = subscription.subscriptionMode || 'cycle';

    let newStartDate;
    let currentExpiryDate = new Date(subscription.expiryDate);

    if (mode === 'reset') {
      newStartDate = new Date(paymentDate);
    } else {
      if (currentExpiryDate.getTime() > paymentDate.getTime()) {
        newStartDate = new Date(currentExpiryDate);
      } else {
        newStartDate = new Date(paymentDate);
      }
    }

    let newExpiryDate;
    if (subscription.useLunar) {
      const solarStart = {
        year: newStartDate.getFullYear(),
        month: newStartDate.getMonth() + 1,
        day: newStartDate.getDate()
      };
      let lunar = lunarCalendar.solar2lunar(solarStart.year, solarStart.month, solarStart.day);

      let nextLunar = lunar;
      for (let i = 0; i < periodMultiplier; i++) {
        nextLunar = lunarBiz.addLunarPeriod(nextLunar, subscription.periodValue, subscription.periodUnit);
      }
      const solar = lunarBiz.lunar2solar(nextLunar);
      newExpiryDate = new Date(solar.year, solar.month - 1, solar.day);
    } else {
      newExpiryDate = new Date(newStartDate);
      const totalPeriodValue = subscription.periodValue * periodMultiplier;

      if (subscription.periodUnit === 'day') {
        newExpiryDate.setDate(newExpiryDate.getDate() + totalPeriodValue);
      } else if (subscription.periodUnit === 'month') {
        newExpiryDate.setMonth(newExpiryDate.getMonth() + totalPeriodValue);
      } else if (subscription.periodUnit === 'year') {
        newExpiryDate.setFullYear(newExpiryDate.getFullYear() + totalPeriodValue);
      }
    }

    const paymentRecord = {
      id: Date.now().toString(),
      date: paymentDate.toISOString(),
      amount: amount,
      type: 'manual',
      note: note,
      periodStart: newStartDate.toISOString(),
      periodEnd: newExpiryDate.toISOString()
    };

    const paymentHistoryLimit = (await getConfig(env)).PAYMENT_HISTORY_LIMIT || 100;
    const paymentHistory = subscription.paymentHistory || [];
    paymentHistory.push(paymentRecord);
    const trimmedPaymentHistory = trimPaymentHistory(paymentHistory, paymentHistoryLimit);

    subscriptions[index] = {
      ...subscription,
      startDate: newStartDate.toISOString(),
      expiryDate: newExpiryDate.toISOString(),
      lastPaymentDate: paymentDate.toISOString(),
      paymentHistory: trimmedPaymentHistory
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index], message: '续订成功' };
  } catch (error) {
    console.error('手动续订失败:', error);
    return { success: false, message: '续订失败: ' + error.message };
  }
}

async function deletePaymentRecord(subscriptionId, paymentId, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === subscriptionId);

    if (index === -1) {
      return { success: false, message: '订阅不存在' };
    }

    const subscription = subscriptions[index];
    const paymentHistory = subscription.paymentHistory || [];
    const paymentIndex = paymentHistory.findIndex(p => p.id === paymentId);

    if (paymentIndex === -1) {
      return { success: false, message: '支付记录不存在' };
    }

    const deletedPayment = paymentHistory[paymentIndex];
    paymentHistory.splice(paymentIndex, 1);

    let newExpiryDate = subscription.expiryDate;
    let newLastPaymentDate = subscription.lastPaymentDate;

    if (paymentHistory.length > 0) {
      const sortedByPeriodEnd = [...paymentHistory].sort((a, b) => {
        const dateA = a.periodEnd ? new Date(a.periodEnd) : new Date(0);
        const dateB = a.periodEnd ? new Date(a.periodEnd) : new Date(0);
        return dateB - dateA;
      });

      if (sortedByPeriodEnd[0].periodEnd) {
        newExpiryDate = sortedByPeriodEnd[0].periodEnd;
      }

      const sortedByDate = [...paymentHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
      newLastPaymentDate = sortedByDate[0].date;
    } else {
      if (deletedPayment.periodStart) {
        newExpiryDate = deletedPayment.periodStart;
      }
      newLastPaymentDate = subscription.startDate || subscription.createdAt || subscription.expiryDate;
    }

    subscriptions[index] = {
      ...subscription,
      expiryDate: newExpiryDate,
      paymentHistory,
      lastPaymentDate: newLastPaymentDate
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index], message: '支付记录已删除' };
  } catch (error) {
    console.error('删除支付记录失败:', error);
    return { success: false, message: '删除失败: ' + error.message };
  }
}

async function updatePaymentRecord(subscriptionId, paymentId, paymentData, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === subscriptionId);

    if (index === -1) {
      return { success: false, message: '订阅不存在' };
    }

    const subscription = subscriptions[index];
    const paymentHistory = subscription.paymentHistory || [];
    const paymentIndex = paymentHistory.findIndex(p => p.id === paymentId);

    if (paymentIndex === -1) {
      return { success: false, message: '支付记录不存在' };
    }

    paymentHistory[paymentIndex] = {
      ...paymentHistory[paymentIndex],
      date: paymentData.date || paymentHistory[paymentIndex].date,
      amount: paymentData.amount !== undefined ? paymentData.amount : paymentHistory[paymentIndex].amount,
      note: paymentData.note !== undefined ? paymentData.note : paymentHistory[paymentIndex].note
    };

    const sortedPayments = [...paymentHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    const newLastPaymentDate = sortedPayments[0].date;

    subscriptions[index] = {
      ...subscription,
      paymentHistory,
      lastPaymentDate: newLastPaymentDate
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index], message: '支付记录已更新' };
  } catch (error) {
    console.error('更新支付记录失败:', error);
    return { success: false, message: '更新失败: ' + error.message };
  }
}

async function toggleSubscriptionStatus(id, isActive, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === id);

    if (index === -1) {
      return { success: false, message: '订阅不存在' };
    }

    subscriptions[index] = {
      ...subscriptions[index],
      isActive: isActive,
      updatedAt: new Date().toISOString()
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index] };
  } catch (error) {
    return { success: false, message: '更新订阅状态失败' };
  }
}

export {
  getAllSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  manualRenewSubscription,
  deletePaymentRecord,
  updatePaymentRecord,
  toggleSubscriptionStatus
};
