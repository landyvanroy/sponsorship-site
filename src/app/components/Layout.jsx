import Header from './Header.jsx';
import Footer from './Footer.jsx';

// 页面框架：左侧内容区（page-main）+ 右侧导航栏（Header 竖排 logo + 菜单）
// 全站统一；首页与其他页面仅内容区内部样式不同
// pageCss：页面级样式表（与页面文件同目录，构建期拷贝到 /assets/css/pages/）
export default function Layout({ title, description, site, pageCss = [], children }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={description} />
        <title>{title}</title>
        <link rel="icon" type="image/jpeg" href="/assets/img/logo.jpg" />
        <link rel="apple-touch-icon" href="/assets/img/logo.jpg" />
        <link rel="stylesheet" href="/assets/css/tailwind.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />
        <link rel="stylesheet" href="/assets/css/fonts.css" />
        {pageCss.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div className="page">
          <main className="page-main">{children}</main>
          <Header site={site} />
        </div>
        <Footer site={site} />
      </body>
    </html>
  );
}
