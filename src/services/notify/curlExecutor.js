function parseCurlCommand(curlCommand) {
  const cmd = curlCommand.trim();
  if (!cmd.toLowerCase().startsWith('curl')) {
    return null;
  }

  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: null
  };

  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 3; i < cmd.length; i++) {
    const char = cmd[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
      current += char;
      continue;
    }

    if (char === ' ' && !inQuote) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }

  let urlFound = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lowerToken = token.toLowerCase();

    if (lowerToken === '-x' || lowerToken === '--request') {
      if (i + 1 < tokens.length) {
        result.method = tokens[i + 1].toUpperCase();
        i++;
      }
      continue;
    }

    if (lowerToken === '-h' || lowerToken === '--header') {
      if (i + 1 < tokens.length) {
        let header = tokens[i + 1];
        if ((header.startsWith("'") && header.endsWith("'")) || (header.startsWith('"') && header.endsWith('"')) || (header.startsWith('`') && header.endsWith('`'))) {
          header = header.slice(1, -1);
        }
        const colonIndex = header.indexOf(':');
        if (colonIndex > 0) {
          const headerName = header.substring(0, colonIndex).trim();
          const headerValue = header.substring(colonIndex + 1).trim();
          result.headers[headerName] = headerValue;
        }
        i++;
      }
      continue;
    }

    if (lowerToken === '-d' || lowerToken === '--data' || lowerToken === '--data-raw') {
      if (i + 1 < tokens.length) {
        let data = tokens[i + 1];
        if ((data.startsWith('"') && data.endsWith('"')) || (data.startsWith("'") && data.endsWith("'"))) {
          data = data.slice(1, -1);
        }
        result.body = data;
        i++;
      }
      continue;
    }

    if (lowerToken === '-u' || lowerToken === '--user') {
      if (i + 1 < tokens.length) {
        const credentials = tokens[i + 1];
        result.headers['Authorization'] = 'Basic ' + btoa(credentials);
        i++;
      }
      continue;
    }

    if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith("'http") || token.startsWith('"http') || token.startsWith("'https") || token.startsWith('"https') || token.startsWith('`http') || token.startsWith('`https')) {
      let url = token;
      if ((url.startsWith("'") && url.endsWith("'")) || (url.startsWith('"') && url.endsWith('"')) || (url.startsWith('`') && url.endsWith('`'))) {
        url = url.slice(1, -1);
      }
      result.url = url;
      urlFound = true;
    }
  }

  if (!urlFound && tokens.length > 0) {
    for (const token of tokens) {
      if (token.startsWith('http://') || token.startsWith('https://')) {
        let url = token;
        if ((url.startsWith("'") && url.endsWith("'")) || (url.startsWith('"') && url.endsWith('"')) || (url.startsWith('`') && url.endsWith('`'))) {
          url = url.slice(1, -1);
        }
        result.url = url;
        break;
      }
    }
  }

  return result.url ? result : null;
}

async function executeWebhook(curlCommand, metadata = {}) {
  const result = {
    success: false,
    url: '',
    method: 'GET',
    statusCode: null,
    responseBody: null,
    error: null,
    executionTime: 0
  };

  if (!curlCommand || typeof curlCommand !== 'string') {
    result.error = 'Webhook command is empty or invalid';
    return result;
  }

  const parsed = parseCurlCommand(curlCommand);
  if (!parsed) {
    result.error = 'Failed to parse cURL command: parseCurlCommand returned null';
    return result;
  }
  if (!parsed.url) {
    result.error = 'Failed to parse cURL command: URL not found in command';
    return result;
  }

  result.url = parsed.url;
  result.method = parsed.method;

  console.log('[curlExecutor] Parsed request:', JSON.stringify({
    url: result.url,
    method: result.method,
    headers: parsed.headers,
    body: parsed.body ? '(body present)' : null
  }));

  const startTime = Date.now();

  try {
    const options = {
      method: parsed.method,
      headers: parsed.headers
    };

    if (parsed.body) {
      options.body = parsed.body;
    }

    const response = await fetch(parsed.url, options);
    result.statusCode = response.status;

    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        result.responseBody = await response.json();
      } else {
        result.responseBody = await response.text();
      }
    } catch (e) {
      result.responseBody = await response.text();
    }

    result.success = response.ok;
    result.executionTime = Date.now() - startTime;

    return result;
  } catch (error) {
    console.error('[curlExecutor] fetch error:', error);
    result.error = error.message || error.toString() || 'Request failed';
    result.executionTime = Date.now() - startTime;
    return result;
  }
}

async function executeSubscriptionWebhook(subscription, metadata = {}) {
  if (!subscription.webhookUrl) {
    return { success: true, skipped: true, message: 'No webhook configured' };
  }

  const webhookResult = await executeWebhook(subscription.webhookUrl, {
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    ...metadata
  });

  return webhookResult;
}

export { parseCurlCommand, executeWebhook, executeSubscriptionWebhook };