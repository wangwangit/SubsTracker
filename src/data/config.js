import { getKVJson, putKVJson } from './kv.js';

const DEFAULT_CONFIG = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'password',
  TG_BOT_TOKEN: '',
  TG_CHAT_ID: '',
  NOTIFYX_API_KEY: '',
  WEBHOOK_URL: '',
  WEBHOOK_METHOD: 'POST',
  WEBHOOK_HEADERS: '',
  WEBHOOK_TEMPLATE: '',
  SHOW_LUNAR: false,
  WECHATBOT_WEBHOOK: '',
  WECHATBOT_MSG_TYPE: 'text',
  WECHATBOT_AT_MOBILES: '',
  WECHATBOT_AT_ALL: 'false',
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  EMAIL_FROM_NAME: '订阅提醒系统',
  EMAIL_TO: '',
  BARK_DEVICE_KEY: '',
  BARK_SERVER: 'https://api.day.app',
  BARK_IS_ARCHIVE: 'false',
  ENABLED_NOTIFIERS: ['notifyx'],
  THEME_MODE: 'system',
  TIMEZONE: 'UTC',
  NOTIFICATION_HOURS: [],
  THIRD_PARTY_API_TOKEN: '',
  DEBUG_LOGS: false,
  PAYMENT_HISTORY_LIMIT: 100
};

async function getConfig(env) {
  if (!env.SUBSCRIPTIONS_KV) {
    console.error('[配置] KV存储未绑定');
    throw new Error('KV存储未绑定');
  }
  const data = await env.SUBSCRIPTIONS_KV.get('config');
  console.log('[配置] 从KV读取配置:', data ? '成功' : '空配置');
  const config = data ? JSON.parse(data) : {};

  let jwtSecret = config.JWT_SECRET;
  if (!jwtSecret) {
    console.log('[配置] 生成新的JWT密钥');
    jwtSecret = crypto.randomUUID();
    const updatedConfig = { ...config, JWT_SECRET: jwtSecret };
    await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
    JWT_SECRET: jwtSecret
  };
}

async function updateConfig(env, newConfig) {
  const config = await getConfig(env);
  const updatedConfig = {
    ...config,
    ADMIN_USERNAME: newConfig.ADMIN_USERNAME || config.ADMIN_USERNAME,
    ADMIN_PASSWORD: newConfig.ADMIN_PASSWORD || config.ADMIN_PASSWORD,
    THEME_MODE: newConfig.THEME_MODE || 'system',
    TIMEZONE: newConfig.TIMEZONE || config.TIMEZONE || 'UTC',
    SHOW_LUNAR: newConfig.SHOW_LUNAR === true,
    NOTIFYX_API_KEY: newConfig.NOTIFYX_API_KEY || '',
    RESEND_API_KEY: newConfig.RESEND_API_KEY || '',
    THIRD_PARTY_API_TOKEN: newConfig.THIRD_PARTY_API_TOKEN || '',
    DEBUG_LOGS: newConfig.DEBUG_LOGS === true
  };

  await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));
  return updatedConfig;
}

async function setConfig(env, config) {
  await putKVJson(env, 'config', config);
}

export {
  DEFAULT_CONFIG,
  getConfig,
  updateConfig,
  setConfig
};
