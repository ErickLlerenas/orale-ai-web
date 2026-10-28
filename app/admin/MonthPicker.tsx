"use client";

import { useRouter } from "next/navigation";
import s from "./admin.module.css";

/// Selector del mes que mide el panel (descargas, suscripciones, negocios
/// nuevos y cancelaciones). Cambia la URL (?mes=2026-10) y el servidor vuelve a armar.
export default function MonthPicker({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <select
      className={s.monthSelect}
      value={value}
      aria-label="Mes"
      onChange={(e) => router.push(`/admin?mes=${e.target.value}`)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
