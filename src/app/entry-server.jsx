// entry-server.jsx — SSG 渲染入口（构建期执行，产出纯静态 HTML）
// build.js 经 esbuild 打包本文件后 dynamic import，按页面名渲染对应组件树
import { renderToStaticMarkup } from 'react-dom/server';
import Layout from './components/Layout.jsx';
import IndexPage from './pages/Index.jsx';
import NotFoundPage from './pages/NotFound.jsx';

const PAGES = {
  index: IndexPage,
  '404': NotFoundPage,
};

export function renderPage(page, data) {
  const Page = PAGES[page];
  if (!Page) throw new Error(`unknown page: ${page}`);
  const { site } = data;
  const description = `${site.vision} ${site.mission}`;
  return (
    '<!DOCTYPE html>\n' +
    renderToStaticMarkup(
      <Layout title={data.title} description={description} site={site}>
        <Page {...data} />
      </Layout>
    )
  );
}
