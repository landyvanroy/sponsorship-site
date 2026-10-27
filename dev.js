// dev.js — 零依赖本地开发服务器：服务 dist/，监听 src/ 变化自动重建
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  let target = file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  const notFound = !fs.existsSync(target);
  if (notFound) target = path.join(DIST, '404.html');

  const ext = path.extname(target).toLowerCase();
  res.writeHead(notFound ? 404 : 200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    // dev 服务器禁用缓存：src 变更重建后，浏览器必须立刻拿到新产物
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(target).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[dev] serving dist/ at http://localhost:${PORT}`);
});

// 监听 src/ 变化 → 防抖重建
let timer = null;
let building = false;
fs.watch(path.join(ROOT, 'src'), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
});

function rebuild() {
  if (building) return;
  building = true;
  console.log('[dev] change detected → rebuilding...');
  const child = spawn(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  child.on('exit', (code) => {
    building = false;
    if (code !== 0) console.error('[dev] build failed');
  });
}
