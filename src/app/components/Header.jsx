// Header — 全站页头：logo 居右上（mix-blend-mode 融入纸底），下方为竖排主导航
// 移动端经媒体查询退化为顶部横排一行
export default function Header({ site }) {
  return (
    <header className="site-head">
      <a className="site-logo" href="/" aria-label={`${site.title} · 返回首页`}>
        <img src={site.logo} alt="" width="44" height="44" />
      </a>
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
