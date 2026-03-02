async function sendWechatBotNotification(title, content, config) {
  try {
    if (!config.WECHATBOT_WEBHOOK) {
      console.error('[企业微信机器人] 通知未配置，缺少Webhook URL');
      return false;
    }

    console.log('[企业微信机器人] 开始发送通知到: ' + config.WECHATBOT_WEBHOOK);

    let messageData;
    const msgType = config.WECHATBOT_MSG_TYPE || 'text';

    if (msgType === 'markdown') {
      const markdownContent = `# ${title}\n\n${content}`;
      messageData = {
        msgtype: 'markdown',
        markdown: { content: markdownContent }
      };
    } else {
      const textContent = `${title}\n\n${content}`;
      messageData = {
        msgtype: 'text',
        text: { content: textContent }
      };
    }

    if (config.WECHATBOT_AT_ALL === 'true') {
      if (msgType === 'text') {
        messageData.text.mentioned_list = ['@all'];
      }
    } else if (config.WECHATBOT_AT_MOBILES) {
      const mobiles = config.WECHATBOT_AT_MOBILES.split(',').map(m => m.trim()).filter(m => m);
      if (mobiles.length > 0) {
        if (msgType === 'text') {
          messageData.text.mentioned_mobile_list = mobiles;
        }
      }
    }

    console.log('[企业微信机器人] 发送消息数据:', JSON.stringify(messageData, null, 2));

    const response = await fetch(config.WECHATBOT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    const responseText = await response.text();
    console.log('[企业微信机器人] 响应状态:', response.status);
    console.log('[企业微信机器人] 响应内容:', responseText);

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        if (result.errcode === 0) {
          console.log('[企业微信机器人] 通知发送成功');
          return true;
        } else {
          console.error('[企业微信机器人] 发送失败，错误码:', result.errcode, '错误信息:', result.errmsg);
          return false;
        }
      } catch (parseError) {
        console.error('[企业微信机器人] 解析响应失败:', parseError);
        return false;
      }
    } else {
      console.error('[企业微信机器人] HTTP请求失败，状态码:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[企业微信机器人] 发送通知失败:', error);
    return false;
  }
}

export { sendWechatBotNotification };
