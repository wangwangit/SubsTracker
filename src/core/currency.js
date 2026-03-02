import { MS_PER_DAY, getCurrentTimeInTimezone, getTimezoneDateParts } from './time.js';

const CATEGORY_SEPARATOR_REGEX = /[\/，,\s]+/;

// 汇率配置 (以 CNY 为基准，当 API 不可用或缺少特定币种如 TWD 时使用)
const FALLBACK_RATES = {
  'CNY': 1,
  'USD': 6.98,
  'HKD': 0.90,
  'TWD': 0.22,
  'JPY': 0.044,
  'EUR': 8.16,
  'GBP': 9.40,
  'KRW': 0.0048,
  'TRY': 0.16
};

async function getDynamicRates(env) {
  const CACHE_KEY = 'SYSTEM_EXCHANGE_RATES';
  const CACHE_TTL = 86400000; // 24小时

  try {
    const cached = await env.SUBSCRIPTIONS_KV.get(CACHE_KEY, { type: 'json' });
    if (cached && cached.ts && (Date.now() - cached.ts < CACHE_TTL)) {
      return cached.rates;
    }
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=CNY');
    if (response.ok) {
      const data = await response.json();
      const newRates = {
        ...FALLBACK_RATES,
        ...data.rates,
        'CNY': 1
      };

      await env.SUBSCRIPTIONS_KV.put(CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        rates: newRates
      }));

      return newRates;
    } else {
      console.warn('[汇率] API 请求失败，使用兜底汇率');
    }
  } catch (error) {
    console.error('[汇率] 获取过程出错:', error);
  }
  return FALLBACK_RATES;
}

function convertToCNY(amount, currency, rates) {
  if (!amount || amount <= 0) return 0;
  const code = currency || 'CNY';
  if (code === 'CNY') return amount;
  const rate = rates[code];
  if (!rate) return amount;
  return amount / rate;
}

function calculateMonthlyExpense(subscriptions, timezone, rates) {
  const now = getCurrentTimeInTimezone(timezone);
  const parts = getTimezoneDateParts(now, timezone);
  const currentYear = parts.year;
  const currentMonth = parts.month;

  let amount = 0;
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      const paymentParts = getTimezoneDateParts(paymentDate, timezone);
      if (paymentParts.year === currentYear && paymentParts.month === currentMonth) {
        amount += convertToCNY(payment.amount, sub.currency, rates);
      }
    });
  });

  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  let lastMonthAmount = 0;
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      const paymentParts = getTimezoneDateParts(paymentDate, timezone);
      if (paymentParts.year === lastMonthYear && paymentParts.month === lastMonth) {
        lastMonthAmount += convertToCNY(payment.amount, sub.currency, rates);
      }
    });
  });

  let trend = 0;
  let trendDirection = 'flat';
  if (lastMonthAmount > 0) {
    trend = Math.round(((amount - lastMonthAmount) / lastMonthAmount) * 100);
    if (trend > 0) trendDirection = 'up';
    else if (trend < 0) trendDirection = 'down';
  } else if (amount > 0) {
    trend = 100;
    trendDirection = 'up';
  }
  return { amount, trend: Math.abs(trend), trendDirection };
}

function calculateYearlyExpense(subscriptions, timezone, rates) {
  const now = getCurrentTimeInTimezone(timezone);
  const parts = getTimezoneDateParts(now, timezone);
  const currentYear = parts.year;

  let amount = 0;
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      const paymentParts = getTimezoneDateParts(paymentDate, timezone);
      if (paymentParts.year === currentYear) {
        amount += convertToCNY(payment.amount, sub.currency, rates);
      }
    });
  });

  const monthlyAverage = amount / parts.month;
  return { amount, monthlyAverage };
}

function getRecentPayments(subscriptions, timezone) {
  const now = getCurrentTimeInTimezone(timezone);
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const recentPayments = [];
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      if (paymentDate >= sevenDaysAgo && paymentDate <= now) {
        recentPayments.push({
          name: sub.name,
          amount: payment.amount,
          currency: sub.currency || 'CNY',
          customType: sub.customType,
          paymentDate: payment.date,
          note: payment.note
        });
      }
    });
  });
  return recentPayments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
}

function getUpcomingRenewals(subscriptions, timezone) {
  const now = getCurrentTimeInTimezone(timezone);
  const sevenDaysLater = new Date(now.getTime() + 7 * MS_PER_DAY);
  return subscriptions
    .filter(sub => {
      if (!sub.isActive) return false;
      const renewalDate = new Date(sub.expiryDate);
      return renewalDate >= now && renewalDate <= sevenDaysLater;
    })
    .map(sub => {
      const renewalDate = new Date(sub.expiryDate);
      const daysUntilRenewal = Math.ceil((renewalDate - now) / MS_PER_DAY);
      return {
        name: sub.name,
        amount: sub.amount || 0,
        currency: sub.currency || 'CNY',
        customType: sub.customType,
        renewalDate: sub.expiryDate,
        daysUntilRenewal
      };
    })
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
}

function getExpenseByType(subscriptions, timezone, rates) {
  const now = getCurrentTimeInTimezone(timezone);
  const parts = getTimezoneDateParts(now, timezone);
  const currentYear = parts.year;
  const typeMap = {};
  let total = 0;
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      const paymentParts = getTimezoneDateParts(paymentDate, timezone);
      if (paymentParts.year === currentYear) {
        const type = sub.customType || '未分类';
        const amountCNY = convertToCNY(payment.amount, sub.currency, rates);
        typeMap[type] = (typeMap[type] || 0) + amountCNY;
        total += amountCNY;
      }
    });
  });

  return Object.entries(typeMap)
    .map(([type, amount]) => ({
      type,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function getExpenseByCategory(subscriptions, timezone, rates) {
  const now = getCurrentTimeInTimezone(timezone);
  const parts = getTimezoneDateParts(now, timezone);
  const currentYear = parts.year;

  const categoryMap = {};
  let total = 0;
  subscriptions.forEach(sub => {
    const paymentHistory = sub.paymentHistory || [];
    paymentHistory.forEach(payment => {
      if (!payment.amount || payment.amount <= 0) return;
      const paymentDate = new Date(payment.date);
      const paymentParts = getTimezoneDateParts(paymentDate, timezone);
      if (paymentParts.year === currentYear) {
        const categories = sub.category ? sub.category.split(CATEGORY_SEPARATOR_REGEX).filter(c => c.trim()) : ['未分类'];
        const amountCNY = convertToCNY(payment.amount, sub.currency, rates);

        categories.forEach(category => {
          const cat = category.trim() || '未分类';
          categoryMap[cat] = (categoryMap[cat] || 0) + amountCNY / categories.length;
        });
        total += amountCNY;
      }
    });
  });

  return Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

export {
  FALLBACK_RATES,
  getDynamicRates,
  convertToCNY,
  calculateMonthlyExpense,
  calculateYearlyExpense,
  getRecentPayments,
  getUpcomingRenewals,
  getExpenseByType,
  getExpenseByCategory
};
