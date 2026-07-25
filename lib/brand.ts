/**
 * Paleta de marca — una sola fuente de verdad.
 * Web: espejo de las CSS vars en globals.css (:root).
 * App Flutter: `lib/core/theme/pro_brand.dart` (misma paleta Pro).
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

/** Todo lo “Pro” (web + app): navy oscuro + amber premium. */
export const proBrand = {
  /** Acento / botones / checks */
  accent: "#F5B942",
  accentDark: "#E0A82E",
  soft: "rgba(245, 185, 66, 0.20)",
  /** Fondos navy */
  surface: "#0B1220",
  surface2: "#151D2E",
  surfaceSelected: "#1A2740",
  border: "#2A3548",
  /** Texto sobre oscuro */
  ink: "#F1F5F9",
  inkSoft: "#94A3B8",
  /** Texto sobre botón amber */
  onAccent: "#1A1408",
  alertBg: "#1A1710",
  muted: "#7C8A9E",
} as const;
