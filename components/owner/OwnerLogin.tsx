"use client";

import { IconGoogle } from "./icons";

type Props = {
  busy: boolean;
  error: string | null;
  configured: boolean;
  onSignIn: () => void;
};

export default function OwnerLogin({ busy, error, configured, onSignIn }: Props) {
  return (
    <div className="owner-login">
      <div className="owner-login-card">
        <img src="/logo.png" alt="" className="owner-login-logo" />
        <h1>Ver mi negocio</h1>
        <p>
          Entra con la misma cuenta de Google que activaste en la caja. Aquí
          ves las ventas en solo lectura, desde cualquier computadora.
        </p>
        {error && <p className="owner-banner owner-banner-error">{error}</p>}
        {!configured && (
          <p className="owner-banner owner-banner-error">
            Falta configurar Supabase en el entorno.
          </p>
        )}
        <button
          type="button"
          className="owner-google-btn"
          onClick={onSignIn}
          disabled={busy || !configured}
        >
          <IconGoogle />
          {busy ? "Abriendo Google…" : "Continuar con Google"}
        </button>
        <p className="owner-login-hint">
          Primero en la caja: Ajustes › Activar Ver mi negocio. Si tienes
          varias sucursales, las ves juntas con esa misma cuenta.
        </p>
      </div>
    </div>
  );
}
