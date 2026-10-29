// Header — 全站页头：桌面端 logo 居右上 + 竖排主导航（英文版式为 logo 居左 + 横向导航，
// 由 .locale-en 作用域样式切换）；移动端 logo 居左、菜单收进图标按钮
// （纯 CSS 复选框开关，构建产物保持零 JS）
// 链接 = 各语言 hrefBase + 当前页面相对路径（首页 path 为空 → 落语言根）
export default function Header({ site, path = '' }) {
  return (
    <header className="site-head">
	  <div className="site-logo-wrap">
      <a className="site-logo" href={site.homeHref} aria-label={site.logoAriaLabel}>
        <img src={site.logo} alt="" width="36" height="36" />
      </a>
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
      {/* 折叠开关：checkbox 需位于 .site-menu 之前，供 ~ 兄弟选择器联动 */}
      <input type="checkbox" id="nav-toggle" className="nav-toggle-input" />
      <label htmlFor="nav-toggle" className="nav-toggle" aria-label={site.navAriaLabel}>
        <span />
        <span />
        <span />
      </label>
      <nav className="site-menu" aria-label={site.navAriaLabel}>
        {site.nav.map((item) =>
          item.placeholder ? (
            <a key={item.label} href={item.href} className="placeholder" title={site.placeholderTitle}>
              {item.label}
            </a>
          ) : item.labelFull ? (
            // 英文导航：短标签 + hover 时以 CSS 动画展开的长文本解释（移动端作副标题常驻）
            <a key={item.label} href={item.href} className="nav-item">
              <span className="nav-short">{item.label}</span>
              <span className="nav-full">{item.labelFull}</span>
            </a>
          ) : (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          )
        )}
      </nav>
    </header>
  );
}
