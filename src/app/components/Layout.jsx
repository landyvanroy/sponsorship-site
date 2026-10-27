import Header from './Header.jsx';
import Footer from './Footer.jsx';

// 页面框架：左侧内容区（page-main）+ 右侧导航栏（Header 竖排 logo + 菜单）
// 全站统一；首页与其他页面仅内容区内部样式不同
// locale 差异全部由 site 数据驱动：lang 属性、字体表（fontCss）、版式类名（locale-*）
// path：当前页面相对路径，供 Footer 语言链接定位同路径页面
export default function Layout({ title, description, site, pageCss = [], path = '', children }) {
  return (
    <html lang={site.lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={description} />
        <title>{title}</title>
        <link rel="icon" type="image/jpeg" href="/assets/img/logo.jpg" />
        <link rel="apple-touch-icon" href="/assets/img/logo.jpg" />
        <link rel="stylesheet" href="/assets/css/tailwind.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />
        <link rel="stylesheet" href={site.fontCss} />
        {pageCss.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className={site.locale === 'en' ? 'locale-en' : 'locale-zh-cn'}>
        <div className="page">
          <Header site={site} />
          <main className="page-main">{children}</main>
        </div>
        <Footer site={site} path={path} />
      </body>
    </html>
  );
}
