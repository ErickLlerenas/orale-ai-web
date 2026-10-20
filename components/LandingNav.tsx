"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "#features", label: "Funciones" },
  { href: "#pro", label: "Pro" },
  { href: "#precios", label: "Precios" },
];

/// Barra de la landing: transparente sobre el hero y sólida al hacer scroll.
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <nav className="landing-nav-inner" aria-label="Principal">
        <a className="landing-brand" href="/" aria-label="Órale AI, inicio">
          <img src="/logo.png" alt="" width="34" height="34" />
          <span>
            Órale<em> AI</em>
          </span>
        </a>
        <div className="landing-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <a href="/negocio">Mi negocio</a>
        </div>
        <a className="landing-nav-cta" href="#cta">
          Descargar
        </a>
      </nav>
    </header>
  );
}
