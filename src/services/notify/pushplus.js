async function sendPushPlusNotification(title, content, config) {
  try {
    if (!config.PUSHPLUS_TOKEN) {
      console.error('[PushPlus] 通知未配置，缺少Token');
      return false;
    }

    console.log('[PushPlus] 开始发送通知: ' + title);

    const payload = {
      token: config.PUSHPLUS_TOKEN,
      title,
      content: `## ${title}\n\n${content}`,
      template: 'markdown'
    };

    if (config.PUSHPLUS_TOPIC) {
      payload.topic = config.PUSHPLUS_TOPIC;
    }

    if (config.PUSHPLUS_CHANNEL) {
      payload.channel = config.PUSHPLUS_CHANNEL;
    }

    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('[PushPlus] 发送结果:', result);
    return result.code === 200;
  } catch (error) {
    console.error('[PushPlus] 发送通知失败:', error);
    return false;
  }
}

export { sendPushPlusNotification };
