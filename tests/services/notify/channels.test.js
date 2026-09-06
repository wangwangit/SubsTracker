// @ts-check
/**
 * 通知渠道适配器单元测试
 *
 * 关键：用 vi.spyOn(global, 'fetch') mock fetch，确保不真实联网。
 * 重点覆盖：
 * - Telegram MarkdownV2 转义（修复 #81）
 * - 各渠道成功 / 失败路径
 * - dispatch 部分失败不抛异常 + 写日志
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @ts-ignore
import { env } from 'cloudflare:test';

import { escapeMarkdownV2 } from '../../../src/services/notify/channel.js';
import { telegramChannel } from '../../../src/services/notify/telegram.js';
import { notifyxChannel } from '../../../src/services/notify/notifyx.js';
import { barkChannel } from '../../../src/services/notify/bark.js';
import { wecomChannel } from '../../../src/services/notify/wechat.js';
import { gotifyChannel } from '../../../src/services/notify/gotify.js';
import { serverChanChannel } from '../../../src/services/notify/serverchan.js';
import { pushplusChannel } from '../../../src/services/notify/pushplus.js';
import { wpushChannel } from '../../../src/services/notify/wpush.js';
import { emailChannel } from '../../../src/services/notify/email.js';
import { webhookChannel } from '../../../src/services/notify/webhook.js';
import { dispatch, ALL_CHANNELS, testChannel } from '../../../src/services/notify/dispatch.js';
import { query } from '../../../src/data/notification-logs.repo.js';

/** 构造一个 Response */
function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

beforeEach(async () => {
  // 清空 KV
  const list = await env.SUBSCRIPTIONS_KV.list();
  await Promise.all(list.keys.map((k) => env.SUBSCRIPTIONS_KV.delete(k.name)));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('escapeMarkdownV2 (#81 修复)', () => {
  it('转义 _* 等 13 个字符', () => {
    expect(escapeMarkdownV2('a_b')).toBe('a\\_b');
    expect(escapeMarkdownV2('Adobe_Premiere_Pro')).toBe('Adobe\\_Premiere\\_Pro');
    expect(escapeMarkdownV2('a*b')).toBe('a\\*b');
    expect(escapeMarkdownV2('a.b!c')).toBe('a\\.b\\!c');
    expect(escapeMarkdownV2('a[b](c)')).toBe('a\\[b\\]\\(c\\)');
  });

  it('普通字符不动', () => {
    expect(escapeMarkdownV2('hello world 你好 123')).toBe('hello world 你好 123');
  });
});

describe('telegramChannel', () => {
  it('validateConfig：缺 token / chat_id 返回错误', () => {
    expect(telegramChannel.validateConfig({}).ok).toBe(false);
    expect(telegramChannel.validateConfig({ TG_BOT_TOKEN: 'x' }).ok).toBe(false);
    expect(telegramChannel.validateConfig({ TG_BOT_TOKEN: 'x', TG_CHAT_ID: 'y' }).ok).toBe(true);
  });

  it('send 含下划线名称会做 MarkdownV2 转义', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(url, init);
      return jsonResponse({ ok: true, result: {} });
    });

    const r = await telegramChannel.send(
      { title: 'Adobe_Premiere_Pro', content: '到期了!(明天)' },
      { TG_BOT_TOKEN: 'BOT', TG_CHAT_ID: 'CHAT' }
    );
    expect(r.success).toBe(true);

    const [, init] = captured.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.parse_mode).toBe('MarkdownV2');
    expect(body.text).toContain('Adobe\\_Premiere\\_Pro');
    expect(body.text).toContain('\\(明天\\)');
    expect(body.text).toContain('\\!');
  });

  it('MarkdownV2 失败时降级纯文本兜底', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call++;
      if (call === 1) {
        return jsonResponse({ ok: false, description: "can't parse entities: invalid" });
      }
      return jsonResponse({ ok: true, result: { message_id: 42 } });
    });

    const r = await telegramChannel.send(
      { title: 'X', content: 'Y' },
      { TG_BOT_TOKEN: 'BOT', TG_CHAT_ID: 'CHAT' }
    );
    expect(r.success).toBe(true);
    expect(call).toBe(2);
  });

  it('Telegram API 拒绝 → 返回失败', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, description: 'chat not found' })
    );
    const r = await telegramChannel.send(
      { title: 'X', content: 'Y' },
      { TG_BOT_TOKEN: 'BOT', TG_CHAT_ID: 'CHAT' }
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('chat not found');
  });

  it('网络异常 → 返回失败', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));
    const r = await telegramChannel.send(
      { title: 'X', content: 'Y' },
      { TG_BOT_TOKEN: 'BOT', TG_CHAT_ID: 'CHAT' }
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('network down');
  });
});

