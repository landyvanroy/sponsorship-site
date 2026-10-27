// 首页 — 杂志封面：剧照以 background-cover 满幅铺底，愿景/使命竖排墨字叠印其上
export default function Index({ site }) {
  return (
    <section
      className="home-cover"
      style={{ backgroundImage: `url(${site.banner.image})` }}
      role="img"
      aria-label={site.banner.alt}
    >
      {site.banner.caption && (
        <p className="cover-caption" aria-hidden="true">
          {site.banner.caption}
        </p>
      )}
      <div className="home-motto" aria-label="愿景与使命">
        <div className="motto-panel">
          <h2 className="motto-title">愿景</h2>
          <p className="motto-text motto-text--vision">用歌声温柔改变世界</p>
        </div>
        <div className="motto-panel">
          <h2 className="motto-title">使命</h2>
          <p className="motto-text motto-text--mission">以成为艺术水准出色的合唱团</p>
          <p className="motto-text motto-text--mission">和有责任担当的性少数群体组织为己任</p>
        </div>
      </div>
    </section>
  );
}
