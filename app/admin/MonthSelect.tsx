"use client";

import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

/// Selector de mes: navega a /admin?month=yyyy-mm al cambiar.
export default function MonthSelect({
  value,
  options,
}: {
  value: string;
  options: Option[];
}) {
  const router = useRouter();
  return (
    <select
      className="month-select"
      value={value}
      onChange={(e) => router.push(`/admin?month=${e.target.value}`)}
      aria-label="Seleccionar mes"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