describe('其它渠道 happy path', () => {
  /** @type {Array<[string, any, any, any]>} */
  const cases = [
    ['notifyx', notifyxChannel, { NOTIFYX_API_KEY: 'k' }, { status: 'queued' }],
    ['gotify', gotifyChannel, { GOTIFY_SERVER_URL: 'http://g.example', GOTIFY_APP_TOKEN: 't' }, { id: 1 }],
    ['serverchan', serverChanChannel, { SERVERCHAN_SENDKEY: 'k' }, { code: 0 }],
    ['pushplus', pushplusChannel, { PUSHPLUS_TOKEN: 'k' }, { code: 200 }],
    ['bark', barkChannel, { BARK_DEVICE_KEY: 'k', BARK_SERVER: 'https://api.day.app' }, { code: 200 }],
    ['email', emailChannel, { RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.com', EMAIL_TO: 'c@d.com' }, { id: 'x' }],
    ['webhook', webhookChannel, { WEBHOOK_URL: 'https://x.example' }, { ok: true }],
    [
      'wechatbot',
      wecomChannel,
      { WECHATBOT_WEBHOOK: 'https://qyapi.example/x' },
      { errcode: 0 }
    ]
  ];

  cases.forEach(([name, ch, config, body]) => {
    it(`${name} 成功`, async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(body));
      const r = await ch.send({ title: '测试', content: '内容' }, config);
      expect(r.success).toBe(true);
      expect(r.channel).toBe(name);
    });

    it(`${name} 配置缺失 → 直接失败`, async () => {
      const r = await ch.send({ title: '测试', content: '内容' }, {});
      expect(r.success).toBe(false);
    });
  });
});

describe('barkChannel 自定义服务器 URL', () => {
  it('BARK_SERVER 含路径 → 直接 POST 全 URL', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      captured(url);
      return jsonResponse({ code: 200 });
    });
    const r = await barkChannel.send(
      { title: 'T', content: 'C' },
      { BARK_SERVER: 'https://my-bark.example/MYKEY' }
    );
    expect(r.success).toBe(true);
    expect(captured.mock.calls[0][0]).toBe('https://my-bark.example/MYKEY');
  });

  it('BARK_SERVER 无路径 → 拼 /push + device_key', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(url, init);
      return jsonResponse({ code: 200 });
    });
    await barkChannel.send(
      { title: 'T', content: 'C' },
      { BARK_SERVER: 'https://api.day.app', BARK_DEVICE_KEY: 'KKK' }
    );
    expect(captured.mock.calls[0][0]).toBe('https://api.day.app/push');
    const body = JSON.parse(captured.mock.calls[0][1].body);
    expect(body.device_key).toBe('KKK');
  });

  it('BARK_SERVER 含 user:pass → 发送 Basic Auth header', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(url, init);
      return jsonResponse({ code: 200 });
    });
    const r = await barkChannel.send(
      { title: 'T', content: 'C' },
      { BARK_SERVER: 'https://admin:p%40ss@my-bark.example/MYKEY' }
    );
    expect(r.success).toBe(true);
    expect(captured.mock.calls[0][0]).toBe('https://my-bark.example/MYKEY');
    const headers = captured.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe(`Basic ${btoa('admin:p@ss')}`);
  });
});

describe('webhookChannel 模板', () => {
  it('应用 {{title}} {{content}} 模板', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(init);
      return new Response('ok', { status: 200 });
    });

    await webhookChannel.send(
      { title: '到期', content: 'Netflix 即将到期', metadata: { tags: ['会员', '月度'] } },
      {
        WEBHOOK_URL: 'https://x.example',
        WEBHOOK_TEMPLATE: JSON.stringify({ msg: '{{title}}: {{content}}', tags: '{{tagsLine}}' })
      }
    );

    const body = JSON.parse(captured.mock.calls[0][0].body);
    expect(body.msg).toBe('到期: Netflix 即将到期');
    expect(body.tags).toBe('标签：会员、月度');
  });

  it('模板格式错误 → 退回默认结构', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(init);
      return new Response('ok', { status: 200 });
    });

    await webhookChannel.send(
      { title: 'T', content: 'C' },
      { WEBHOOK_URL: 'https://x.example', WEBHOOK_TEMPLATE: '{ this is not valid json' }
    );

    const body = JSON.parse(captured.mock.calls[0][0].body);
    expect(body.title).toBe('T');
    expect(body.content).toBe('C');
  });
});

