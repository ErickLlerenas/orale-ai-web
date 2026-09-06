"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { fetchOwnerMetrics, OwnerApiError } from "@/lib/owner/api";
import type { OwnerMetricsBundle } from "@/lib/owner/types";
import {
  getBrowserSupabase,
  ownerAuthConfigured,
} from "@/lib/supabase-public";

export function useOwnerAuth() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ownerAuthConfigured()) {
      setReady(true);
      return;
    }

    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function boot() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
        window.history.replaceState({}, "", next);
        if (exchangeError && !cancelled) {
          setError("No se pudo entrar con Google. Inténtalo de nuevo.");
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(data.session);
        setReady(true);
      }
    }

    void boot();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!ownerAuthConfigured()) {
      setError("Falta configurar Supabase en el entorno.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/negocio`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        setError("No se pudo abrir Google. Inténtalo de nuevo.");
        setBusy(false);
      }
    } catch {
      setError("No se pudo abrir Google. Inténtalo de nuevo.");
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!ownerAuthConfigured()) return;
    await getBrowserSupabase().auth.signOut();
    setSession(null);
  }, []);

  return {
    ready,
    configured: ownerAuthConfigured(),
    session,
    user: (session?.user ?? null) as User | null,
    error,
    busy,
    signIn,
    signOut,
  };
}

export function useOwnerMetrics(enabled: boolean) {
  const [bundle, setBundle] = useState<OwnerMetricsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setBundle(await fetchOwnerMetrics());
    } catch (err) {
      setError(
        err instanceof OwnerApiError
          ? err.message
          : "No se pudo cargar la información.",
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bundle, error, loading, refresh };
}

export function useSelectedLocation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("sucursal");

  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id) next.set("sucursal", id);
      else next.delete("sucursal");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const withLocation = useCallback(
    (href: string) => {
      if (!selectedId) return href;
      const url = new URL(href, "https://orale.ai");
      url.searchParams.set("sucursal", selectedId);
      return `${url.pathname}?${url.searchParams}`;
    },
    [selectedId],
  );

  return { selectedId, setSelectedId, withLocation };
}
