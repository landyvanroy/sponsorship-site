// 首页 — 杂志封面：剧照以 background-cover 满幅铺底，愿景/使命叠印其上
// 中文版竖排墨字；英文版（.locale-en）横向排版，文案全部来自 locale 内容文件
export default function Index({ site }) {
  const { banner, home } = site;
  return (
    <section
      className="home-cover"
      style={{ backgroundImage: `url(${banner.image})` }}
      role="img"
      aria-label={banner.alt}
    >
      {banner.caption && (
        <p className="cover-caption" aria-hidden="true">
          {banner.caption}
        </p>
      )}
      <div className="home-motto" aria-label={home.ariaLabel}>
        <div className="motto-panel">
          <h2 className="motto-title">{home.vision.title}</h2>
          <p className="motto-text motto-text--vision">{home.vision.text}</p>
        </div>
        <div className="motto-panel">
          <h2 className="motto-title">{home.mission.title}</h2>
          {home.mission.lines.map((line) => (
            <p key={line} className="motto-text motto-text--mission">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
