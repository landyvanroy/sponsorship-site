// ssg.shared.mjs — build.mjs 与 vite.config.mjs 共享的 SSG 常量与纯函数（无 Vite 依赖）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

// 国际化：构建期 locale 配置（内容目录 src/content/{locale}/site.json → 产物 dist/{locale}/）
export const LOCALES = ['zh-cn', 'en'];
export const DEFAULT_LOCALE = 'zh-cn';
export const HREF_LANG = { 'zh-cn': 'zh-CN', 'en': 'en' };

export const FONT_SOURCE = path.join(ROOT, 'fonts/source/source-font.ttf');
export const FONT_FAMILY = 'KingHwaOldSong';

// 码点基线：可打印 ASCII + 常用中文标点，防止动态内容缺字
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(33 + i)).join('');
const CJK_PUNCT = '，。、；：？！（）《》〈〉【】「」『』…—·～“”‘’';
export const BASE_CHARS = ASCII + ' ' + CJK_PUNCT;

export function loadSites() {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, readJson(path.join(ROOT, `src/content/${locale}/site.json`))])
  );
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ---------- 码点收集 ----------

// paths：目录或单个 HTML 文件混合数组，递归/单文件均可
export function collectCodepoints(paths) {
  const set = new Set(BASE_CHARS);
  const readHtml = (p) => {
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
  };
  const walk = (p) => {
    if (fs.statSync(p).isDirectory()) {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) walk(path.join(p, entry.name));
    } else if (p.endsWith('.html')) {
      readHtml(p);
    }
  };
  for (const p of paths) walk(p);
  return [...set].join('');
}

export function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

// ---------- 生成物 ----------

// 根路径跳转页：按浏览器语言分发 /zh-cn/ 或 /en/（全站唯一含 JS 的产物）
export function redirectPage(sites) {
  const title = sites[DEFAULT_LOCALE].title;
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" type="image/jpeg" href="/assets/img/logo.jpg" />
    <style>
      body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #faf8f4; color: #2c2a26; font: 16px/1.9 Georgia, "Songti SC", "SimSun", serif; }
      a { color: #b03a2e; }
    </style>
    <script>
      (function () {
        var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        location.replace(/^zh/.test(lang) ? '/zh-cn/' : '/en/');
      })();
    </script>
  </head>
  <body>
    <noscript>
      <p>请选择语言 / Choose your language:</p>
      <p><a href="/zh-cn/">中文</a> · <a href="/en/">English</a></p>
    </noscript>
  </body>
</html>
`;
}

export function listPages(dir) {
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

// sitemap：双语言页面互为 hreflang 交替链接
// entries: [{ locale, rel }]，rel 为 locale 内相对路径（首页为 '/'）
export function sitemapXml(base, entries) {
  const byRel = new Map();
  for (const { locale, rel } of entries) {
    if (!byRel.has(rel)) byRel.set(rel, {});
    byRel.get(rel)[locale] = `/${locale}${rel === '/' ? '/' : rel}`;
  }
  const items = [...byRel.values()].map((alts) => {
    const loc = base + alts[DEFAULT_LOCALE];
    const links = LOCALES.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${HREF_LANG[l]}" href="${base}${alts[l]}"/>`
    ).join('\n');
    return `  <url>\n    <loc>${loc}</loc>\n${links}\n  </url>`;
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    items.join('\n') +
    '\n</urlset>\n'
  );
}
