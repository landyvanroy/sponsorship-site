// vite.config.mjs — dev server（vite / vite --mode devtools）与 preview 配置。
// 生产构建由 build.mjs 以内联配置编排，不经过本文件。
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { DEFAULT_LOCALE, ROOT, loadSites, redirectPage } from './ssg.shared.mjs';

// dev 场景的 CSS URL 映射（+?direct 保留原始 CSS 响应，tailwind 插件转换并支持 HMR）
const DEV_CSS = {
  '/assets/css/tailwind.css': '/src/app/styles/tailwind.css?direct',
  '/assets/css/style.css': '/src/assets/css/style.css?direct',
  '/assets/css/pages/Index.css': '/src/app/pages/Index.css?direct',
  '/assets/css/fonts.zh-cn.css': '/src/app/styles/fonts.dev.css?direct',
  '/assets/css/fonts.en.css': '/src/app/styles/fonts.en.css?direct',
};

const require = createRequire(import.meta.url);
const DEV_ASSET_URLS = {
  tailwind: DEV_CSS['/assets/css/tailwind.css'],
  style: DEV_CSS['/assets/css/style.css'],
  pages: { index: [DEV_CSS['/assets/css/pages/Index.css']] },
};

// SSG 插件：dev 按请求实时渲染 HTML；preview 补 404 兜底
function ssgPlugin({ devtools = false }) {
  let urlsInjected = false;

  async function loadRenderPage(server) {
    const mod = await server.ssrLoadModule('/src/app/entry-server.jsx');
    if (!urlsInjected) {
      mod.setAssetUrls(DEV_ASSET_URLS);
      urlsInjected = true;
    }
    return mod.renderPage;
  }

  return {
    name: 'bqc-ssg',

    configureServer(server) {
      const sites = loadSites();

      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

        // 静态/模块/内部请求（/@vite/client、/src/...、/assets/img/...）交给 Vite
        if (pathname.startsWith('/@') || pathname.startsWith('/node_modules/') || path.posix.basename(pathname).includes('.')) {
          return next();
        }

        try {
          let html;
          let status = 200;

          if (pathname === '/') {
            // 根路径：浏览器语言跳转页（与生产产物一致）
            html = redirectPage(sites);
          } else {
            let page;
            let locale = DEFAULT_LOCALE;
            if (/^\/(zh-cn|en)\/?$/.test(pathname)) {
              page = 'index';
              locale = pathname.split('/')[1];
            } else if (pathname === '/404.html') {
              page = '404';
            } else {
              // 未命中路由 → 渲染 404 页
              page = '404';
              status = 404;
            }
            const renderPage = await loadRenderPage(server);
            const site = { ...sites[locale], fontCss: DEV_CSS[sites[locale].fontCss] ?? sites[locale].fontCss };
            const title = page === '404' ? `页面不存在 · ${sites[DEFAULT_LOCALE].title}` : site.title;
            html = renderPage(page, { site, title, path: '' });
            html = await server.transformIndexHtml(req.url, html);
            if (devtools) html = injectDevtools(html, page, site);
          }

          res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(html);
        } catch (err) {
          server.ssrFixStacktrace?.(err);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(err.stack || String(err));
        }
      });
    },

    configurePreviewServer(server) {
      // vite preview 服务 dist/：静态文件/目录首页交给 Vite，未命中时回退 404.html（与 Cloudflare Pages 行为一致）
      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const dist = path.join(server.config.root, 'dist');
        const candidates = [path.join(dist, pathname), path.join(dist, pathname, 'index.html')];
        if (pathname === '/' || candidates.some((p) => fs.existsSync(p))) return next();
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(path.join(dist, '404.html')).pipe(res);
      });
    },
  };
}

// devtools：注入整文档客户端运行时 + 独立版 DevTools backend。
// 顺序关键：先装全局数据 → backend 挂 hook 并连接（默认 ws://localhost:8097）
// → 最后加载 entry-client（react-dom 求值时向已存在的 hook 注册 renderer）。
function injectDevtools(html, page, site) {
  const backendFile = require.resolve('react-devtools-core/dist/backend');
  const backendUrl = `/@fs/${pathToFileURL(backendFile).href.replace('file:///', '')}`;
  const inject = [
    `<script>window.__BQC_PAGE__=${JSON.stringify(page)};window.__BQC_SITE__=${JSON.stringify(site)};window.__BQC_ASSET_URLS__=${JSON.stringify(DEV_ASSET_URLS)};</script>`,
    `<script src="${backendUrl}"></script>`,
    '<script>window.ReactDevToolsBackend.initialize();window.ReactDevToolsBackend.connectToDevTools();</script>',
    '<script type="module" src="/src/app/entry-client.jsx"></script>',
  ].join('\n');
  return html.replace('</body>', `${inject}\n</body>`);
}

export default defineConfig(({ command, mode }) => ({
  publicDir: 'public',
  plugins: [react(), tailwindcss(), ssgPlugin({ devtools: command === 'serve' && mode === 'devtools' })],
}));
