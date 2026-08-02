const LINKS = [
  ["#rate", "Rate"],
  ["#table", "Table"],
  ["#trends", "Trends"],
  ["#map", "Map"],
  ["#lab", "Lab"],
  ["#people", "People"],
];

export function TopNav() {
  return (
    <header className="nav">
      <div className="navBrand">
        <span className="navBrandDot" aria-hidden="true" />
        <span className="navBrandName">ENERGY LEAGUE</span>
      </div>
      <nav className="navLinks" aria-label="Sections">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <a href="#rate" className="navCta">
        Cast a vote
      </a>
    </header>
  );
}
