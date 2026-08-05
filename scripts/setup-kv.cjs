#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const WRANGLER_TOML = path.join(ROOT, 'wrangler.toml');
const PROD_TITLE = 'SUBSCRIPTIONS_KV';
const PREVIEW_TITLE_CANDIDATES = ['SUBSCRIPTIONS_KV_PREVIEW', 'SUBSCRIPTIONS_KV_preview'];

function run(command) {
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function listNamespaces() {
  const output = run('npx wrangler kv namespace list');
  const start = output.indexOf('[');
  const parsed = start === -1 ? [] : JSON.parse(output.slice(start));
  return Array.isArray(parsed) ? parsed : [];
}

function readWorkerName() {
  const content = fs.readFileSync(WRANGLER_TOML, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (/^\s*\[/.test(line)) break;

    const match = line.match(/^\s*name\s*=\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*(?:#.*)?$/);
    if (match) return match[1] || match[2] || match[3];
  }

  return null;
}

function namespaceTitlesFor(title) {
  const workerName = readWorkerName();
  return workerName ? [title, `${workerName}-${title}`] : [title];
}

function findNamespace(namespaces, title) {
  const expectedTitles = namespaceTitlesFor(title);
  return namespaces.find(ns => expectedTitles.includes(ns.title));
}

function ensureNamespace(title) {
  let namespaces = listNamespaces();
  // Wrangler 会用项目名作为 namespace title 前缀；只匹配当前项目，避免误用其他 Worker 的同名 binding。
  let found = findNamespace(namespaces, title);
  if (found && found.id) return found;

  console.log(`[setup-kv] Namespace ${title} 不存在，开始创建...`);
  run(`npx wrangler kv namespace create ${title}`);

  namespaces = listNamespaces();
  found = findNamespace(namespaces, title);
  if (!found || !found.id) {
    throw new Error(`创建失败：未找到 namespace ${title}`);
  }
  return found;
}

function updateWranglerToml(prodId, previewId) {
  let content = fs.readFileSync(WRANGLER_TOML, 'utf8');

  content = content.replace(/\n# KV 命名空间配置（自动生成）[\s\S]*?(?=\n# 环境变量|\n\[vars\]|\n# 定时任务配置|\n\[triggers\]|$)/m, '\n');
  content = content.replace(/\n\[\[kv_namespaces\]\][\s\S]*?(?=\n\[|\n#|$)/g, '\n');

  const kvBlock = `\n# KV 命名空间配置（自动生成）\n[[kv_namespaces]]\nbinding = "SUBSCRIPTIONS_KV"\nid = "${prodId}"\npreview_id = "${previewId}"\n`;

  if (content.includes('\n[triggers]')) {
    content = content.replace('\n[triggers]', `${kvBlock}\n[triggers]`);
  } else {
    content = `${content.trimEnd()}\n${kvBlock}\n`;
  }

  fs.writeFileSync(WRANGLER_TOML, content, 'utf8');
}

function main() {
  if (!fs.existsSync(WRANGLER_TOML)) {
    throw new Error('未找到 wrangler.toml，请在项目根目录执行');
  }

  const prod = ensureNamespace(PROD_TITLE);

  let preview = null;
  const namespaces = listNamespaces();
  for (const name of PREVIEW_TITLE_CANDIDATES) {
    preview = findNamespace(namespaces, name);
    if (preview && preview.id) break;
  }
  if (!preview || !preview.id) {
    preview = ensureNamespace('SUBSCRIPTIONS_KV_PREVIEW');
  }

  updateWranglerToml(prod.id, preview.id);

  console.log('[setup-kv] 完成 ✅');
  console.log(`[setup-kv] SUBSCRIPTIONS_KV: ${prod.id}`);
  console.log(`[setup-kv] SUBSCRIPTIONS_KV_PREVIEW: ${preview.id}`);
  console.log('[setup-kv] 已更新 wrangler.toml');
}

try {
  main();
} catch (error) {
  console.error('[setup-kv] 失败:', error.message || error);
  process.exit(1);
}
