// entry-server.jsx — SSG 渲染入口（构建期执行，产出纯静态 HTML）
// build.js 经 esbuild 打包本文件后 dynamic import，按「页面名 + locale 内容」渲染对应组件树
import { renderToStaticMarkup } from 'react-dom/server';
import Layout from './components/Layout.jsx';
import IndexPage from './pages/Index.jsx';
import NotFoundPage from './pages/NotFound.jsx';

const PAGES = {
  index: IndexPage,
  '404': NotFoundPage,
};

// 页面级样式表：与页面文件同目录（src/app/pages/*.css），构建期拷贝到 /assets/css/pages/
const PAGE_CSS = {
  index: ['/assets/css/pages/Index.css'],
  '404': [],
};

export function renderPage(page, data) {
  const Page = PAGES[page];
  if (!Page) throw new Error(`unknown page: ${page}`);
  const { site } = data;
  return (
    '<!DOCTYPE html>\n' +
    renderToStaticMarkup(
      <Layout
        title={data.title}
        description={site.description}
        site={site}
        pageCss={PAGE_CSS[page]}
        path={data.path || ''}
      >
        <Page {...data} />
      </Layout>
    )
  );
}
