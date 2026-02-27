async function getKVJson(env, key, defaultValue = null) {
  const raw = await env.SUBSCRIPTIONS_KV.get(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[KV] 解析 ${key} 失败:`, error);
    return defaultValue;
  }
}

async function putKVJson(env, key, value) {
  await env.SUBSCRIPTIONS_KV.put(key, JSON.stringify(value));
}

export { getKVJson, putKVJson };
