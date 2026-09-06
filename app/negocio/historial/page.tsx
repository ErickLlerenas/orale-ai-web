"use client";

import { Suspense, useEffect } from "react";
import OwnerChrome from "@/components/owner/OwnerChrome";
import { OwnerSpinner, OwnerStatus } from "@/components/owner/OwnerDashboard";
import OwnerHistory from "@/components/owner/OwnerHistory";
import {
  useOwnerAuth,
  useOwnerMetrics,
  useSelectedLocation,
} from "@/components/owner/use-owner";
import { previewBundle } from "@/lib/owner/preview";
import { useSearchParams } from "next/navigation";

function HistorialBody() {
  const auth = useOwnerAuth();
  const metrics = useOwnerMetrics(Boolean(auth.session));
  const { selectedId } = useSelectedLocation();
  const searchParams = useSearchParams();
  const demo =
    process.env.NODE_ENV === "development" && searchParams.get("demo") === "1";

  useEffect(() => {
    if (!demo && auth.ready && !auth.session) {
      window.location.replace("/negocio");
    }
  }, [auth.ready, auth.session, demo]);

  if (demo) {
    const back = selectedId
      ? `/negocio?demo=1&sucursal=${selectedId}`
      : "/negocio?demo=1";
    return (
      <OwnerChrome title="Historial de ventas" onRefresh={() => undefined} onSignOut={() => undefined}>
        <p className="owner-back">
          <a href={back}>← Volver al resumen</a>
        </p>
        <OwnerHistory bundle={previewBundle} selectedId={selectedId} />
      </OwnerChrome>
    );
  }

  if (!auth.ready || !auth.session) return <OwnerSpinner />;

  return (
    <OwnerChrome
      title="Historial de ventas"
      onRefresh={metrics.refresh}
      onSignOut={auth.signOut}
      refreshing={metrics.loading}
    >
      <p className="owner-back">
        <a href={selectedId ? `/negocio?sucursal=${selectedId}` : "/negocio"}>
          ← Volver al resumen
        </a>
      </p>
      {metrics.loading && !metrics.bundle ? (
        <OwnerSpinner />
      ) : metrics.error && !metrics.bundle ? (
        <OwnerStatus
          message={metrics.error}
          actionLabel="Reintentar"
          onAction={metrics.refresh}
        />
      ) : metrics.bundle ? (
        <OwnerHistory bundle={metrics.bundle} selectedId={selectedId} />
      ) : null}
    </OwnerChrome>
  );
}

export default function HistorialPage() {
  return (
    <Suspense fallback={<OwnerSpinner />}>
      <HistorialBody />
    </Suspense>
  );
}
