import { formatTimeInTimezone } from '../../core/time.js';

async function sendWebhookNotification(title, content, config, metadata = {}) {
  try {
    if (!config.WEBHOOK_URL) {
      console.error('[Webhook通知] 通知未配置，缺少URL');
      return false;
    }

    console.log('[Webhook通知] 开始发送通知到: ' + config.WEBHOOK_URL);

    let requestBody;
    let headers = { 'Content-Type': 'application/json' };

    if (config.WEBHOOK_HEADERS) {
      try {
        const customHeaders = JSON.parse(config.WEBHOOK_HEADERS);
        headers = { ...headers, ...customHeaders };
      } catch (error) {
        console.warn('[Webhook通知] 自定义请求头格式错误，使用默认请求头');
      }
    }

    const tagsArray = Array.isArray(metadata.tags)
      ? metadata.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0).map(tag => tag.trim())
      : [];
    const tagsBlock = tagsArray.length ? tagsArray.map(tag => `- ${tag}`).join('\n') : '';
    const tagsLine = tagsArray.length ? '标签：' + tagsArray.join('、') : '';
    const timestamp = formatTimeInTimezone(new Date(), config?.TIMEZONE || 'UTC', 'datetime');
    const formattedMessage = [title, content, tagsLine, `发送时间：${timestamp}`]
      .filter(section => section && section.trim().length > 0)
      .join('\n\n');

    const templateData = {
      title,
      content,
      tags: tagsBlock,
      tagsLine,
      rawTags: tagsArray,
      timestamp,
      formattedMessage,
      message: formattedMessage
    };

    const escapeForJson = (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      return JSON.stringify(String(value)).slice(1, -1);
    };

    const applyTemplate = (template, data) => {
      const templateString = JSON.stringify(template);
      const replaced = templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          return escapeForJson(data[key]);
        }
        return '';
      });
      return JSON.parse(replaced);
    };

    if (config.WEBHOOK_TEMPLATE) {
      try {
        const template = JSON.parse(config.WEBHOOK_TEMPLATE);
        requestBody = applyTemplate(template, templateData);
      } catch (error) {
        console.warn('[Webhook通知] 消息模板格式错误，使用默认格式');
        requestBody = {
          title,
          content,
          tags: tagsArray,
          tagsLine,
          timestamp,
          message: formattedMessage
        };
      }
    } else {
      requestBody = {
        title,
        content,
        tags: tagsArray,
        tagsLine,
        timestamp,
        message: formattedMessage
      };
    }

    const response = await fetch(config.WEBHOOK_URL, {
      method: config.WEBHOOK_METHOD || 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const result = await response.text();
    console.log('[Webhook通知] 发送结果:', response.status, result);
    return response.ok;
  } catch (error) {
    console.error('[Webhook通知] 发送通知失败:', error);
    return false;
  }
}

export { sendWebhookNotification };
