import { sendNotifyXNotification } from './notifyx.js';
import { sendTelegramNotification } from './telegram.js';
import { sendWebhookNotification } from './webhook.js';
import { sendWechatBotNotification } from './wechat.js';
import { sendEmailNotification } from './email.js';
import { sendBarkNotification } from './bark.js';

async function sendNotificationToAllChannels(title, commonContent, config, logPrefix = '[定时任务]', options = {}) {
  const metadata = options.metadata || {};
  const enabledNotifiers = Array.isArray(config.ENABLED_NOTIFIERS) ? config.ENABLED_NOTIFIERS : [];
  const result = {
    attempted: 0,
    successCount: 0,
    failedCount: 0,
    channelResults: {}
  };

  if (enabledNotifiers.length === 0) {
    console.log(`${logPrefix} 未启用任何通知渠道。`);
    return result;
  }

  if (enabledNotifiers.includes('notifyx')) {
    result.attempted += 1;
    const notifyxContent = `## ${title}\n\n${commonContent}`;
    const success = await sendNotifyXNotification(title, notifyxContent, `订阅提醒`, config);
    result.channelResults.notifyx = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送NotifyX通知 ${success ? '成功' : '失败'}`);
  }
  if (enabledNotifiers.includes('telegram')) {
    result.attempted += 1;
    const telegramContent = `*${title}*\n\n${commonContent}`;
    const success = await sendTelegramNotification(telegramContent, config);
    result.channelResults.telegram = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送Telegram通知 ${success ? '成功' : '失败'}`);
  }
  if (enabledNotifiers.includes('webhook')) {
    result.attempted += 1;
    const webhookContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
    const success = await sendWebhookNotification(title, webhookContent, config, metadata);
    result.channelResults.webhook = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送Webhook通知 ${success ? '成功' : '失败'}`);
  }
  if (enabledNotifiers.includes('wechatbot')) {
    result.attempted += 1;
    const wechatbotContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
    const success = await sendWechatBotNotification(title, wechatbotContent, config);
    result.channelResults.wechatbot = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送企业微信机器人通知 ${success ? '成功' : '失败'}`);
  }
  if (enabledNotifiers.includes('email')) {
    result.attempted += 1;
    const emailContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
    const success = await sendEmailNotification(title, emailContent, config);
    result.channelResults.email = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送邮件通知 ${success ? '成功' : '失败'}`);
  }
  if (enabledNotifiers.includes('bark')) {
    result.attempted += 1;
    const barkContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
    const success = await sendBarkNotification(title, barkContent, config);
    result.channelResults.bark = success;
    success ? result.successCount++ : result.failedCount++;
    console.log(`${logPrefix} 发送Bark通知 ${success ? '成功' : '失败'}`);
  }

  return result;
}

export {
  sendNotificationToAllChannels
};
