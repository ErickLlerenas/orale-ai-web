"use client";

import { IconRefresh } from "./icons";

type Props = {
  title: string;
  kicker?: string;
  subtitle?: string;
  onRefresh?: () => void;
  onSignOut: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
};

export default function OwnerChrome({
  title,
  kicker = "Ver mi negocio",
  subtitle,
  onRefresh,
  onSignOut,
  refreshing,
  children,
}: Props) {
  return (
    <div className="owner-app">
      <header className="owner-top">
        <div className="owner-bar">
          <a className="owner-brand" href="/">
            <img src="/logo.png" alt="Órale AI" />
          </a>
          <div className="owner-bar-copy">
            <p className="owner-bar-kicker">{kicker}</p>
            <h1>{title}</h1>
            {subtitle && <p className="owner-bar-sub">{subtitle}</p>}
          </div>
          <div className="owner-bar-actions">
            {onRefresh && (
              <button
                type="button"
                className="owner-icon-btn"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Actualizar"
                title="Actualizar"
              >
                <IconRefresh />
              </button>
            )}
            <button type="button" className="owner-text-btn" onClick={onSignOut}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="owner-main">{children}</main>
    </div>
  );
}
