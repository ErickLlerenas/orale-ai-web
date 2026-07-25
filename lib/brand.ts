/**
 * Paleta de marca — una sola fuente de verdad.
 * Web: espejo de las CSS vars en globals.css (:root).
 * App Flutter: copia estos hex a tu theme Pro.
 */
export const brand = {
  primary: "#F15A29",
  primaryDark: "#D6481C",
  primarySoft: "#FFF0EA",
  accent: "#128A72",
  ink: "#1F2933",
  inkSoft: "#667085",
  surface: "#F8F9FB",
  card: "#FFFFFF",
  border: "#E8EBF0",
} as const;

/** Todo lo “Pro” de la web y la app usa esta paleta (azul oscuro + naranja). */
export const proBrand = {
  /** Acento / botones / checks */
  accent: "#F15A29",
  accentDark: "#D6481C",
  soft: "rgba(241, 90, 41, 0.16)",
  /** Fondos azul oscuro */
  surface: "#0B1220",
  surface2: "#141C2E",
  border: "rgba(241, 90, 41, 0.32)",
  /** Texto sobre oscuro */
  ink: "#F1F5F9",
  inkSoft: "#94A3B8",
} as const;
