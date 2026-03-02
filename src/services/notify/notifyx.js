async function sendNotifyXNotification(title, content, description, config) {
  try {
    if (!config.NOTIFYX_API_KEY) {
      console.error('[NotifyX] 通知未配置，缺少API Key');
      return false;
    }

    console.log('[NotifyX] 开始发送通知: ' + title);

    const url = 'https://www.notifyx.cn/api/v1/send/' + config.NOTIFYX_API_KEY;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: content,
        description: description || ''
      })
    });

    const result = await response.json();
    console.log('[NotifyX] 发送结果:', result);
    return result.status === 'queued';
  } catch (error) {
    console.error('[NotifyX] 发送通知失败:', error);
    return false;
  }
}

export { sendNotifyXNotification };
