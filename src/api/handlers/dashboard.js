import { getAllSubscriptions } from '../../data/subscriptions.js';
import { getDynamicRates, calculateMonthlyExpense, calculateYearlyExpense, getRecentPayments, getUpcomingRenewals, getExpenseByType, getExpenseByCategory } from '../../core/currency.js';
import { getCurrentTimeInTimezone, MS_PER_DAY } from '../../core/time.js';

async function handleDashboardStats(env, config) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const timezone = 'UTC';

    let schedulerStatus = null;
    let schedulerStatusHistory = [];
    try {
      const rawSchedulerStatus = await env.SUBSCRIPTIONS_KV.get('scheduler_status');
      schedulerStatus = rawSchedulerStatus ? JSON.parse(rawSchedulerStatus) : null;
      const rawSchedulerStatusHistory = await env.SUBSCRIPTIONS_KV.get('scheduler_status_history');
      schedulerStatusHistory = rawSchedulerStatusHistory ? JSON.parse(rawSchedulerStatusHistory) : [];
    } catch (error) {
      console.error('读取定时任务状态失败:', error);
    }

    const rates = await getDynamicRates(env);
    const monthlyExpense = calculateMonthlyExpense(subscriptions, timezone, rates);
    const yearlyExpense = calculateYearlyExpense(subscriptions, timezone, rates);
    const recentPayments = getRecentPayments(subscriptions, timezone);
    const upcomingRenewals = getUpcomingRenewals(subscriptions, timezone);
    const expenseByType = getExpenseByType(subscriptions, timezone, rates);
    const expenseByCategory = getExpenseByCategory(subscriptions, timezone, rates);

    const activeSubscriptions = subscriptions.filter(s => s.isActive);
    const now = getCurrentTimeInTimezone(timezone);
    const sevenDaysLater = new Date(now.getTime() + 7 * MS_PER_DAY);
    const expiringSoon = activeSubscriptions.filter(s => {
      const expiryDate = new Date(s.expiryDate);
      return expiryDate >= now && expiryDate <= sevenDaysLater;
    }).length;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          monthlyExpense,
          yearlyExpense,
          activeSubscriptions: {
            active: activeSubscriptions.length,
            total: subscriptions.length,
            expiringSoon
          },
          recentPayments,
          upcomingRenewals,
          expenseByType,
          expenseByCategory,
          schedulerStatus,
          schedulerStatusHistory
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('获取仪表盘统计失败:', error);
    return new Response(
      JSON.stringify({ success: false, message: '获取统计数据失败: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { handleDashboardStats };
