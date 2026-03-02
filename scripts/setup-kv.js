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
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [];
}

function ensureNamespace(title) {
  let namespaces = listNamespaces();
  let found = namespaces.find(ns => ns.title === title);
  if (found && found.id) return found;

  console.log(`[setup-kv] Namespace ${title} 不存在，开始创建...`);
  run(`npx wrangler kv namespace create ${title}`);

  namespaces = listNamespaces();
  found = namespaces.find(ns => ns.title === title);
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
    preview = namespaces.find(ns => ns.title === name);
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
