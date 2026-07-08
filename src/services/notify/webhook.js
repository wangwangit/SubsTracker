// @ts-check
/**
 * Webhook 通知渠道
 *
 * 支持自定义请求方法、Header、消息模板（{{title}} / {{content}} / {{tags}} 等）。
 */
import { ok, fail, errorMessage } from './channel.js';
import { formatLocalDate } from '../../core/time.js';

/**
 * 把 value 转成可嵌入 JSON 字符串的安全片段。
 *
 * @param {any} value
 */
function escapeForJsonString(value) {
  if (value === null || value === undefined) return '';
  return JSON.stringify(String(value)).slice(1, -1);
}

/**
 * @param {any} template
 * @param {Record<string,any>} data
 */
function applyTemplate(template, data) {
  const templateString = JSON.stringify(template);
  const replaced = templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return escapeForJsonString(data[key]);
    }
    return '';
  });
  return JSON.parse(replaced);
}

/**
 * 构造可供模板替换的变量集合。
 *
 * @param {import('./channel.js').ChannelPayload} payload
 * @param {any} config
 */
function buildTemplateData(payload, config) {
  const tagsArray = Array.isArray(payload.metadata?.tags)
    ? payload.metadata.tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
    : [];
  const tagsBlock = tagsArray.length ? tagsArray.map((t) => `- ${t}`).join('\n') : '';
  const tagsLine = tagsArray.length ? '标签：' + tagsArray.join('、') : '';
  const timestamp = formatLocalDate(new Date(), config?.TIMEZONE || 'UTC', 'datetime');
  const formattedMessage = [
    payload.title,
    payload.content,
    tagsLine,
    `发送时间：${timestamp}`
  ]
    .filter((s) => s && s.trim().length > 0)
    .join('\n\n');

  return {
    title: payload.title,
    content: payload.content,
    tags: tagsBlock,
    tagsLine,
    rawTags: tagsArray,
    timestamp,
    formattedMessage,
    message: formattedMessage,
    // 扩展字段，便于规则化模板
    daysRemaining: payload.metadata?.daysRemaining ?? '',
    ruleType: payload.metadata?.ruleType ?? '',
    ruleValue: payload.metadata?.ruleValue ?? ''
  };
}

/** @type {import('./channel.js').Channel} */
export const webhookChannel = {
  name: 'webhook',

  validateConfig(config) {
    if (!config.WEBHOOK_URL) return { ok: false, error: '缺少 WEBHOOK_URL' };
    return { ok: true };
  },

  async send(payload, config) {
    const v = webhookChannel.validateConfig(config);
    if (!v.ok) return fail('webhook', v.error || '配置无效');

    let headers = { 'Content-Type': 'application/json' };
    if (config.WEBHOOK_HEADERS) {
      try {
        const customHeaders = JSON.parse(config.WEBHOOK_HEADERS);
        headers = { ...headers, ...customHeaders };
      } catch {
        console.warn('[Webhook] 自定义请求头格式错误，使用默认请求头');
      }
    }

    const data = buildTemplateData(payload, config);
    let requestBody;
    if (config.WEBHOOK_TEMPLATE) {
      try {
        const template = JSON.parse(config.WEBHOOK_TEMPLATE);
        requestBody = applyTemplate(template, data);
      } catch {
        console.warn('[Webhook] 消息模板格式错误，使用默认格式');
        requestBody = { ...data };
      }
    } else {
      requestBody = { ...data };
    }

    try {
      const r = await fetch(config.WEBHOOK_URL, {
        method: config.WEBHOOK_METHOD || 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      const text = await r.text().catch(() => '');
      return r.ok ? ok('webhook', text) : fail('webhook', `HTTP ${r.status}`, text);
    } catch (err) {
      return fail('webhook', errorMessage(err));
    }
  },

  async test(config) {
    return webhookChannel.send(
      { title: '订阅管理 - 测试通知', content: '这是一条 Webhook 测试通知。' },
      config
    );
  }
};

/** @deprecated 旧版兼容函数 */
export async function sendWebhookNotification(title, content, config, metadata = {}) {
  const r = await webhookChannel.send({ title, content, metadata }, config);
  if (!r.success) console.error('[Webhook]', r.error);
  return r.success;
}
