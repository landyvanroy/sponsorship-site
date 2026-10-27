// Header — 全站页头：桌面端 logo 居右上 + 竖排主导航；移动端 logo 居左、
// 菜单收进图标按钮（纯 CSS 复选框开关，构建产物保持零 JS）
export default function Header({ site }) {
  return (
    <header className="site-head">
      <a className="site-logo" href="/" aria-label={`${site.title} · 返回首页`}>
        <img src={site.logo} alt="" width="44" height="44" />
      </a>
      {/* 折叠开关：checkbox 需位于 .site-menu 之前，供 ~ 兄弟选择器联动 */}
      <input type="checkbox" id="nav-toggle" className="nav-toggle-input" />
      <label htmlFor="nav-toggle" className="nav-toggle" aria-label="展开主导航">
        <span />
        <span />
        <span />
      </label>
      <nav className="site-menu" aria-label="主导航">
        {site.nav.map((item) =>
          item.placeholder ? (
            <a key={item.label} href={item.href} className="placeholder" title="规划中">
              {item.label}
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
