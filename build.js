// build.js — 纯静态构建流水线
// 内容(JSON/MD) + 组件(React JSX) → dist/ 纯静态产物 + 按页面用字动态子集化的中文字体
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import subsetFont from 'subset-font';
import esbuild from 'esbuild';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEVTOOLS = process.argv.includes('--devtools');
const DIST = path.join(ROOT, 'dist');
const FONT_SOURCE = path.join(ROOT, 'fonts/source/source-font.ttf');
const FONT_FAMILY = 'KingHwaOldSong';
const FONT_OUT_BASE = 'kinghwa-oldsong-subset';

// SSG 入口：esbuild 打包 React 组件树（JSX → JS），产物落 node_modules 缓存供 dynamic import
const SSR_ENTRY = path.join(ROOT, 'src/app/entry-server.jsx');
const SSR_BUNDLE = path.join(ROOT, 'node_modules/.cache/sponsorship-site/entry-server.mjs');

// 码点基线：可打印 ASCII + 常用中文标点，防止动态内容缺字
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(33 + i)).join('');
const CJK_PUNCT = '，。、；：？！（）《》〈〉【】「」『』…—·～“”‘’';
const BASE_CHARS = ASCII + ' ' + CJK_PUNCT;

const HEADERS = `# Cache policy (Cloudflare Pages)
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/
  Cache-Control: public, max-age=0, must-revalidate
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });

  // ---- 1. 载入内容 ----
  const site = readJson('src/content/site.json');

  const ctx = { site };

  // ---- 3. 打包并载入 SSG 渲染入口 ----
  const { renderPage } = await bundleSSR();

  // ---- 4. 渲染首页 ----
  render(renderPage, 'index', 'index.html', {
    ...ctx,
    title: site.title,
  });

  render(renderPage, '404', '404.html', { ...ctx, title: `页面不存在 · ${site.title}` });

  // ---- 5. 拷贝静态资产 ----
  copyDir(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'));

  // ---- 5.1 拷贝页面级样式：src/app/pages/*.css → dist/assets/css/pages/ ----
  copyPageCss();

  // ---- 5.2 Tailwind CSS：CLI 编译 src/app/styles/tailwind.css → dist/assets/css/tailwind.css ----
  buildTailwindCss();

  // ---- 5.5 仅 dev：注入 React DevTools 客户端运行时（--devtools） ----
  if (DEVTOOLS) await bundleDevtoolsClient();

  // ---- 6. 从渲染产物收集全部码点（「动态打包」的依据） ----
  const text = collectCodepoints(DIST);

  // ---- 7. 单次字体子集化：33MB TTF → 仅含页面用字的 woff2 ----
  const hasFont = fs.existsSync(FONT_SOURCE);
  if (!hasFont && process.env.CI) {
    throw new Error('source font missing in CI — check the R2 fetch step / secrets');
  }
  let fontFile = null;
  let fontSize = 0;
  if (hasFont) {
    const ttf = fs.readFileSync(FONT_SOURCE);
    const woff2 = await subsetFont(ttf, text, { targetFormat: 'woff2' });
    // 文件名带内容短哈希：内容变化 → 新文件名，配合 immutable 缓存永不失效
    const hash = crypto.createHash('md5').update(woff2).digest('hex').slice(0, 8);
    fontFile = `${FONT_OUT_BASE}.${hash}.woff2`;
    fs.mkdirSync(path.join(DIST, 'assets/fonts'), { recursive: true });
    fs.writeFileSync(path.join(DIST, 'assets/fonts', fontFile), woff2);
    fontSize = woff2.length;
  } else {
    console.warn('[fonts] source font not found → system fallback only');
  }

  // ---- 8. 字体样式表（layout 以 <link> 引用，与渲染顺序解耦） ----
  write(path.join(DIST, 'assets/css/fonts.css'), fontsCss(fontFile));

  // ---- 9. SEO 与缓存策略 ----
  const pages = listPages(DIST);
  write(path.join(DIST, 'sitemap.xml'), sitemapXml(site.url, pages));
  write(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  write(path.join(DIST, '_headers'), HEADERS);

  console.log(
    `[build] ${pages.length} pages | ${text.length} codepoints | ` +
      (hasFont ? `subset ${(fontSize / 1024).toFixed(1)} KB (${fontFile})` : 'no webfont (fallback only)') +
      ` | ${Date.now() - t0} ms`
  );
}

// ---------- SSG 渲染 ----------

// esbuild 打包 React 组件树为 Node 可加载的 ESM；react/react-dom 保持 external 由 Node 解析
async function bundleSSR() {
  await esbuild.build({
    entryPoints: [SSR_ENTRY],
    outfile: SSR_BUNDLE,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/server'],
    logLevel: 'warning',
  });
  return import(pathToFileURL(SSR_BUNDLE).href);
}

function render(renderPage, page, outFile, data) {
  write(path.join(DIST, outFile), renderPage(page, data));
}

// ---------- 仅 dev：React DevTools 接线（--devtools / npm run dev:devtools） ----------

// 纯静态站没有客户端运行时，React DevTools 无处附着。此步打包 dev-only 的
// 客户端入口（整份文档 hydration）+ 独立版 DevTools backend 并注入 HTML。
// 生产构建不走该分支，dist/ 产物仍为纯静态零 JS。
async function bundleDevtoolsClient() {
  const jsDir = path.join(DIST, 'assets/js');
  fs.mkdirSync(jsDir, { recursive: true });
  await Promise.all([
    esbuild.build({
      entryPoints: [path.join(ROOT, 'src/app/entry-client.jsx')],
      outfile: path.join(jsDir, 'entry-client.js'),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"development"' },
      logLevel: 'warning',
    }),
    // backend 是浏览器可用的 UMD（无 exports/module 环境下自动挂到 self）。
    // 不能经 esbuild 二次打包：CJS 包装会吞掉 module.exports，全局对象就丢了。
    fs.promises.copyFile(
      require.resolve('react-devtools-core/dist/backend'),
      path.join(jsDir, 'react-devtools-backend.js')
    ),
  ]);
  // 顺序关键：先装全局 hook（initialize）→ 再连接独立应用（默认 ws://localhost:8097）
  // → 最后加载 entry-client（react-dom 求值时向已存在的 hook 注册 renderer）
  const inject = [
    '<script src="/assets/js/react-devtools-backend.js"></script>',
    '<script>window.ReactDevToolsBackend.initialize();window.ReactDevToolsBackend.connectToDevTools();</script>',
    '<script src="/assets/js/entry-client.js"></script>',
  ].join('\n');
  for (const html of collectHtml(DIST)) {
    const src = fs.readFileSync(html, 'utf8');
    fs.writeFileSync(html, src.replace('</body>', `${inject}\n</body>`));
  }
  console.log(
    '[devtools] injected client runtime + backend — run `npm run devtools` to open the standalone app'
  );
}

function collectHtml(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.html')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// ---------- 码点收集 ----------

function collectCodepoints(dir) {
  const set = new Set(BASE_CHARS);
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.name.endsWith('.html')) {
        const html = fs
          .readFileSync(p, 'utf8')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '');
        const text = decodeEntities(html.replace(/<[^>]+>/g, ' '));
        // for..of 按 code point 迭代，正确处理代理对（增补平面字符）
        for (const ch of text) {
          const cp = ch.codePointAt(0);
          if (cp > 0x20 && cp !== 0xa0) set.add(ch);
        }
      }
    }
  };
  walk(dir);
  return [...set].join('');
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

// ---------- 生成物 ----------

function fontsCss(fontFile) {
  const fallback = '"Songti SC", "SimSun", "Noto Serif CJK SC", serif';
  const lines = [];
  if (fontFile) {
    lines.push(
      '@font-face {',
      `  font-family: "${FONT_FAMILY}";`,
      `  src: url("/assets/fonts/${fontFile}") format("woff2");`,
      '  font-weight: 400;',
      '  font-style: normal;',
      '  font-display: swap;',
      '}'
    );
  } else {
    lines.push('/* source font unavailable: system fallback only */');
  }
  lines.push(`:root { --font-song: "${FONT_FAMILY}", ${fallback}; }`);
  lines.push('body { font-family: var(--font-song); }');
  return lines.join('\n') + '\n';
}

function listPages(dir) {
  const urls = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.name === 'index.html') {
        const rel = path.relative(dir, p).split(path.sep).join('/');
        urls.push('/' + rel.slice(0, -'index.html'.length));
      }
    }
  };
  walk(dir);
  return urls.sort();
}

function sitemapXml(base, urls) {
  const items = urls.map((u) => `  <url><loc>${base}${u === '/' ? '/' : u}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

// ---------- 工具 ----------

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 页面级样式随页面文件存放（src/app/pages/Index.css），构建期拷贝为静态资产
function copyPageCss() {
  const pagesDir = path.join(ROOT, 'src/app/pages');
  const outDir = path.join(DIST, 'assets/css/pages');
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of fs.readdirSync(pagesDir)) {
    if (entry.endsWith('.css')) {
      fs.copyFileSync(path.join(pagesDir, entry), path.join(outDir, entry));
    }
  }
}

// Tailwind v4 经官方 CLI 编译；扫描范围由入口样式中的 @source 声明（src/app/**/*.jsx）
function buildTailwindCss() {
  const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss');
  const input = path.join(ROOT, 'src/app/styles/tailwind.css');
  const output = path.join(DIST, 'assets/css/tailwind.css');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execSync(`"${bin}" -i "${input}" -o "${output}" --minify`, { cwd: ROOT, stdio: 'inherit' });
}
