import { getConfig } from '../data/config.js';

async function handleDebug(request, env) {
  try {
    const url = new URL(request.url);
    const config = await getConfig(env);
    const debugInfo = {
      timestamp: new Date().toISOString(),
      pathname: url.pathname,
      kvBinding: !!env.SUBSCRIPTIONS_KV,
      configExists: !!config,
      adminUsername: config.ADMIN_USERNAME,
      hasJwtSecret: !!config.JWT_SECRET,
      jwtSecretLength: config.JWT_SECRET ? config.JWT_SECRET.length : 0
    };

    return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>调试信息</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #f5f5f5; }
    .info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .success { color: green; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>系统调试信息</h1>
  <div class="info">
    <h3>基本信息</h3>
    <p>时间: ${debugInfo.timestamp}</p>
    <p>路径: ${debugInfo.pathname}</p>
    <p class="${debugInfo.kvBinding ? 'success' : 'error'}">KV绑定: ${debugInfo.kvBinding ? '✓' : '✗'}</p>
  </div>

  <div class="info">
    <h3>配置信息</h3>
    <p class="${debugInfo.configExists ? 'success' : 'error'}">配置存在: ${debugInfo.configExists ? '✓' : '✗'}</p>
    <p>管理员用户名: ${debugInfo.adminUsername}</p>
    <p class="${debugInfo.hasJwtSecret ? 'success' : 'error'}">JWT密钥: ${debugInfo.hasJwtSecret ? '✓' : '✗'} (长度: ${debugInfo.jwtSecretLength})</p>
  </div>

  <div class="info">
    <h3>解决方案</h3>
    <p>1. 确保KV命名空间已正确绑定为 SUBSCRIPTIONS_KV</p>
    <p>2. 尝试访问 <a href="/">/</a> 进行登录</p>
    <p>3. 如果仍有问题，请检查Cloudflare Workers日志</p>
  </div>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    return new Response(`调试页面错误: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

export { handleDebug };
