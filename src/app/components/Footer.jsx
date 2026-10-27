// Footer — 全站页脚：版权信息居左 + 全部语言链接居右（当前语言高亮）
// 链接 = 各语言 hrefBase + 当前页面相对路径（首页 path 为空 → 落语言根）
export default function Footer({ site, path = '' }) {
  return (
    <footer className="site-footer">
      <div className="page">
        {/* © 字形在衬线字体中偏上：flex 令符号与文字垂直居中对齐 */}
        <p className="copyright">
          <span className="copy-symbol">©</span>
          <span>{new Date().getFullYear()} {site.footer}</span>
        </p>
        <nav className="lang-links" aria-label={site.langNavAriaLabel}>
          {site.langLinks.map((link) => (
            <a
              key={link.hrefLocale}
              href={`${link.hrefBase}${path}`}
              hrefLang={link.hrefLocale}
              aria-label={link.ariaLabel}
              aria-current={link.hrefLocale === site.lang ? 'true' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
