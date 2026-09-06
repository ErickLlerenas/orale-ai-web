"use client";

import { IconRefresh } from "./icons";

type Props = {
  title: string;
  onRefresh?: () => void;
  onSignOut: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
};

export default function OwnerChrome({
  title,
  onRefresh,
  onSignOut,
  refreshing,
  children,
}: Props) {
  return (
    <div className="owner-app">
      <header className="owner-bar">
        <a className="owner-brand" href="/">
          <img src="/logo.png" alt="Órale AI" />
        </a>
        <h1>{title}</h1>
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
      </header>
      <main className="owner-main">{children}</main>
    </div>
  );
}
