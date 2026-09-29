"use client";
import { useState, type FormEvent } from "react";
import { NotebookTabs, LogIn } from "lucide-react";
import styles from "@/components/accounting/accounting.module.css";
export default function Login() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const values = new FormData(e.currentTarget);
    try {
      const response = await fetch("/contadores/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: values.get("password") }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const next = new URLSearchParams(location.search).get("next") || "/contadores";
      location.assign(next === "/contadores" || next.startsWith("/contadores?") ? next : "/contadores");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo conectar."); setBusy(false); }
  }
  return <div className={styles.portal}><main style={{ maxWidth: 420, margin: "0 auto", padding: "80px 24px" }}><div className={styles.brand}><NotebookTabs/><span>Órale AI<small>Cierre mensual</small></span></div><h1>Iniciar sesión</h1><form onSubmit={submit} style={{ display: "grid", gap: 18, marginTop: 28 }}><label>Contraseña<input name="password" type="password" autoComplete="current-password" required style={{ display: "block", width: "100%", marginTop: 6 }}/></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}><LogIn/>{busy ? "Entrando…" : "Entrar"}</button></form></main></div>;
}
