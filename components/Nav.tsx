export default function Nav({ children }: { children?: React.ReactNode }) {
  return (
    <header>
      <nav className="nav">
        <a className="brand" href="/">
          <img src="/logo.png" alt="Órale AI" className="brand-logo" />
          Órale<span> AI</span>
        </a>
        <div className="nav-links">{children}</div>
      </nav>
    </header>
  );
}
