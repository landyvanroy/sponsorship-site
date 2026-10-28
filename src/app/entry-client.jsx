// entry-client.jsx — 仅 dev 使用的客户端运行时（build.js --devtools 时才打包进 dist/assets/js）
// 作用：让 React 在浏览器中真正运行（整份文档 hydration），独立版 React DevTools
// 才能通过 backend（ws://localhost:8097）检查组件树 / props / state。
// 生产构建不经过此文件，产物仍为纯静态零 JS。
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout.jsx';
import IndexPage from './pages/Index.jsx';
import NotFoundPage from './pages/NotFound.jsx';

// dev 服务器当前只有 index / 404 两页；新增页面时需同步此映射
const PAGES = {
  index: IndexPage,
  '404': NotFoundPage,
};

// site 与页面名由 dev server（vite.config.mjs，devtools 模式）注入
const site = window.__BQC_SITE__;
const page = window.__BQC_PAGE__;
const Page = PAGES[page];
const title = document.title;
const description = document.querySelector('meta[name="description"]')?.content ?? '';

// 用 createRoot 整树客户端渲染而非 hydrateRoot：SSG 用的是 renderToStaticMarkup，
// 不带 hydration 所需的文本节点分隔注释，相邻文本（如页脚年份）必然 mismatch。
// 仅 dev 运行，重渲染闪一下可接受。
createRoot(document).render(
  <Layout title={title} description={description} site={site}>
    <Page site={site} />
  </Layout>
);
