import { parseCurlCommand, executeWebhook } from '../../services/notify/curlExecutor.js';

async function handleTestWebhook(request, env) {
  try {
    const body = await request.json();
    const curlCommand = typeof body.curl === 'string' ? body.curl.trim() : '';

    if (!curlCommand) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少 curl 参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsed = parseCurlCommand(curlCommand);
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, message: 'cURL 命令解析失败，请检查格式是否正确' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!parsed.url) {
      return new Response(
        JSON.stringify({ success: false, message: '未能在 cURL 命令中找到 URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = await executeWebhook(curlCommand);
    } catch (execError) {
      console.error('[TestWebhook] executeWebhook 异常:', execError);
      return new Response(
        JSON.stringify({ success: false, message: '执行请求时异常: ' + (execError.message || String(execError)) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `请求成功，状态码: ${result.statusCode}`,
          details: {
            url: result.url,
            method: result.method,
            headers: parsed.headers,
            statusCode: result.statusCode,
            responseBody: typeof result.responseBody === 'string'
              ? result.responseBody.substring(0, 500)
              : result.responseBody,
            executionTime: result.executionTime + 'ms'
          }
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const errorMessage = result.error || (result.statusCode ? `HTTP ${result.statusCode}` : '未知错误');
      return new Response(
        JSON.stringify({
          success: false,
          message: '请求失败: ' + errorMessage,
          details: {
            url: result.url,
            method: result.method,
            headers: parsed.headers,
            statusCode: result.statusCode,
            error: result.error,
            executionTime: result.executionTime + 'ms'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[TestWebhook] handleTestWebhook 异常:', error);
    return new Response(
      JSON.stringify({ success: false, message: '测试失败: ' + (error.message || String(error)) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { handleTestWebhook };