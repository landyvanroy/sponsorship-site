// 首页 — 书衣封面：剧照影印为墨调底图，左上题签竖排团名 + 印章，右缘竖排题跋
export default function Index({ site }) {
  return (
    <div className="home">
      <section className="home-cover" aria-label={site.title}>
        <img
          className="cover-photo"
          src={site.banner.image}
          alt={site.banner.alt}
          width="768"
          height="1024"
        />
        {site.banner.caption && (
          <p className="cover-caption" aria-hidden="true">
            {site.banner.caption}
          </p>
        )}
        <div className="cover-slip">
          <h1 className="cover-title">{site.title}</h1>
          <span className="seal" aria-hidden="true">
            歌
          </span>
        </div>
      </section>

      <section className="home-motto" aria-label="愿景与使命">
        <div className="motto-panel" data-char="愿">
          <h2 className="motto-seal">愿景</h2>
          <p className="motto-text">{site.vision}</p>
        </div>
        <div className="motto-panel" data-char="使">
          <h2 className="motto-seal">使命</h2>
          <p className="motto-text">{site.mission}</p>
        </div>
      </section>
    </div>
  );
}
