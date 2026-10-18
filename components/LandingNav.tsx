"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";

const links = [
  { href: "#features", label: "Funciones" },
  { href: "#pro", label: "Pro" },
  { href: "#precios", label: "Precios" },
];

/// Barra de la landing: transparente sobre el hero y sólida al hacer scroll.
const countries = [
  { code: "MX", name: "México", currency: "MXN · Peso mexicano", flag: "🇲🇽" },
  { code: "CL", name: "Chile", currency: "CLP · Peso chileno", flag: "🇨🇱" },
] as const;

export default function LandingNav({ country }: { country: "MX" | "CL" }) {
  const [scrolled, setScrolled] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [hash, setHash] = useState("");
  const countryPicker = useRef<HTMLDivElement>(null);
  const countryButton = useRef<HTMLButtonElement>(null);
  const selectedCountry = countries.find((option) => option.code === country)!;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!countryOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!countryPicker.current?.contains(event.target as Node)) setCountryOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCountryOpen(false);
        countryButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [countryOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <nav className="landing-nav-inner" aria-label="Principal">
        <a className="landing-brand" href={`/?pais=${country}`} aria-label="Órale AI, inicio">
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
        <div className="landing-nav-actions">
          <div className="country-picker" ref={countryPicker}>
            <button
              className="country-trigger"
              type="button"
              ref={countryButton}
              aria-label={`Cambiar país. País actual: ${selectedCountry.name}`}
              aria-expanded={countryOpen}
              aria-controls="country-options"
              onClick={() => setCountryOpen((open) => !open)}
            >
              <Globe2 size={17} aria-hidden="true" />
              <span>{selectedCountry.name}</span>
              <ChevronDown size={14} className={countryOpen ? "is-open" : ""} aria-hidden="true" />
            </button>
            {countryOpen && (
              <div className="country-options" id="country-options">
                <p>País y moneda</p>
                <nav aria-label="País">
                  {countries.map((option) => (
                    <a
                      key={option.code}
                      href={`/?pais=${option.code}${hash}`}
                      aria-current={country === option.code ? "page" : undefined}
                    >
                      <span className="country-flag" aria-hidden="true">{option.flag}</span>
                      <span className="country-option-label">
                        <strong>{option.name}</strong>
                        <small>{option.currency}</small>
                      </span>
                      {country === option.code && <Check size={17} aria-hidden="true" />}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </div>
          <a className="landing-nav-cta" href="#cta">
            Descargar
          </a>
        </div>
      </nav>
    </header>
  );
}
