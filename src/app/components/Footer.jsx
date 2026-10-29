// Footer — 全站页脚：版权信息居左 + 全部语言链接居右（当前语言高亮）
export default function Footer({ site}) {
  return (
    <footer className="site-footer">
      <div className="page">
        {/* © 字形在衬线字体中偏上：flex 令符号与文字垂直居中对齐 */}
        <p className="copyright">
          <span className="copy-symbol">©</span>
          <span>{new Date().getFullYear()} {site.footer}</span>
        </p>
      </div>
    </footer>
  );
}
