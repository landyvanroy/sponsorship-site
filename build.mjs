// build.mjs — 生产构建编排（Vite 两阶段）
// 阶段一：Vite SSR 打包 entry-server → 渲染双语言 HTML + 404 页到暂存目录 .ssg-tmp/
// 阶段二：从暂存 HTML 收集码点 → subset-font 子集化 → 生成字体 CSS（一并暂存）
// 阶段三：Vite 客户端构建，以暂存 HTML 为 input，自动抽取并按 [name].[hash].[ext]
//         产出 CSS / 字体到 dist/assets；收尾写入 sitemap / robots / _headers / 根跳转页
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import subsetFont from 'subset-font';
import {
  DEFAULT_LOCALE,
  FONT_FAMILY,
  FONT_SOURCE,
  LOCALES,
  ROOT,
  collectCodepoints,
  listPages,
  loadSites,
  redirectPage,
  sitemapXml,
  write,
} from './ssg.shared.mjs';

const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, '.ssg-tmp');
const SSR_BUNDLE = path.join(ROOT, 'node_modules/.cache/bqcbqc/entry-server.mjs');

// 构建期 CSS URL 映射：渲染产物中的 /assets/css/... 改写为 Vite 可解析的源码/暂存路径
// （fonts.zh-cn.css 由码点收集后动态生成到暂存目录，故为相对路径）
const BUILD_CSS = {
  '/assets/css/tailwind.css': '/src/app/styles/tailwind.css',
  '/assets/css/style.css': '/src/assets/css/style.css',
  '/assets/css/pages/Index.css': '/src/app/pages/Index.css',
  '/assets/css/fonts.zh-cn.css': './fonts.zh-cn.css',
  '/assets/css/fonts.en.css': '/src/app/styles/fonts.en.css',
};

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
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const sites = loadSites();

  // ---- 阶段一：SSR 打包 → 渲染暂存 HTML ----
  await build({
    configFile: false,
    root: ROOT,
    plugins: [react()],
    build: {
      ssr: 'src/app/entry-server.jsx',
      outDir: path.dirname(SSR_BUNDLE),
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'entry-server.mjs' } },
    },
  });
  const { renderPage, setAssetUrls } = await import(pathToFileURL(SSR_BUNDLE).href);
  setAssetUrls({
    tailwind: BUILD_CSS['/assets/css/tailwind.css'],
    style: BUILD_CSS['/assets/css/style.css'],
    pages: { index: [BUILD_CSS['/assets/css/pages/Index.css']] },
  });

  // ---- 阶段二：渲染暂存 HTML → 码点收集 → 字体子集化 ----
  // 暂存目录镜像目标结构（zh-cn/index.html → dist/zh-cn/index.html），
  // Vite 以 HTML 相对 root 的路径决定产物路径
  const stagedPages = [
    ...LOCALES.map((locale) => ({
      key: `${locale}/index`,
      file: `${locale}/index.html`,
      page: 'index',
      locale,
    })),
    { key: '404', file: '404.html', page: '404', locale: DEFAULT_LOCALE },
  ];

  for (const { file, page, locale } of stagedPages) {
    let fontCss = BUILD_CSS[sites[locale].fontCss] ?? sites[locale].fontCss;
    if (locale === DEFAULT_LOCALE) {
      // 字体 CSS 为暂存文件：相对 HTML 所在目录计算（zh-cn/ → ../fonts.zh-cn.css）
      fontCss = path.posix.relative(path.posix.dirname(file), 'fonts.zh-cn.css');
    }
    const site = { ...sites[locale], fontCss };
    const title = page === '404' ? `页面不存在 · ${sites[DEFAULT_LOCALE].title}` : site.title;
    write(path.join(TMP, file), renderPage(page, { site, title, path: '' }));
  }

  // 从中文产物收集全部码点（「动态打包」的依据；英文站走系统衬线栈，不参与子集化）
  const stagedHtml = stagedPages.map(({ file }) => path.join(TMP, file));
  const text = collectCodepoints(stagedHtml);

  const hasFont = fs.existsSync(FONT_SOURCE);
  if (!hasFont && process.env.CI) {
    throw new Error('source font missing in CI — check the R2 fetch step / secrets');
  }
  let fontSize = 0;
  if (hasFont) {
    const ttf = fs.readFileSync(FONT_SOURCE);
    const woff2 = await subsetFont(ttf, text, { targetFormat: 'woff2' });
    // 文件名不带 hash：交由 Vite 客户端构建统一产出 [name].[hash].woff2
    write(path.join(TMP, 'fonts/kinghwa-oldsong-subset.woff2'), woff2);
    fontSize = woff2.length;
  } else {
    console.warn('[fonts] source font not found → system fallback only');
  }
  write(path.join(TMP, 'fonts.zh-cn.css'), fontsZhCss(hasFont));
  // fonts.en.css 为静态源文件（src/app/styles/fonts.en.css），无需暂存

  // ---- 阶段三：客户端/assets 构建（HTML 为 input，产出 hash 文件名资源） ----
  await build({
    configFile: false,
    root: ROOT,
    publicDir: path.join(ROOT, 'public'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: DIST,
      emptyOutDir: true,
      rollupOptions: {
        input: Object.fromEntries(stagedPages.map(({ key, file }) => [key, path.join(TMP, file)])),
      },
    },
  });

  // Vite 按 HTML 相对 root 的路径决定产物路径：dist/.ssg-tmp/... → 搬移到 dist/ 最终位置
  //（HTML 内资源引用已被改写为 /assets/ 绝对路径，搬移安全）
  const stagedDist = path.join(DIST, '.ssg-tmp');
  for (const { file } of stagedPages) {
    const from = path.join(stagedDist, file);
    const to = path.join(DIST, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }
  fs.rmSync(stagedDist, { recursive: true, force: true });

  // ---- 收尾：根跳转页 / SEO / 缓存策略 ----
  write(path.join(DIST, 'index.html'), redirectPage(sites));
  const entries = LOCALES.flatMap((locale) =>
    listPages(path.join(DIST, locale)).map((rel) => ({ locale, rel }))
  );
  write(path.join(DIST, 'sitemap.xml'), sitemapXml(sites[DEFAULT_LOCALE].url, entries));
  write(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${sites[DEFAULT_LOCALE].url}/sitemap.xml\n`
  );
  write(path.join(DIST, '_headers'), HEADERS);

  fs.rmSync(TMP, { recursive: true, force: true });

  console.log(
    `[build] ${entries.length} pages (${LOCALES.join(' / ')}) | ${text.length} codepoints | ` +
      (hasFont ? `subset ${(fontSize / 1024).toFixed(1)} KB` : 'no webfont (fallback only)') +
      ` | ${Date.now() - t0} ms`
  );
}

// 中文站字体样式表（原 build.js fontsCss；woff2 路径指向暂存文件，由 Vite hash 后改写）
function fontsZhCss(hasFont) {
  const fallback = '"Songti SC", "SimSun", "Noto Serif CJK SC", serif';
  const lines = [];
  if (hasFont) {
    lines.push(
      '@font-face {',
      `  font-family: "${FONT_FAMILY}";`,
      '  src: url("./fonts/kinghwa-oldsong-subset.woff2") format("woff2");',
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
