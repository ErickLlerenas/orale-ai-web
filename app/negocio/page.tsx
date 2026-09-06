"use client";

import { Suspense } from "react";
import OwnerChrome from "@/components/owner/OwnerChrome";
import OwnerDashboard, {
  OwnerSpinner,
  OwnerStatus,
} from "@/components/owner/OwnerDashboard";
import OwnerLogin from "@/components/owner/OwnerLogin";
import {
  useOwnerAuth,
  useOwnerMetrics,
  useSelectedLocation,
} from "@/components/owner/use-owner";
import { ownerHomeTitle } from "@/lib/owner/format";
import { previewBundle } from "@/lib/owner/preview";
import { useSearchParams } from "next/navigation";

function NegocioBody() {
  const auth = useOwnerAuth();
  const metrics = useOwnerMetrics(Boolean(auth.session));
  const { selectedId, setSelectedId, withLocation } = useSelectedLocation();
  const searchParams = useSearchParams();
  const demo =
    process.env.NODE_ENV === "development" && searchParams.get("demo") === "1";

  if (demo) {
    return (
      <OwnerChrome
        title="Hola, Erick"
        subtitle="Oralee"
        onRefresh={() => undefined}
        onSignOut={() => undefined}
      >
        <OwnerDashboard
          bundle={previewBundle}
          selectedId={selectedId}
          onSelect={setSelectedId}
          historyHref={withLocation("/negocio/historial?demo=1")}
        />
      </OwnerChrome>
    );
  }

  if (!auth.ready) return <OwnerSpinner />;

  if (!auth.session) {
    return (
      <OwnerChrome title="Ver mi negocio">
        <OwnerLogin
          busy={auth.busy}
          error={auth.error}
          configured={auth.configured}
          onSignIn={auth.signIn}
        />
      </OwnerChrome>
    );
  }

  const bizName = metrics.bundle?.days
    .map((day) => day.bizName?.trim())
    .find((name) => name);
  const title = ownerHomeTitle(auth.user, bizName);

  return (
    <OwnerChrome
      title={title}
      subtitle={bizName && title !== bizName ? bizName : undefined}
      onRefresh={metrics.refresh}
      onSignOut={auth.signOut}
      refreshing={metrics.loading}
    >
      {metrics.loading && !metrics.bundle ? (
        <OwnerSpinner />
      ) : metrics.error && !metrics.bundle ? (
        <OwnerStatus
          message={metrics.error}
          actionLabel="Reintentar"
          onAction={metrics.refresh}
        />
      ) : metrics.bundle ? (
        <OwnerDashboard
          bundle={metrics.bundle}
          selectedId={selectedId}
          onSelect={setSelectedId}
          historyHref={withLocation("/negocio/historial")}
        />
      ) : null}
    </OwnerChrome>
  );
}

export default function NegocioPage() {
  return (
    <Suspense fallback={<OwnerSpinner />}>
      <NegocioBody />
    </Suspense>
  );
}
