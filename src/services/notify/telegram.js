function escapeMarkdownV2(text = '') {
  return String(text).replace(/([_\*\[\]\(\)~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendTelegramNotification(message, config) {
  try {
    if (!config.TG_BOT_TOKEN || !config.TG_CHAT_ID) {
      console.error('[Telegram] 通知未配置，缺少Bot Token或Chat ID');
      return false;
    }

    console.log('[Telegram] 开始发送通知到 Chat ID: ' + config.TG_CHAT_ID);

    const url = 'https://api.telegram.org/bot' + config.TG_BOT_TOKEN + '/sendMessage';
    const escapedMessage = escapeMarkdownV2(message);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.TG_CHAT_ID,
        text: escapedMessage,
        parse_mode: 'MarkdownV2'
      })
    });

    const result = await response.json();

    // 兜底：如果 MarkdownV2 仍失败，降级纯文本再发一次
    if (!result.ok && result.description && result.description.includes('parse entities')) {
      const fallbackResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.TG_CHAT_ID,
          text: String(message)
        })
      });
      const fallbackResult = await fallbackResponse.json();
      console.log('[Telegram] 发送结果(纯文本兜底):', fallbackResult);
      return fallbackResult.ok;
    }

    console.log('[Telegram] 发送结果:', result);
    return result.ok;
  } catch (error) {
    console.error('[Telegram] 发送通知失败:', error);
    return false;
  }
}

export { sendTelegramNotification, escapeMarkdownV2 };
