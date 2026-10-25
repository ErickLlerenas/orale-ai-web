/** Formato compartido por Usuarios y Nuevos suscriptores. */
export function tenureLabel(d: number | null) {
  if (d == null) return "—";
  if (d < 1) return "hoy";
  if (d < 30) return `${d} ${d === 1 ? "día" : "días"}`;
  const m = Math.floor(d / 30);
  return `${m} ${m === 1 ? "mes" : "meses"}`;
}
