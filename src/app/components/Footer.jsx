export default function Footer({ site }) {
  return (
    <footer className="site-footer">
      <div className="page">
        <p>© {new Date().getFullYear()} {site.footer}</p>
      </div>
    </footer>
  );
}