describe('dispatch（多渠道并发 + 日志）', () => {
  it('未启用任何渠道 → 直接返回 0', async () => {
    const r = await dispatch(
      { title: 'T', content: 'C' },
      { ENABLED_NOTIFIERS: [] }
    );
    expect(r.attempted).toBe(0);
  });

  it('部分渠道失败 → 整体不抛，结果数组完整', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call++;
      if (call === 1) return jsonResponse({ ok: true, result: {} });          // telegram OK
      if (call === 2) return jsonResponse({ status: 'queued' });               // notifyx OK
      throw new Error('webhook 网络故障');                                      // webhook 抛
    });

    const config = {
      ENABLED_NOTIFIERS: ['telegram', 'notifyx', 'webhook'],
      TG_BOT_TOKEN: 'B',
      TG_CHAT_ID: 'C',
      NOTIFYX_API_KEY: 'K',
      WEBHOOK_URL: 'https://x.example'
    };

    const r = await dispatch({ title: 'T', content: 'C' }, config);
    expect(r.attempted).toBe(3);
    expect(r.successCount).toBe(2);
    expect(r.failedCount).toBe(1);
    expect(r.channelResults.telegram).toBe(true);
    expect(r.channelResults.notifyx).toBe(true);
    expect(r.channelResults.webhook).toBe(false);
  });

  it('带 env + subId 时把每条结果写入 notify_log', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, result: {} }));
    const config = {
      ENABLED_NOTIFIERS: ['telegram'],
      TG_BOT_TOKEN: 'B',
      TG_CHAT_ID: 'C'
    };
    await dispatch(
      { title: 'T', content: 'C' },
      config,
      { env, subId: 'sub-x', ruleId: 'rule-y' }
    );

    const logs = await query(env, { subId: 'sub-x' });
    expect(logs).toHaveLength(1);
    expect(logs[0].channel).toBe('telegram');
    expect(logs[0].status).toBe('success');
    expect(logs[0].ruleId).toBe('rule-y');
  });
});

describe('testChannel', () => {
  it('未知渠道返回失败', async () => {
    const r = await testChannel('unknown', {});
    expect(r.success).toBe(false);
    expect(r.error).toContain('未知渠道');
  });

  it('已知渠道走 channel.test()', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, result: {} }));
    const r = await testChannel('telegram', { TG_BOT_TOKEN: 'B', TG_CHAT_ID: 'C' });
    expect(r.success).toBe(true);
    expect(r.channel).toBe('telegram');
  });
});

describe('注册表完整性', () => {
  it('ALL_CHANNELS 包含 11 个渠道', () => {
    expect(Object.keys(ALL_CHANNELS).sort()).toEqual(
      ['bark', 'email', 'gotify', 'notifyx', 'ntfy', 'pushplus', 'serverchan', 'telegram', 'webhook', 'wechatbot', 'wpush'].sort()
    );
  });

  it('每个渠道都有 4 个必备字段', () => {
    for (const [name, ch] of Object.entries(ALL_CHANNELS)) {
      expect(ch.name).toBe(name);
      expect(typeof ch.validateConfig).toBe('function');
      expect(typeof ch.send).toBe('function');
      expect(typeof ch.test).toBe('function');
    }
  });
});


import { ntfyChannel } from '../../../src/services/notify/ntfy.js';

describe('ntfyChannel', () => {
  it('validateConfig：缺 topic 失败', () => {
    expect(ntfyChannel.validateConfig({}).ok).toBe(false);
  });

  it('send 成功路径', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      expect(String(url)).toContain('https://ntfy.sh/my-topic');
      expect(init.method).toBe('POST');
      expect(init.headers.Title).toBeTruthy();
      return { ok: true, json: async () => ({ id: '1' }), text: async () => '' };
    };
    try {
      const r = await ntfyChannel.send(
        { title: 't', content: 'c' },
        { NTFY_SERVER: 'https://ntfy.sh', NTFY_TOPIC: 'my-topic' }
      );
      expect(r.success).toBe(true);
      expect(r.channel).toBe('ntfy');
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('wpushChannel', () => {
  it('validateConfig：缺 apikey 失败', () => {
    expect(wpushChannel.validateConfig({}).ok).toBe(false);
    expect(wpushChannel.validateConfig({ WPUSH_APIKEY: '  ' }).ok).toBe(false);
    expect(wpushChannel.validateConfig({ WPUSH_APIKEY: 'WPUSHkey' }).ok).toBe(true);
  });

  it('send 成功路径：code===0，可选 channel/topic_code', async () => {
    const captured = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      captured(url, init);
      return jsonResponse({ code: 0, message: 'ok' });
    });

    const r = await wpushChannel.send(
      { title: '标题', content: '正文' },
      { WPUSH_APIKEY: 'WPUSHsecret', WPUSH_CHANNEL: 'feishu', WPUSH_TOPIC_CODE: 'topic-1' }
    );
    expect(r.success).toBe(true);
    expect(r.channel).toBe('wpush');
    expect(captured.mock.calls[0][0]).toBe('https://api.wpush.cn/api/v1/send');
    const body = JSON.parse(captured.mock.calls[0][1].body);
    expect(body).toEqual({
      apikey: 'WPUSHsecret',
      title: '标题',
      content: '正文',
      channel: 'feishu',
      topic_code: 'topic-1'
    });
  });

  it('send：code!==0 → 失败，且错误信息不含 apikey', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 40001, message: 'invalid key' })
    );
    const r = await wpushChannel.send(
      { title: 'T', content: 'C' },
      { WPUSH_APIKEY: 'WPUSHshould-not-leak' }
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('40001');
    expect(r.error).not.toContain('WPUSHshould-not-leak');
  });

  it('配置缺失 → 直接失败', async () => {
    const r = await wpushChannel.send({ title: 'T', content: 'C' }, {});
    expect(r.success).toBe(false);
  });
});
