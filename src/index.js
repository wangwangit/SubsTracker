import { handleApiRequest } from './api/router.js';
import { handleAdminRequest, handleLoginPage } from './api/admin.js';
import { handleDebug } from './api/debug.js';
import { getCurrentTimeInTimezone } from './core/time.js';
import { checkExpiringSubscriptions } from './services/scheduler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/debug') {
      return handleDebug(request, env);
    } else if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env);
    } else if (url.pathname.startsWith('/admin')) {
      return handleAdminRequest(request, env, ctx);
    } else {
      return handleLoginPage();
    }
  },

  async scheduled(event, env, ctx) {
    const currentTime = getCurrentTimeInTimezone('UTC');
    console.log('[Workers] 定时任务触发', 'cron:', event?.cron || '(unknown)', 'UTC:', new Date().toISOString(), 'runtime:', currentTime.toISOString());
    await checkExpiringSubscriptions(env);
  }
};
