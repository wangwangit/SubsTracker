import { generateJWT, verifyJWT } from '../../core/auth.js';
import { getConfig } from '../../data/config.js';
import { getCookieValue } from '../utils.js';

async function handleLogin(request, env) {
  const config = await getConfig(env);
  const body = await request.json();

  if (body.username === config.ADMIN_USERNAME && body.password === config.ADMIN_PASSWORD) {
    const token = await generateJWT(body.username, config.JWT_SECRET);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'token=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400'
        }
      }
    );
  }

  return new Response(
    JSON.stringify({ success: false, message: '用户名或密码错误' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

function handleLogout() {
  return new Response('', {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
    }
  });
}

async function getUserFromRequest(request, env) {
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const config = await getConfig(env);
  const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;
  return { user, config };
}

export { handleLogin, handleLogout, getUserFromRequest };
