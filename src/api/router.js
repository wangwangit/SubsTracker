import { handleLogin, handleLogout, getUserFromRequest } from './handlers/auth.js';
import { handleGetConfig, handleUpdateConfig } from './handlers/config.js';
import { handleDashboardStats } from './handlers/dashboard.js';
import { handleThirdPartyNotify } from './handlers/notify.js';
import { handleSubscriptions } from './handlers/subscriptions.js';
import { getConfig } from '../data/config.js';
import { handleTestNotification } from './handlers/test-notification.js';

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.slice(4);
  const method = request.method;

  const config = await getConfig(env);

  if (path === '/login' && method === 'POST') {
    return handleLogin(request, env);
  }

  if (path === '/logout' && (method === 'GET' || method === 'POST')) {
    return handleLogout();
  }

  const { user } = await getUserFromRequest(request, env);
  if (!user && path !== '/login') {
    return new Response(
      JSON.stringify({ success: false, message: '未授权访问' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (path === '/config') {
    if (method === 'GET') return handleGetConfig(env);
    if (method === 'POST') return handleUpdateConfig(request, env);
  }

  if (path === '/dashboard/stats' && method === 'GET') {
    return handleDashboardStats(env, config);
  }

  if (path === '/test-notification' && method === 'POST') {
    return handleTestNotification(request, env);
  }

  const subscriptionResponse = await handleSubscriptions(request, env, path);
  if (subscriptionResponse) return subscriptionResponse;

  const thirdPartyResponse = await handleThirdPartyNotify(request, env, config, url);
  if (thirdPartyResponse) return thirdPartyResponse;

  return new Response(
    JSON.stringify({ success: false, message: '未找到请求的资源' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

export { handleApiRequest };
