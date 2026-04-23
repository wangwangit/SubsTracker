async function sendServerChanNotification(title, content, config) {
  try {
    if (!config.SERVERCHAN_SENDKEY) {
      console.error('[Server酱] 通知未配置，缺少SendKey');
      return false;
    }

    console.log('[Server酱] 开始发送通知: ' + title);

    const endpoint = 'https://sctapi.ftqq.com/' + config.SERVERCHAN_SENDKEY + '.send';
    const body = new URLSearchParams({
      title,
      desp: `## ${title}\n\n${content}`
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const result = await response.json();
    console.log('[Server酱] 发送结果:', result);
    return result.code === 0;
  } catch (error) {
    console.error('[Server酱] 发送通知失败:', error);
    return false;
  }
}

export { sendServerChanNotification };
